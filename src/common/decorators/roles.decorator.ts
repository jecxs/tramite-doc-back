import { SetMetadata } from '@nestjs/common';
import { ERoles } from 'src/common/enums/ERoles.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar qué roles pueden acceder a un endpoint
 * @example
 * @Roles(ERoles.ADMIN, ERoles.RESP)
 * async crearTramite() { ... }
 */
export const Roles = (...roles: ERoles[]) => SetMetadata(ROLES_KEY, roles);
