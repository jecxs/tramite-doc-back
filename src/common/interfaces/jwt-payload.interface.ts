import { ERoles } from 'src/common/enums/ERoles.enum';

export interface JwtPayload {
  sub: string; // id_usuario
  correo: string;
  dni: string;
  roles: ERoles[];
  id_area: string;
  nombre_completo: string;
}

export interface JwtPayloadWithTimestamps extends JwtPayload {
  iat: number;
  exp: number;
}
