import { Campo } from '../../model/campo';
import { Categoria } from '../../model/categoria';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';

/**
 * Datos FICTICIOS del modo demo (vídeo y GitHub Pages). Nombres, superficies e importes inventados.
 * Se generan siempre iguales (generador pseudoaleatorio con semilla fija).
 */

export const CATEGORIAS_DEMO: Categoria[] = [
  { id: 1, nombre: 'Semillas y plantas', color: '#3fb950' },
  { id: 2, nombre: 'Abonos y fitosanitarios', color: '#d29922' },
  { id: 3, nombre: 'Combustible', color: '#f0883e' },
  { id: 4, nombre: 'Maquinaria y mantenimiento', color: '#a371f7' },
  { id: 5, nombre: 'Mano de obra', color: '#58a6ff' },
  { id: 6, nombre: 'Riego y agua', color: '#39c5cf' },
  { id: 7, nombre: 'Seguros e impuestos', color: '#ff7b72' },
  { id: 8, nombre: 'Arrendamiento', color: '#db61a2' },
  { id: 9, nombre: 'Sin categoría', color: '#8b949e' },
];

export const CAMPOS_DEMO: Campo[] = [
  { id: 1, nombre: 'La Solana', tamano: 12, poligono: 7, parcela: 112 },
  { id: 2, nombre: 'Bancal del Pozo', tamano: 8, poligono: 7, parcela: 98 },
  { id: 3, nombre: 'Los Almendros', tamano: 10.5, poligono: 12, parcela: 41 },
  { id: 4, nombre: 'Huerta de la Acequia', tamano: 5.5, poligono: 3, parcela: 207 },
  { id: 5, nombre: 'Camino Viejo', tamano: 4, poligono: 15, parcela: 9 },
];

/** Generador pseudoaleatorio con semilla (mulberry32): mismos datos en cada carga. */
function aleatorio(semilla: number): () => number {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Plantilla = { nombre: string; descripcion: string; cat: number; mes: number; porHanegada: number };

/** Gastos típicos de la campaña: importe aproximado por hanegada. */
const GASTOS: Plantilla[] = [
  { nombre: 'Abono de fondo', descripcion: 'Complejo NPK', cat: 2, mes: 2, porHanegada: 38 },
  { nombre: 'Poda', descripcion: 'Cuadrilla de poda', cat: 5, mes: 1, porHanegada: 45 },
  { nombre: 'Tratamiento fitosanitario', descripcion: 'Contra pulgón', cat: 2, mes: 4, porHanegada: 22 },
  { nombre: 'Riego por goteo', descripcion: 'Cuota de la comunidad de regantes', cat: 6, mes: 5, porHanegada: 30 },
  { nombre: 'Gasoil del tractor', descripcion: '', cat: 3, mes: 6, porHanegada: 14 },
  { nombre: 'Riego de verano', descripcion: 'Turnos de julio y agosto', cat: 6, mes: 7, porHanegada: 26 },
  { nombre: 'Desbroce', descripcion: 'Desbrozadora y mano de obra', cat: 5, mes: 9, porHanegada: 18 },
  { nombre: 'Seguro agrario', descripcion: 'Póliza anual', cat: 7, mes: 3, porHanegada: 16 },
];

/** Gastos que se reparten entre todos los campos (como un pago conjunto). */
const CONJUNTOS: { nombre: string; descripcion: string; cat: number; mes: number; total: number }[] = [
  { nombre: 'Revisión del tractor', descripcion: 'Taller: filtros y aceite', cat: 4, mes: 3, total: 640 },
  { nombre: 'Contribución rústica', descripcion: 'IBI anual', cat: 7, mes: 10, total: 410 },
];

const ANIOS = [2023, 2024, 2025, 2026];
/** Último mes con datos del año en curso (la demo «está» en otoño de 2026). */
const MES_ACTUAL = 10;

const fecha = (anio: number, mes: number, dia: number) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T00:00:00`;

const redondear = (n: number) => Math.round(n * 100) / 100;

export function crearDatosDemo(): { campos: Campo[]; categorias: Categoria[]; pagos: Pago[]; cheques: Cheque[] } {
  const rnd = aleatorio(20261026);
  const pagos: Pago[] = [];
  const cheques: Cheque[] = [];
  let id = 1;
  const categoria = (catId: number) => {
    const c = CATEGORIAS_DEMO.find((x) => x.id === catId)!;
    return { id: c.id, nombre: c.nombre, color: c.color };
  };
  const totalHanegadas = CAMPOS_DEMO.reduce((a, c) => a + c.tamano, 0);

  for (const anio of ANIOS) {
    const subida = 1 + (anio - ANIOS[0]) * 0.06; // los costes suben un poco cada año
    for (const campo of CAMPOS_DEMO) {
      for (const g of GASTOS) {
        if (anio === 2026 && g.mes > MES_ACTUAL) continue;
        if (rnd() < 0.12) continue; // no todos los campos tienen todos los gastos cada año
        const coste = redondear(g.porHanegada * campo.tamano * subida * (0.85 + rnd() * 0.3));
        pagos.push({
          id: id++,
          fecha: fecha(anio, g.mes, 3 + Math.floor(rnd() * 24)),
          nombre: g.nombre,
          descripcion: g.descripcion,
          coste,
          campo: { id: campo.id, nombre: campo.nombre },
          categoria: categoria(g.cat),
          // Este año quedan algunos pagos por pagar del todo
          pagado: !(anio === 2026 && g.mes >= 6 && rnd() < 0.45),
        });
      }
      // Ingresos: liquidación de la cosecha (las campañas anteriores, ya cobradas)
      if (anio < 2026 || campo.id <= 2) {
        const base = campo.id === 3 ? 260 : 330; // el almendro rinde algo menos que el cítrico
        cheques.push({
          id: id++,
          dia: fecha(anio, anio < 2026 ? 11 : 10, 5 + Math.floor(rnd() * 20)),
          cantidad: redondear(base * campo.tamano * (0.8 + rnd() * 0.45) * (anio === 2024 ? 0.82 : 1)),
          campo: { id: campo.id, nombre: campo.nombre },
        });
      }
    }
    for (const g of CONJUNTOS) {
      if (anio === 2026 && g.mes > MES_ACTUAL) continue;
      const total = g.total * subida;
      for (const campo of CAMPOS_DEMO) {
        pagos.push({
          id: id++,
          fecha: fecha(anio, g.mes, 15),
          nombre: g.nombre,
          descripcion: g.descripcion,
          coste: redondear((total * campo.tamano) / totalHanegadas),
          campo: { id: campo.id, nombre: campo.nombre },
          categoria: categoria(g.cat),
          pagado: true,
        });
      }
    }
  }

  return {
    campos: structuredClone(CAMPOS_DEMO),
    categorias: structuredClone(CATEGORIAS_DEMO),
    pagos,
    cheques,
  };
}
