import { Pago } from './pago';

export interface Campo {
  id: number;
  nombre: string;
  tamano: number;
  poligono: number;
  parcela: number;
  pagos?: Pago[];
  /** Solo en GET /campos/:id: movimientos que se borrarían junto al campo */
  numPagos?: number;
  numCheques?: number;
}
