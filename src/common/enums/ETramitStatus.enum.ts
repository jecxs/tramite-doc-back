export const ETramitStatus = {
  ENVIADO: 'ENVIADO',
  ABIERTO: 'ABIERTO',
  LEIDO: 'LEIDO',
  FIRMADO: 'FIRMADO',
  RESPONDIDO: 'RESPONDIDO',
  ANULADO: 'ANULADO',
} as const;

export type ETramitStatus = (typeof ETramitStatus)[keyof typeof ETramitStatus];
