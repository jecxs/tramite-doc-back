import { ERoles } from 'src/common/enums/ERoles.enum';

export interface ICurrentUser {
  id_usuario: string;
  id_area: string;
  roles: ERoles[];
}
