export interface Cheque {
  id: number;
  dia: string;
  cantidad: number;
  anio?: number;
  campo?: {
    id: number;
    nombre?: string;
  };
}
