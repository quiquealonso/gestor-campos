import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { delay, Observable, of, throwError } from 'rxjs';
import { Campo } from '../../model/campo';
import { Categoria } from '../../model/categoria';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';
import { CampoService } from '../campo/campo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { crearDatosDemo } from './datos-demo';

/**
 * Modo demo (`environment.demo`): sustituyen a SupabaseService y CampoService en app.config.ts.
 * Todo vive en memoria con datos ficticios; al recargar la página vuelve a los datos iniciales.
 */

/** Interfaz pública de un servicio (sin sus miembros privados), para implementarla aquí. */
type Publico<T> = { [K in keyof T]: T[K] };

const LATENCIA = 150;
const responder = <T>(valor: T): Observable<T> => of(structuredClone(valor)).pipe(delay(LATENCIA));
const fallar = (mensaje: string) => throwError(() => new Error(mensaje));

@Injectable()
export class DemoSupabaseService implements Omit<Publico<SupabaseService>, 'client'> {
  readonly sesion = signal<Session | null>(null);
  readonly listo = Promise.resolve();

  get email(): string {
    return this.sesion()?.user?.email ?? '';
  }

  /** En la demo el acceso viene relleno (datos ficticios) y vale cualquiera: no se envía a ningún sitio. */
  async login(email: string, _password: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 400));
    this.sesion.set({ user: { email: email.trim() || 'demo@ejemplo.com' } } as Session);
  }

  async logout(): Promise<void> {
    this.sesion.set(null);
  }
}

@Injectable()
export class DemoCampoService implements Publico<CampoService> {
  private datos = crearDatosDemo();
  private siguienteId = 10_000;

  private campoRef(id: number) {
    const c = this.datos.campos.find((x) => x.id === id);
    return c ? { id: c.id, nombre: c.nombre } : undefined;
  }

  private categoriaRef(categoria?: { id: number } | null) {
    const c = categoria ? this.datos.categorias.find((x) => x.id === categoria.id) : undefined;
    return c ? { id: c.id, nombre: c.nombre, color: c.color } : null;
  }

  // ---- Campos
  getCampos(): Observable<Campo[]> {
    return responder(this.datos.campos);
  }

  getCampoById(id: number): Observable<Campo | null> {
    const campo = this.datos.campos.find((c) => c.id === id);
    if (!campo) return responder(null);
    return responder({
      ...campo,
      numPagos: this.datos.pagos.filter((p) => p.campo?.id === id).length,
      numCheques: this.datos.cheques.filter((c) => c.campo?.id === id).length,
    });
  }

  createCampo(payload: Parameters<CampoService['createCampo']>[0]): Observable<Campo> {
    const campo: Campo = { id: this.siguienteId++, ...payload };
    this.datos.campos.push(campo);
    return responder(campo);
  }

  updateCampo(id: number, payload: Parameters<CampoService['updateCampo']>[1]): Observable<Campo> {
    const campo = this.datos.campos.find((c) => c.id === id);
    if (!campo) return fallar('Campo no encontrado.');
    Object.assign(campo, payload);
    for (const m of [...this.datos.pagos, ...this.datos.cheques]) {
      if (m.campo?.id === id) m.campo = { id, nombre: campo.nombre };
    }
    return responder(campo);
  }

  deleteCampo(id: number): Observable<Campo> {
    const campo = this.datos.campos.find((c) => c.id === id);
    if (!campo) return fallar('Campo no encontrado.');
    this.datos.campos = this.datos.campos.filter((c) => c.id !== id);
    this.datos.pagos = this.datos.pagos.filter((p) => p.campo?.id !== id);
    this.datos.cheques = this.datos.cheques.filter((c) => c.campo?.id !== id);
    return responder(campo);
  }

  // ---- Pagos
  getPagos(): Observable<Pago[]> {
    return responder(this.datos.pagos);
  }

  getPagosByCampo(campoId: number): Observable<Pago[]> {
    return responder(
      this.datos.pagos
        .filter((p) => p.campo?.id === campoId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    );
  }

  createPago(payload: Parameters<CampoService['createPago']>[0]): Observable<Pago> {
    const pago: Pago = {
      id: this.siguienteId++,
      fecha: payload.fecha,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      coste: payload.coste,
      anio: payload.anio,
      pagado: payload.pagado ?? true,
      campo: this.campoRef(payload.campo.id),
      categoria: this.categoriaRef(payload.categoria),
    };
    this.datos.pagos.push(pago);
    return responder(pago);
  }

  /** Igual que la función SQL `pago_conjunto`: reparte por tamaño en céntimos (resto mayor). */
  createPagoConjunto(payload: Parameters<CampoService['createPagoConjunto']>[0]): Observable<Pago[]> {
    const campos = this.datos.campos.filter((c) => c.tamano > 0);
    const total = campos.reduce((a, c) => a + Number(c.tamano), 0);
    if (!total) return fallar('No hay campos con tamaño para repartir el pago conjunto.');
    const centimos = Math.round(payload.coste * 100);
    const reparto = campos.map((c) => {
      const exacto = (centimos * Number(c.tamano)) / total;
      return { campo: c, base: Math.floor(exacto), resto: exacto - Math.floor(exacto) };
    });
    let pendiente = centimos - reparto.reduce((a, r) => a + r.base, 0);
    [...reparto].sort((a, b) => b.resto - a.resto).forEach((r) => {
      if (pendiente > 0) {
        r.base++;
        pendiente--;
      }
    });
    const creados = reparto.map(({ campo, base }) => {
      const pago: Pago = {
        id: this.siguienteId++,
        fecha: payload.fecha,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        coste: base / 100,
        anio: payload.anio,
        pagado: payload.pagado ?? true,
        campo: { id: campo.id, nombre: campo.nombre },
        categoria: this.categoriaRef(payload.categoria),
      };
      this.datos.pagos.push(pago);
      return pago;
    });
    return responder(creados);
  }

  updatePago(id: number, payload: Parameters<CampoService['updatePago']>[1]): Observable<Pago> {
    const pago = this.datos.pagos.find((p) => p.id === id);
    if (!pago) return fallar('Pago no encontrado.');
    Object.assign(pago, {
      fecha: payload.fecha,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      coste: payload.coste,
      anio: payload.anio,
      pagado: payload.pagado ?? true,
      categoria: this.categoriaRef(payload.categoria),
    });
    return responder(pago);
  }

  setPagado(id: number, pagado: boolean): Observable<Pago> {
    const pago = this.datos.pagos.find((p) => p.id === id);
    if (!pago) return fallar('Pago no encontrado.');
    pago.pagado = pagado;
    return responder(pago);
  }

  deletePago(id: number): Observable<Pago> {
    const pago = this.datos.pagos.find((p) => p.id === id);
    if (!pago) return fallar('Pago no encontrado.');
    this.datos.pagos = this.datos.pagos.filter((p) => p.id !== id);
    return responder(pago);
  }

  // ---- Cheques (ingresos)
  getCheques(): Observable<Cheque[]> {
    return responder([...this.datos.cheques].sort((a, b) => b.dia.localeCompare(a.dia)));
  }

  getChequesByCampo(campoId: number): Observable<Cheque[]> {
    return responder(
      this.datos.cheques.filter((c) => c.campo?.id === campoId).sort((a, b) => b.dia.localeCompare(a.dia))
    );
  }

  createCheque(payload: Parameters<CampoService['createCheque']>[0]): Observable<Cheque> {
    const cheque: Cheque = {
      id: this.siguienteId++,
      dia: payload.dia,
      cantidad: payload.cantidad,
      anio: payload.anio,
      campo: this.campoRef(payload.campo.id),
    };
    this.datos.cheques.push(cheque);
    return responder(cheque);
  }

  updateCheque(id: number, payload: Parameters<CampoService['updateCheque']>[1]): Observable<Cheque> {
    const cheque = this.datos.cheques.find((c) => c.id === id);
    if (!cheque) return fallar('Ingreso no encontrado.');
    Object.assign(cheque, { dia: payload.dia, cantidad: payload.cantidad, anio: payload.anio });
    if (payload.campo?.id) cheque.campo = this.campoRef(payload.campo.id);
    return responder(cheque);
  }

  deleteCheque(id: number): Observable<Cheque> {
    const cheque = this.datos.cheques.find((c) => c.id === id);
    if (!cheque) return fallar('Ingreso no encontrado.');
    this.datos.cheques = this.datos.cheques.filter((c) => c.id !== id);
    return responder(cheque);
  }

  // ---- Categorías
  getCategorias(): Observable<Categoria[]> {
    return responder([...this.datos.categorias].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  createCategoria(nombre: string, color?: string): Observable<Categoria> {
    const limpio = nombre.trim();
    if (this.datos.categorias.some((c) => c.nombre.toLowerCase() === limpio.toLowerCase())) {
      return fallar('Ya existe un registro con ese valor.');
    }
    const categoria: Categoria = { id: this.siguienteId++, nombre: limpio, color: color || '#8b949e' };
    this.datos.categorias.push(categoria);
    return responder(categoria);
  }

  updateCategoria(id: number, payload: { nombre: string; color?: string }): Observable<Categoria> {
    const categoria = this.datos.categorias.find((c) => c.id === id);
    if (!categoria) return fallar('Categoría no encontrada.');
    categoria.nombre = payload.nombre.trim();
    if (payload.color) categoria.color = payload.color;
    for (const p of this.datos.pagos) {
      if (p.categoria?.id === id) p.categoria = this.categoriaRef(categoria);
    }
    return responder(categoria);
  }

  /** Igual que la función SQL `eliminar_categoria`. */
  deleteCategoria(id: number, accion: 'sin' | 'mover' | 'eliminar' = 'sin', destino?: number): Observable<Categoria> {
    const categoria = this.datos.categorias.find((c) => c.id === id);
    if (!categoria) return fallar('Categoría no encontrada.');
    if (categoria.nombre === 'Sin categoría') return fallar('La categoría «Sin categoría» no se puede eliminar.');
    if (accion === 'eliminar') {
      this.datos.pagos = this.datos.pagos.filter((p) => p.categoria?.id !== id);
    } else {
      const nuevaId = accion === 'mover' ? destino : this.datos.categorias.find((c) => c.nombre === 'Sin categoría')?.id;
      if (accion === 'mover' && (!nuevaId || nuevaId === id)) return fallar('La categoría de destino debe ser distinta.');
      const nueva = this.categoriaRef(nuevaId ? { id: nuevaId } : null);
      for (const p of this.datos.pagos) {
        if (p.categoria?.id === id) p.categoria = nueva;
      }
    }
    this.datos.categorias = this.datos.categorias.filter((c) => c.id !== id);
    return responder(categoria);
  }
}
