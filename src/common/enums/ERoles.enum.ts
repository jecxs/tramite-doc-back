export const ERoles = {
  TRAB: 'TRAB',
  RESP: 'RESP',
  ADMIN: 'ADMIN',
} as const;

export type ERoles = (typeof ERoles)[keyof typeof ERoles];
