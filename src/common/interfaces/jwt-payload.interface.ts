export interface JwtPayload {
  sub: string; // id_usuario
  correo: string;
  dni: string;
  roles: string[]; // códigos de roles: ['ADMIN', 'RESP', 'TRAB']
  id_area: string;
  nombre_completo: string;
}

export interface JwtPayloadWithTimestamps extends JwtPayload {
  iat: number;
  exp: number;
}
