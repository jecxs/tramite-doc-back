import { ERoles } from 'src/common/enums/ERoles.enum';

export class AuthResponseDto {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id_usuario: string;
    dni: string;
    nombres: string;
    apellidos: string;
    correo: string;
    roles: ERoles[];
    area: {
      id_area: string;
      nombre: string;
    };
  };
}
