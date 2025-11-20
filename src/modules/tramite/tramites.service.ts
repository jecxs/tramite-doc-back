import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTramiteDto } from './dto/create-tramite.dto';
import { ReenviarTramiteDto } from './dto/reenviar-tramite.dto';
import { AnularTramiteDto } from './dto/anular-tramite.dto';
import { FilterTramiteDto } from './dto/filter-tramite.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateTramiteBulkDto } from './dto/create-tramite-bulk.dto';

@Injectable()
export class TramitesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * Crear un nuevo trámite (enviar documento a trabajador)
   * Solo ADMIN y RESP pueden enviar trámites
   */
  async create(createTramiteDto: CreateTramiteDto, userId: string) {
    // Verificar que el documento existe
    const documento = await this.prisma.documento.findUnique({
      where: { id_documento: createTramiteDto.id_documento },
      include: {
        tipo: true,
        creador: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException(
        `Documento con ID ${createTramiteDto.id_documento} no encontrado`,
      );
    }

    // Verificar que el receptor existe y está activo
    const receptor = await this.prisma.usuario.findUnique({
      where: { id_usuario: createTramiteDto.id_receptor },
      include: {
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    if (!receptor) {
      throw new NotFoundException(
        `Receptor con ID ${createTramiteDto.id_receptor} no encontrado`,
      );
    }

    if (!receptor.activo) {
      throw new BadRequestException('El receptor no está activo');
    }

    // Verificar que el receptor sea un trabajador (tiene rol TRAB)
    const esTrabajador = receptor.roles.some((ur) => ur.rol.codigo === 'TRAB');
    if (!esTrabajador) {
      throw new BadRequestException(
        'El receptor debe ser un trabajador (rol TRAB)',
      );
    }

    // Obtener información del remitente (usuario actual)
    const remitente = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      include: {
        area: true,
      },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    // Generar código único del trámite (formato: TRAM-YYYY-NNNNNN)
    const year = new Date().getFullYear();
    const count = await this.prisma.tramite.count();
    const codigo = `TRAM-${year}-${String(count + 1).padStart(6, '0')}`;

    // Crear el trámite
    const tramite = await this.prisma.tramite.create({
      data: {
        codigo,
        id_documento: createTramiteDto.id_documento,
        id_remitente: userId,
        id_area_remitente: remitente.id_area,
        id_receptor: createTramiteDto.id_receptor,
        asunto: createTramiteDto.asunto,
        mensaje: createTramiteDto.mensaje,
        estado: 'ENVIADO',
        requiere_firma: documento.tipo.requiere_firma,
        requiere_respuesta: documento.tipo.requiere_respuesta,
      },
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        remitente: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        receptor: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        areaRemitente: true,
      },
    });

    // Crear entrada en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: tramite.id_tramite,
        accion: 'CREACION',
        detalle: 'Trámite creado y enviado',
        estado_nuevo: 'ENVIADO',
        realizado_por: userId,
      },
    });

    // Crear notificación para el receptor
    await this.notificacionesService.notificarTramiteRecibido(
      tramite.id_receptor,
      tramite.id_tramite,
      `${remitente.nombres} ${remitente.apellidos}`,
      tramite.asunto,
    );

    // Si requiere firma, crear notificación adicional
    if (tramite.requiere_firma) {
      await this.notificacionesService.notificarDocumentoRequiereFirma(
        tramite.id_receptor,
        tramite.id_tramite,
        tramite.asunto,
      );
    }

    return tramite;
  }

  /**
   * Listar trámites con filtros
   * - ADMIN: Ve todos los trámites
   * - RESP: Ve trámites enviados por él o recibidos en su área
   * - TRAB: Ve solo trámites donde es receptor
   */
  async findAll(
    filterDto: FilterTramiteDto,
    userId: string,
    userRoles: string[],
  ) {
    const where: any = {};

    // Aplicar filtros de permisos según rol
    if (userRoles.includes('ADMIN')) {
      // ADMIN ve todo, no aplicar filtro adicional
    } else if (userRoles.includes('RESP')) {
      // RESP ve trámites donde es remitente o de su área
      const usuario = await this.prisma.usuario.findUnique({
        where: { id_usuario: userId },
      });

      where.OR = [
        { id_remitente: userId }, // Enviados por él
        { id_area_remitente: usuario?.id_area }, // De su área
      ];
    } else if (userRoles.includes('TRAB')) {
      // TRAB solo ve trámites donde es receptor
      where.id_receptor = userId;
    }

    // Aplicar filtros adicionales del DTO
    if (filterDto.id_remitente) {
      where.id_remitente = filterDto.id_remitente;
    }

    if (filterDto.id_receptor) {
      where.id_receptor = filterDto.id_receptor;
    }

    if (filterDto.id_area_remitente) {
      where.id_area_remitente = filterDto.id_area_remitente;
    }

    if (filterDto.estado) {
      where.estado = filterDto.estado;
    }

    if (filterDto.requiere_firma !== undefined) {
      where.requiere_firma = filterDto.requiere_firma;
    }

    if (filterDto.requiere_respuesta !== undefined) {
      where.requiere_respuesta = filterDto.requiere_respuesta;
    }

    if (filterDto.es_reenvio !== undefined) {
      where.es_reenvio = filterDto.es_reenvio;
    }

    // Búsqueda por texto
    if (filterDto.search) {
      where.OR = [
        { codigo: { contains: filterDto.search, mode: 'insensitive' } },
        { asunto: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const tramites = await this.prisma.tramite.findMany({
      where,
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        remitente: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        receptor: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        areaRemitente: true,
        tramiteOriginal: {
          select: {
            id_tramite: true,
            codigo: true,
            asunto: true,
          },
        },
        _count: {
          select: {
            observaciones: true,
            reenvios: true,
          },
        },
      },
      orderBy: {
        fecha_envio: 'desc',
      },
    });

    return tramites.map((tramite) => ({
      ...tramite,
      observaciones_count: tramite._count.observaciones,
      reenvios_count: tramite._count.reenvios,
      _count: undefined,
    }));
  }

  /**
   * Obtener un trámite por ID
   */
  async findOne(id: string, userId: string, userRoles: string[]) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: id },
      include: {
        documento: {
          include: {
            tipo: true,
            creador: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
              },
            },
          },
        },
        remitente: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        receptor: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
        areaRemitente: true,
        tramiteOriginal: {
          include: {
            documento: {
              select: {
                titulo: true,
                version: true,
              },
            },
          },
        },
        reenvios: {
          include: {
            documento: {
              select: {
                titulo: true,
                version: true,
              },
            },
          },
          orderBy: {
            numero_version: 'asc',
          },
        },
        anuladoPorUsuario: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        historial: {
          include: {
            usuario: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha: 'desc',
          },
        },
        observaciones: {
          include: {
            creador: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
            resolutor: {
              select: {
                nombres: true,
                apellidos: true,
              },
            },
          },
          orderBy: {
            fecha_creacion: 'desc',
          },
        },
        firma: true,
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${id} no encontrado`);
    }

    // Verificar permisos
    const tieneAcceso =
      userRoles.includes('ADMIN') ||
      tramite.id_remitente === userId ||
      tramite.id_receptor === userId;

    if (!tieneAcceso) {
      throw new ForbiddenException('No tiene permisos para ver este trámite');
    }

    return tramite;
  }

  /**
   * Marcar trámite como abierto
   * Se ejecuta cuando el receptor abre por primera vez el trámite
   */
  async marcarComoAbierto(id: string, userId: string) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: id },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${id} no encontrado`);
    }

    // Solo el receptor puede marcar como abierto
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor puede marcar el trámite como abierto',
      );
    }

    // Solo si está en estado ENVIADO
    if (tramite.estado !== 'ENVIADO') {
      throw new BadRequestException('El trámite ya fue abierto anteriormente');
    }

    // ✅ SOLUCIÓN: Usar SOLO include (sin mezclar con select)
    const tramiteActualizado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: 'ABIERTO',
        fecha_abierto: new Date(),
      },
      include: {
        documento: {
          include: {
            tipo: true,
            creador: true, // ✅ CAMBIO: usar include simple, no select
          },
        },
        remitente: {
          include: {
            area: true, // ✅ CAMBIO: solo include, sin select arriba
          },
        },
        receptor: {
          include: {
            area: true, // ✅ CAMBIO: solo include, sin select arriba
          },
        },
        areaRemitente: true,
        tramiteOriginal: {
          include: {
            documento: true, // ✅ CAMBIO: include simple
          },
        },
        reenvios: {
          include: {
            documento: true, // ✅ CAMBIO: include simple
          },
          orderBy: {
            numero_version: 'asc',
          },
        },
        anuladoPorUsuario: true, // ✅ CAMBIO: include simple
        historial: {
          include: {
            usuario: true, // ✅ CAMBIO: include simple
          },
          orderBy: {
            fecha: 'desc',
          },
        },
        observaciones: {
          include: {
            creador: true, // ✅ CAMBIO: include simple
            resolutor: true, // ✅ CAMBIO: include simple
          },
          orderBy: {
            fecha_creacion: 'desc',
          },
        },
        firma: true,
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: id,
        accion: 'APERTURA',
        detalle: 'Trámite abierto por el receptor',
        estado_anterior: 'ENVIADO',
        estado_nuevo: 'ABIERTO',
        realizado_por: userId,
      },
    });

    return tramiteActualizado;
  }

  /**
   * Marcar trámite como leído
   * Se ejecuta cuando el receptor lee el documento completo
   */
  async marcarComoLeido(id: string, userId: string) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: id },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${id} no encontrado`);
    }

    // Solo el receptor puede marcar como leído
    if (tramite.id_receptor !== userId) {
      throw new ForbiddenException(
        'Solo el receptor puede marcar el trámite como leído',
      );
    }

    // Solo si está en estado ABIERTO
    if (tramite.estado !== 'ABIERTO') {
      throw new BadRequestException(
        'El trámite debe estar abierto para marcarlo como leído',
      );
    }

    // ✅ USAR EL MISMO INCLUDE
    const tramiteActualizado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: 'LEIDO',
        fecha_leido: new Date(),
      },
      include: {
        documento: {
          include: {
            tipo: true,
            creador: true,
          },
        },
        remitente: {
          include: {
            area: true,
          },
        },
        receptor: {
          include: {
            area: true,
          },
        },
        areaRemitente: true,
        tramiteOriginal: {
          include: {
            documento: true,
          },
        },
        reenvios: {
          include: {
            documento: true,
          },
          orderBy: {
            numero_version: 'asc',
          },
        },
        anuladoPorUsuario: true,
        historial: {
          include: {
            usuario: true,
          },
          orderBy: {
            fecha: 'desc',
          },
        },
        observaciones: {
          include: {
            creador: true,
            resolutor: true,
          },
          orderBy: {
            fecha_creacion: 'desc',
          },
        },
        firma: true,
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: id,
        accion: 'LECTURA',
        detalle: 'Documento leído por el receptor',
        estado_anterior: 'ABIERTO',
        estado_nuevo: 'LEIDO',
        realizado_por: userId,
      },
    });

    return tramiteActualizado;
  }

  /**
   * Reenviar trámite con documento corregido
   * Se usa cuando hay observaciones y se necesita enviar versión corregida
   */
  async reenviar(
    idTramiteOriginal: string,
    reenviarDto: ReenviarTramiteDto,
    userId: string,
  ) {
    // Verificar que el trámite original existe
    const tramiteOriginal = await this.prisma.tramite.findUnique({
      where: { id_tramite: idTramiteOriginal },
      include: {
        documento: true,
        remitente: {
          include: {
            area: true,
          },
        },
        receptor: true,
      },
    });

    if (!tramiteOriginal) {
      throw new NotFoundException(
        `Trámite original con ID ${idTramiteOriginal} no encontrado`,
      );
    }

    // Solo el remitente original puede reenviar
    if (tramiteOriginal.id_remitente !== userId) {
      throw new ForbiddenException(
        'Solo el remitente puede reenviar el trámite',
      );
    }

    // Verificar que el nuevo documento existe
    const nuevoDocumento = await this.prisma.documento.findUnique({
      where: { id_documento: reenviarDto.id_documento },
      include: {
        tipo: true,
      },
    });

    if (!nuevoDocumento) {
      throw new NotFoundException('Nuevo documento no encontrado');
    }

    // Calcular número de versión
    const reenviosAnteriores = await this.prisma.tramite.count({
      where: {
        id_tramite_original: idTramiteOriginal,
      },
    });

    const numeroVersion = reenviosAnteriores + 2; // +2 porque el original es v1

    // Generar código único
    const year = new Date().getFullYear();
    const count = await this.prisma.tramite.count();
    const codigo = `TRAM-${year}-${String(count + 1).padStart(6, '0')}`;

    // Crear nuevo trámite (reenvío)
    const nuevoTramite = await this.prisma.tramite.create({
      data: {
        codigo,
        id_documento: reenviarDto.id_documento,
        id_remitente: userId,
        id_area_remitente: tramiteOriginal.id_area_remitente,
        id_receptor: tramiteOriginal.id_receptor, // Mismo receptor
        asunto: reenviarDto.asunto,
        mensaje: reenviarDto.mensaje,
        estado: 'ENVIADO',
        requiere_firma: nuevoDocumento.tipo.requiere_firma,
        requiere_respuesta: nuevoDocumento.tipo.requiere_respuesta,
        es_reenvio: true,
        id_tramite_original: idTramiteOriginal,
        motivo_reenvio: reenviarDto.motivo_reenvio,
        numero_version: numeroVersion,
      },
      include: {
        documento: {
          include: {
            tipo: true,
          },
        },
        remitente: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        receptor: {
          select: {
            id_usuario: true,
            nombres: true,
            apellidos: true,
          },
        },
        tramiteOriginal: {
          select: {
            codigo: true,
            asunto: true,
          },
        },
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: nuevoTramite.id_tramite,
        accion: 'REENVIO',
        detalle: `Reenvío del trámite ${tramiteOriginal.codigo}. Motivo: ${reenviarDto.motivo_reenvio}`,
        estado_nuevo: 'ENVIADO',
        realizado_por: userId,
        datos_adicionales: {
          tramite_original: idTramiteOriginal,
          numero_version: numeroVersion,
        },
      },
    });

    // Notificar al receptor sobre el reenvío
    await this.notificacionesService.notificarTramiteReenviado(
      nuevoTramite.id_receptor,
      nuevoTramite.id_tramite,
      nuevoTramite.asunto,
      numeroVersion,
    );

    return nuevoTramite;
  }

  /**
   * Anular un trámite
   * Solo el remitente o ADMIN pueden anular
   */
  async anular(
    id: string,
    anularDto: AnularTramiteDto,
    userId: string,
    userRoles: string[],
  ) {
    const tramite = await this.prisma.tramite.findUnique({
      where: { id_tramite: id },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${id} no encontrado`);
    }

    // Verificar permisos
    const puedeAnular =
      userRoles.includes('ADMIN') || tramite.id_remitente === userId;

    if (!puedeAnular) {
      throw new ForbiddenException(
        'Solo el remitente o un administrador pueden anular el trámite',
      );
    }

    // No se puede anular si ya está firmado
    if (tramite.estado === 'FIRMADO') {
      throw new BadRequestException('No se puede anular un trámite firmado');
    }

    // No se puede anular si ya está anulado
    if (tramite.estado === 'ANULADO') {
      throw new BadRequestException('El trámite ya está anulado');
    }

    const tramiteAnulado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: 'ANULADO',
        fecha_anulado: new Date(),
        anulado_por: userId,
        motivo_anulacion: anularDto.motivo_anulacion,
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: id,
        accion: 'ANULACION',
        detalle: `Trámite anulado. Motivo: ${anularDto.motivo_anulacion}`,
        estado_anterior: tramite.estado,
        estado_nuevo: 'ANULADO',
        realizado_por: userId,
      },
    });

    // NUEVO: Notificar al receptor sobre la anulación
    await this.notificacionesService.notificarTramiteAnulado(
      tramite.id_receptor,
      id,
      tramite.asunto,
      anularDto.motivo_anulacion,
    );

    return tramiteAnulado;
  }

  /**
   * Obtener estadísticas de trámites
   */
  async getStatistics(userId?: string, userRoles?: string[]) {
    let where: any = {};

    // Filtrar por permisos si no es ADMIN
    if (userId && userRoles && !userRoles.includes('ADMIN')) {
      if (userRoles.includes('RESP')) {
        const usuario = await this.prisma.usuario.findUnique({
          where: { id_usuario: userId },
        });
        where.OR = [
          { id_remitente: userId },
          { id_area_remitente: usuario?.id_area },
        ];
      } else if (userRoles.includes('TRAB')) {
        where.id_receptor = userId;
      }
    }

    const [total, enviados, abiertos, leidos, firmados, anulados, porArea] =
      await Promise.all([
        this.prisma.tramite.count({ where }),
        this.prisma.tramite.count({ where: { ...where, estado: 'ENVIADO' } }),
        this.prisma.tramite.count({ where: { ...where, estado: 'ABIERTO' } }),
        this.prisma.tramite.count({ where: { ...where, estado: 'LEIDO' } }),
        this.prisma.tramite.count({ where: { ...where, estado: 'FIRMADO' } }),
        this.prisma.tramite.count({ where: { ...where, estado: 'ANULADO' } }),
        this.prisma.tramite.groupBy({
          by: ['id_area_remitente'],
          where,
          _count: true,
        }),
      ]);

    // Obtener nombres de áreas
    const areas = await this.prisma.area.findMany({
      where: {
        id_area: {
          in: porArea.map((a) => a.id_area_remitente),
        },
      },
    });

    return {
      total,
      por_estado: {
        enviados,
        abiertos,
        leidos,
        firmados,
        anulados,
      },
      por_area: porArea.map((a) => ({
        id_area: a.id_area_remitente,
        nombre: areas.find((area) => area.id_area === a.id_area_remitente)
          ?.nombre,
        cantidad: a._count,
      })),
    };
  }
  /**
   * Crear múltiples trámites (envío masivo) con el mismo documento
   * Un documento se envía a múltiples receptores
   */
  async createBulk(createBulkDto: CreateTramiteBulkDto, userId: string) {
    // Verificar que el documento existe
    const documento = await this.prisma.documento.findUnique({
      where: { id_documento: createBulkDto.id_documento },
      include: {
        tipo: true,
        creador: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!documento) {
      throw new NotFoundException(
        `Documento con ID ${createBulkDto.id_documento} no encontrado`,
      );
    }

    // Verificar que todos los receptores existen y son trabajadores
    const receptores = await this.prisma.usuario.findMany({
      where: {
        id_usuario: {
          in: createBulkDto.id_receptores,
        },
        activo: true,
      },
      include: {
        roles: {
          include: {
            rol: true,
          },
        },
      },
    });

    // Validar que se encontraron todos los receptores
    if (receptores.length !== createBulkDto.id_receptores.length) {
      throw new NotFoundException(
        'Uno o más receptores no fueron encontrados o no están activos',
      );
    }

    // Validar que todos sean trabajadores
    const todosEsTrabajadores = receptores.every((r) =>
      r.roles.some((ur) => ur.rol.codigo === 'TRAB'),
    );

    if (!todosEsTrabajadores) {
      throw new BadRequestException(
        'Todos los receptores deben ser trabajadores (rol TRAB)',
      );
    }

    // Obtener información del remitente
    const remitente = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      include: {
        area: true,
      },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    const year = new Date().getFullYear();

    // Crear trámites en una transacción
    const tramitesCreados = await this.prisma.$transaction(async (tx) => {
      const tramites: any[] = [];

      for (const receptor of receptores) {
        // Generar código único para cada trámite
        const count = await tx.tramite.count();
        const codigo = `TRAM-${year}-${String(count + 1).padStart(6, '0')}`;

        // Crear el trámite
        const tramite = await tx.tramite.create({
          data: {
            codigo,
            id_documento: createBulkDto.id_documento,
            id_remitente: userId,
            id_area_remitente: remitente.id_area,
            id_receptor: receptor.id_usuario,
            asunto: createBulkDto.asunto,
            mensaje: createBulkDto.mensaje,
            estado: 'ENVIADO',
            requiere_firma: documento.tipo.requiere_firma,
            requiere_respuesta: documento.tipo.requiere_respuesta,
          },
          include: {
            documento: {
              include: {
                tipo: true,
              },
            },
            remitente: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
                correo: true,
              },
            },
            receptor: {
              select: {
                id_usuario: true,
                nombres: true,
                apellidos: true,
                correo: true,
              },
            },
            areaRemitente: true,
          },
        });

        // Crear entrada en historial
        await tx.historialTramite.create({
          data: {
            id_tramite: tramite.id_tramite,
            accion: 'CREACION',
            detalle: 'Trámite creado y enviado (envío masivo)',
            estado_nuevo: 'ENVIADO',
            realizado_por: userId,
          },
        });

        tramites.push(tramite);
      }

      return tramites;
    });

    // Crear notificaciones para todos los receptores
    for (const tramite of tramitesCreados) {
      await this.notificacionesService.notificarTramiteRecibido(
        tramite.id_receptor,
        tramite.id_tramite,
        `${remitente.nombres} ${remitente.apellidos}`,
        tramite.asunto,
      );

      // Si requiere firma, notificar también
      if (tramite.requiere_firma) {
        await this.notificacionesService.notificarDocumentoRequiereFirma(
          tramite.id_receptor,
          tramite.id_tramite,
          tramite.asunto,
        );
      }
    }

    return {
      message: `Se crearon ${tramitesCreados.length} trámites exitosamente`,
      total: tramitesCreados.length,
      tramites: tramitesCreados,
    };
  }
}
