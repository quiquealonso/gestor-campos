export interface Pago {
  id: number;
  fecha: string;
  nombre: string;
  descripcion: string;
  coste: number;
  anio?: number;
  /** true si el pago ya está pagado del todo */
  pagado: boolean;
  categoria?: {
    id: number;
    nombre?: string;
    color?: string;
  } | null;
  campo?: {
    id: number;
    nombre?: string;
  };
}
