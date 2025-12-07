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
import { CreateTramiteAutoLoteDto } from './dto/create-tramite-auto-lote.dto';
import { ERoles } from 'src/common/enums/ERoles.enum';
import { ETramitStatus } from 'src/common/enums/ETramitStatus.enum';

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
    const esTrabajador = receptor.roles.some(
      (ur) => ur.rol.codigo === ERoles.TRAB,
    );
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
        estado: ETramitStatus.ENVIADO,
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
        estado_nuevo: ETramitStatus.ENVIADO,
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
    // ============================================
    // CONFIGURACIÓN DE PAGINACIÓN
    // ============================================
    const pagina = filterDto.pagina || 1;
    const limite = Math.min(filterDto.limite || 20, 100); // Max 100 por página
    const skip = (pagina - 1) * limite;

    // ============================================
    // CONSTRUCCIÓN DE FILTROS BASE (PERMISOS)
    // ============================================
    const where: any = {};

    // Aplicar filtros de permisos según rol
    if (userRoles.includes(ERoles.ADMIN)) {
      // ADMIN ve todo, no aplicar filtro adicional
    } else if (userRoles.includes(ERoles.RESP)) {
      // RESP ve trámites donde es remitente o de su área
      const usuario = await this.prisma.usuario.findUnique({
        where: { id_usuario: userId },
      });

      where.OR = [
        { id_remitente: userId }, // Enviados por él
        { id_area_remitente: usuario?.id_area }, // De su área
      ];
    } else if (userRoles.includes(ERoles.TRAB)) {
      // TRAB solo ve trámites donde es receptor
      where.id_receptor = userId;
    }

    // ============================================
    // APLICAR FILTROS ADICIONALES DEL DTO
    // ============================================

    // Filtros de usuarios y áreas
    if (filterDto.id_remitente) {
      where.id_remitente = filterDto.id_remitente;
    }

    if (filterDto.id_receptor) {
      where.id_receptor = filterDto.id_receptor;
    }

    if (filterDto.id_area_remitente) {
      where.id_area_remitente = filterDto.id_area_remitente;
    }

    // Filtros de estado y tipo
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

    // ============================================
    // NUEVO: FILTRO POR TIPO DE DOCUMENTO
    // ============================================
    if (filterDto.id_tipo_documento) {
      where.documento = {
        id_tipo: filterDto.id_tipo_documento,
      };
    }

    // ============================================
    // NUEVO: FILTROS POR RANGO DE FECHAS
    // ============================================

    // Fecha de envío
    if (filterDto.fecha_envio_desde || filterDto.fecha_envio_hasta) {
      where.fecha_envio = {};

      if (filterDto.fecha_envio_desde) {
        where.fecha_envio.gte = new Date(filterDto.fecha_envio_desde);
      }

      if (filterDto.fecha_envio_hasta) {
        // Agregar 23:59:59 para incluir todo el día
        const fechaHasta = new Date(filterDto.fecha_envio_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        where.fecha_envio.lte = fechaHasta;
      }
    }

    // Fecha de lectura
    if (filterDto.fecha_leido_desde || filterDto.fecha_leido_hasta) {
      where.fecha_leido = {};

      if (filterDto.fecha_leido_desde) {
        where.fecha_leido.gte = new Date(filterDto.fecha_leido_desde);
      }

      if (filterDto.fecha_leido_hasta) {
        const fechaHasta = new Date(filterDto.fecha_leido_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        where.fecha_leido.lte = fechaHasta;
      }
    }

    // Fecha de firma
    if (filterDto.fecha_firmado_desde || filterDto.fecha_firmado_hasta) {
      where.fecha_firmado = {};

      if (filterDto.fecha_firmado_desde) {
        where.fecha_firmado.gte = new Date(filterDto.fecha_firmado_desde);
      }

      if (filterDto.fecha_firmado_hasta) {
        const fechaHasta = new Date(filterDto.fecha_firmado_hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        where.fecha_firmado.lte = fechaHasta;
      }
    }

    // ============================================
    // NUEVO: FILTROS ADICIONALES
    // ============================================

    // Filtrar trámites con/sin observaciones
    if (filterDto.tiene_observaciones !== undefined) {
      if (filterDto.tiene_observaciones) {
        where.observaciones = {
          some: {}, // Al menos una observación
        };
      } else {
        where.observaciones = {
          none: {}, // Sin observaciones
        };
      }
    }

    // Filtrar trámites con observaciones pendientes
    if (filterDto.observaciones_pendientes) {
      where.observaciones = {
        some: {
          resuelta: false, // Observaciones sin resolver
        },
      };
    }

    // Filtrar trámites con respuesta de conformidad
    if (filterDto.con_respuesta !== undefined) {
      if (filterDto.con_respuesta) {
        where.respuesta = {
          isNot: null, // Tiene respuesta
        };
      } else {
        where.respuesta = null; // No tiene respuesta
      }
    }

    // Búsqueda por texto
    if (filterDto.search) {
      where.OR = [
        { codigo: { contains: filterDto.search, mode: 'insensitive' } },
        { asunto: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // ============================================
    // CONFIGURACIÓN DE ORDENAMIENTO
    // ============================================
    const orderBy: any = {};

    if (filterDto.ordenar_por) {
      orderBy[filterDto.ordenar_por] = filterDto.orden || 'desc';
    } else {
      // Ordenamiento por defecto: más recientes primero
      orderBy.fecha_envio = 'desc';
    }

    // ============================================
    // EJECUTAR CONSULTAS EN PARALELO
    // ============================================
    const [tramites, total] = await Promise.all([
      // Obtener trámites paginados
      this.prisma.tramite.findMany({
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
        orderBy,
        skip,
        take: limite,
      }),

      // Contar total de registros (para paginación)
      this.prisma.tramite.count({ where }),
    ]);

    // ============================================
    // CALCULAR METADATA DE PAGINACIÓN
    // ============================================
    const totalPaginas = Math.ceil(total / limite);
    const tieneSiguiente = pagina < totalPaginas;
    const tieneAnterior = pagina > 1;

    // ============================================
    // FORMATEAR Y RETORNAR RESPUESTA
    // ============================================
    return {
      data: tramites.map((tramite) => ({
        ...tramite,
        observaciones_count: tramite._count.observaciones,
        reenvios_count: tramite._count.reenvios,
        _count: undefined,
      })),

      // Metadata de paginación
      paginacion: {
        pagina_actual: pagina,
        limite,
        total_registros: total,
        total_paginas: totalPaginas,
        tiene_siguiente: tieneSiguiente,
        tiene_anterior: tieneAnterior,
      },
    };
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
            dni: true,
            nombres: true,
            apellidos: true,
            correo: true,
            telefono: true,
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
        respuesta: true,
      },
    });

    if (!tramite) {
      throw new NotFoundException(`Trámite con ID ${id} no encontrado`);
    }

    // Verificar permisos
    const tieneAcceso =
      userRoles.includes(ERoles.ADMIN) ||
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
    if (tramite.estado !== ETramitStatus.ENVIADO) {
      throw new BadRequestException('El trámite ya fue abierto anteriormente');
    }

    // Usar SOLO include
    const tramiteActualizado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: ETramitStatus.ABIERTO,
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
        respuesta: true,
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: id,
        accion: 'APERTURA',
        detalle: 'Trámite abierto por el receptor',
        estado_anterior: ETramitStatus.ENVIADO,
        estado_nuevo: ETramitStatus.ABIERTO,
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
    if (tramite.estado !== ETramitStatus.ABIERTO) {
      throw new BadRequestException(
        'El trámite debe estar abierto para marcarlo como leído',
      );
    }

    // ✅ USAR EL MISMO INCLUDE
    const tramiteActualizado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: ETramitStatus.LEIDO,
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
        respuesta: true,
      },
    });

    // Registrar en historial
    await this.prisma.historialTramite.create({
      data: {
        id_tramite: id,
        accion: 'LECTURA',
        detalle: 'Documento leído por el receptor',
        estado_anterior: ETramitStatus.ABIERTO,
        estado_nuevo: ETramitStatus.LEIDO,
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
        estado: ETramitStatus.ENVIADO,
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
        estado_nuevo: ETramitStatus.ENVIADO,
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
      userRoles.includes(ERoles.ADMIN) || tramite.id_remitente === userId;

    if (!puedeAnular) {
      throw new ForbiddenException(
        'Solo el remitente o un administrador pueden anular el trámite',
      );
    }

    // No se puede anular si ya está firmado
    if (tramite.estado === ETramitStatus.FIRMADO) {
      throw new BadRequestException('No se puede anular un trámite firmado');
    }

    // No se puede anular si ya está anulado
    if (tramite.estado === ETramitStatus.ANULADO) {
      throw new BadRequestException('El trámite ya está anulado');
    }

    const tramiteAnulado = await this.prisma.tramite.update({
      where: { id_tramite: id },
      data: {
        estado: ETramitStatus.ANULADO,
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
        estado_nuevo: ETramitStatus.ANULADO,
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
    const where: any = {};

    // Filtrar por permisos si no es ADMIN
    if (userId && userRoles && !userRoles.includes(ERoles.ADMIN)) {
      if (userRoles.includes(ERoles.RESP)) {
        const usuario = await this.prisma.usuario.findUnique({
          where: { id_usuario: userId },
        });
        where.OR = [
          { id_remitente: userId },
          { id_area_remitente: usuario?.id_area },
        ];
      } else if (userRoles.includes(ERoles.TRAB)) {
        where.id_receptor = userId;
        where.NOT = {
          reenvios: {
            some: {}, // Excluir trámites que tienen reenvíos
          },
        };
      }
    }

    const [total, enviados, abiertos, leidos, firmados, anulados, porArea] =
      await Promise.all([
        this.prisma.tramite.count({ where }),
        this.prisma.tramite.count({
          where: { ...where, estado: ETramitStatus.ENVIADO },
        }),
        this.prisma.tramite.count({
          where: { ...where, estado: ETramitStatus.ABIERTO },
        }),
        this.prisma.tramite.count({
          where: { ...where, estado: ETramitStatus.LEIDO },
        }),
        this.prisma.tramite.count({
          where: { ...where, estado: ETramitStatus.FIRMADO },
        }),
        this.prisma.tramite.count({
          where: { ...where, estado: ETramitStatus.ANULADO },
        }),
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
      r.roles.some((ur) => ur.rol.codigo === ERoles.TRAB),
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
            estado: ETramitStatus.ENVIADO,
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
            estado_nuevo: ETramitStatus.ENVIADO,
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
  /**
   * Detectar destinatarios automáticamente por DNI en nombre de archivo
   * Endpoint de "preview" antes de confirmar el envío
   */
  async detectarDestinatarios(
    archivos: Express.Multer.File[],
    idTipoDocumento: string,
    userId: string,
  ): Promise<{
    exitosos: any[];
    fallidos: any[];
    tipo_documento: any;
  }> {
    // Verificar que el tipo de documento existe
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: idTipoDocumento },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${idTipoDocumento} no encontrado`,
      );
    }

    const exitosos: any[] = [];
    const fallidos: any[] = [];

    for (const archivo of archivos) {
      // Extraer DNI de los primeros 8 caracteres del nombre
      const nombreArchivo = archivo.originalname;
      const dniExtraido = nombreArchivo.substring(0, 8);

      // Validar que sea un DNI válido (8 dígitos numéricos)
      if (!/^\d{8}$/.test(dniExtraido)) {
        fallidos.push({
          nombre_archivo: nombreArchivo,
          dni: dniExtraido,
          encontrado: false,
          error:
            'El nombre del archivo no inicia con un DNI válido (8 dígitos)',
        });
        continue;
      }

      // Buscar trabajador por DNI
      const trabajador = await this.prisma.usuario.findUnique({
        where: { dni: dniExtraido, activo: true },
        include: {
          area: true,
          roles: {
            include: {
              rol: true,
            },
          },
        },
      });

      if (!trabajador) {
        fallidos.push({
          nombre_archivo: nombreArchivo,
          dni: dniExtraido,
          encontrado: false,
          error: `No se encontró un usuario activo con DNI ${dniExtraido}`,
        });
        continue;
      }

      // Verificar que sea trabajador (rol TRAB)
      const esTrabajador = trabajador.roles.some(
        (ur) => ur.rol.codigo === ERoles.TRAB,
      );

      if (!esTrabajador) {
        fallidos.push({
          nombre_archivo: nombreArchivo,
          dni: dniExtraido,
          encontrado: true,
          id_usuario: trabajador.id_usuario,
          nombre_completo: `${trabajador.nombres} ${trabajador.apellidos}`,
          error: 'El usuario no tiene rol de trabajador (TRAB)',
        });
        continue;
      }

      // Usuario válido encontrado
      exitosos.push({
        nombre_archivo: nombreArchivo,
        dni: dniExtraido,
        encontrado: true,
        id_usuario: trabajador.id_usuario,
        nombre_completo: `${trabajador.nombres} ${trabajador.apellidos}`,
        area: trabajador.area.nombre,
        // Archivo temporal (buffer) que se subirá después
        archivo_buffer: archivo.buffer,
        archivo_mimetype: archivo.mimetype,
        archivo_size: archivo.size,
      });
    }

    return {
      exitosos,
      fallidos,
      tipo_documento: {
        id_tipo: tipoDocumento.id_tipo,
        codigo: tipoDocumento.codigo,
        nombre: tipoDocumento.nombre,
        requiere_firma: tipoDocumento.requiere_firma,
        requiere_respuesta: tipoDocumento.requiere_respuesta,
      },
    };
  }

  /**
   * Crear trámites automáticos en lote con documentos ya subidos
   */
  async createAutoLote(
    createAutoLoteDto: CreateTramiteAutoLoteDto,
    userId: string,
  ) {
    // Verificar que el tipo de documento existe
    const tipoDocumento = await this.prisma.tipoDocumento.findUnique({
      where: { id_tipo: createAutoLoteDto.id_tipo_documento },
    });

    if (!tipoDocumento) {
      throw new NotFoundException(
        `Tipo de documento con ID ${createAutoLoteDto.id_tipo_documento} no encontrado`,
      );
    }

    // Verificar que todos los documentos existen
    const idsDocumentos = createAutoLoteDto.documentos.map(
      (d) => d.id_documento,
    );
    const documentos = await this.prisma.documento.findMany({
      where: {
        id_documento: { in: idsDocumentos },
      },
    });

    if (documentos.length !== idsDocumentos.length) {
      throw new NotFoundException('Uno o más documentos no fueron encontrados');
    }

    // Verificar que todos los usuarios existen y son trabajadores
    const idsUsuarios = createAutoLoteDto.documentos.map((d) => d.id_usuario);
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        id_usuario: { in: idsUsuarios },
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

    if (usuarios.length !== idsUsuarios.length) {
      throw new NotFoundException(
        'Uno o más usuarios no fueron encontrados o no están activos',
      );
    }

    // Validar que todos sean trabajadores
    const todosEsTrabajadores = usuarios.every((u) =>
      u.roles.some((ur) => ur.rol.codigo === ERoles.TRAB),
    );

    if (!todosEsTrabajadores) {
      throw new BadRequestException(
        'Todos los destinatarios deben ser trabajadores (rol TRAB)',
      );
    }

    // Obtener información del remitente
    const remitente = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      include: { area: true },
    });

    if (!remitente) {
      throw new NotFoundException('Remitente no encontrado');
    }

    const year = new Date().getFullYear();

    // Crear trámites en una transacción
    const tramitesCreados = await this.prisma.$transaction(async (tx) => {
      const tramites: any[] = [];

      for (const docData of createAutoLoteDto.documentos) {
        // Generar código único
        const count = await tx.tramite.count();
        const codigo = `TRAM-${year}-${String(count + 1).padStart(6, '0')}`;

        // Crear trámite
        const tramite = await tx.tramite.create({
          data: {
            codigo,
            id_documento: docData.id_documento,
            id_remitente: userId,
            id_area_remitente: remitente.id_area,
            id_receptor: docData.id_usuario,
            asunto: docData.asunto,
            mensaje: docData.mensaje,
            estado: ETramitStatus.ENVIADO,
            requiere_firma: tipoDocumento.requiere_firma,
            requiere_respuesta: tipoDocumento.requiere_respuesta,
          },
          include: {
            documento: {
              include: { tipo: true },
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

        // Registrar en historial
        await tx.historialTramite.create({
          data: {
            id_tramite: tramite.id_tramite,
            accion: 'CREACION',
            detalle: 'Trámite creado automáticamente en lote',
            estado_nuevo: ETramitStatus.ENVIADO,
            realizado_por: userId,
            datos_adicionales: {
              modo: 'auto_lote',
              dni_detectado: docData.dni,
              nombre_archivo: docData.nombre_archivo,
            },
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

      if (tramite.requiere_firma) {
        await this.notificacionesService.notificarDocumentoRequiereFirma(
          tramite.id_receptor,
          tramite.id_tramite,
          tramite.asunto,
        );
      }
    }

    return {
      mensaje: `Se crearon ${tramitesCreados.length} trámites exitosamente`,
      total: tramitesCreados.length,
      tramites: tramitesCreados,
    };
  }

  /**
   * Generar asunto y mensaje predeterminados según tipo de documento
   */
  generateDefaultMessage(
    tipoDocumento: string,
    nombreTrabajador: string,
  ): { asunto: string; mensaje: string } {
    const templates: Record<string, { asunto: string; mensaje: string }> = {
      CONTRATO: {
        asunto: `Contrato Laboral - ${nombreTrabajador}`,
        mensaje: `Estimado/a ${nombreTrabajador}, se le envía su contrato laboral para revisión y firma electrónica.`,
      },
      MEMO: {
        asunto: `Memorándum - ${nombreTrabajador}`,
        mensaje: `Estimado/a ${nombreTrabajador}, se le remite el presente memorándum para su conocimiento.`,
      },
      NOTIF: {
        asunto: `Notificación Oficial - ${nombreTrabajador}`,
        mensaje: `Estimado/a ${nombreTrabajador}, se le notifica oficialmente mediante el presente documento.`,
      },
    };

    return (
      templates[tipoDocumento] || {
        asunto: `Documento - ${nombreTrabajador}`,
        mensaje: `Estimado/a ${nombreTrabajador}, se le envía el siguiente documento para su revisión.`,
      }
    );
  }
}
