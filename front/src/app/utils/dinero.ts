/** Redondea a 2 decimales evitando ruido de coma flotante al sumar importes. */
export const redondear2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const sumar = (valores: Array<number | string | null | undefined>): number =>
  redondear2(valores.reduce<number>((acc, v) => acc + Number(v || 0), 0));
