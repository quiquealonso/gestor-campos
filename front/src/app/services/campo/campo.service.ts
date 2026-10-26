import { inject, Injectable } from '@angular/core';
import { defer, map, Observable } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import { Campo } from '../../model/campo';
import { Pago } from '../../model/pago';
import { Cheque } from '../../model/cheque';
import { Categoria } from '../../model/categoria';

type CampoPayload = {
  nombre: string;
  tamano: number;
  poligono: number;
  parcela: number;
};

type PagoPayload = {
  fecha: string;
  nombre: string;
  descripcion: string;
  coste: number;
  anio?: number;
  categoria?: { id: number } | null;
  pagado?: boolean;
};

type CrearPagoPayload = PagoPayload & { campo: { id: number } };
type CrearPagoConjuntoPayload = PagoPayload;

type ChequePayload = {
  dia: string;
  cantidad: number;
  anio?: number;
};
type CrearChequePayload = ChequePayload & { campo: { id: number } };

/** Convierte cualquier fallo (Supabase, red…) en un mensaje legible para el usuario. */
export function mensajeDeError(err: any): string {
  const msg = String(err?.message ?? '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'No se puede conectar con el servidor. Revisa tu conexión a Internet.';
  }
  switch (err?.code) {
    case '23514':
      return 'Algún dato no es válido (por ejemplo, un importe negativo, un campo vacío o un año fuera de rango).';
    case '23505':
      return 'Ya existe un registro con ese valor.';
    case '23503':
      return 'El campo o la categoría indicados ya no existen.';
    case '42501':
      return 'No tienes permiso para esta operación. Vuelve a iniciar sesión.';
    case 'PGRST301':
      return 'La sesión ha caducado. Vuelve a iniciar sesión.';
  }
  if (/row-level security/i.test(msg)) return 'No tienes permiso para esta operación. Vuelve a iniciar sesión.';
  if (/jwt/i.test(msg)) return 'La sesión ha caducado. Vuelve a iniciar sesión.';
  return msg || 'Error inesperado.';
}

const SELECT_PAGO = '*, campo:campo(id, nombre), categoria:categoria(id, nombre, color)';
const SELECT_CHEQUE = '*, campo:campo(id, nombre)';

type Respuesta<T> = { data: T | null; error: any };

@Injectable({
  providedIn: 'root',
})
export class CampoService {
  private db = inject(SupabaseService).client;

  /** Ejecuta una consulta de Supabase y la expone como Observable (error -> Error legible). */
  private run<T>(consulta: () => PromiseLike<Respuesta<T>>): Observable<T> {
    return defer(async () => {
      let res: Respuesta<T>;
      try {
        res = await consulta();
      } catch (e) {
        throw new Error(mensajeDeError(e));
      }
      if (res.error) throw new Error(mensajeDeError(res.error));
      return res.data as T;
    });
  }

  // ---- Campos
  getCampos(): Observable<Campo[]> {
    return this.run<Campo[]>(() => this.db.from('campo').select('*').order('id')).pipe(map((r) => r || []));
  }

  getCampoById(id: number): Observable<Campo | null> {
    return defer(async () => {
      const [campo, pagos, cheques] = await Promise.all([
        this.db.from('campo').select('*').eq('id', id).maybeSingle(),
        this.db.from('pago').select('id', { count: 'exact', head: true }).eq('campoId', id),
        this.db.from('cheque').select('id', { count: 'exact', head: true }).eq('campoId', id),
      ]);
      if (campo.error) throw new Error(mensajeDeError(campo.error));
      if (!campo.data) return null;
      return { ...(campo.data as Campo), numPagos: pagos.count ?? 0, numCheques: cheques.count ?? 0 };
    });
  }

  createCampo(payload: CampoPayload): Observable<Campo> {
    return this.run<Campo>(() => this.db.from('campo').insert(payload).select().single());
  }

  updateCampo(id: number, payload: CampoPayload): Observable<Campo> {
    return this.run<Campo>(() => this.db.from('campo').update(payload).eq('id', id).select().single());
  }

  deleteCampo(id: number): Observable<Campo> {
    return this.run<Campo>(() => this.db.from('campo').delete().eq('id', id).select().single());
  }

  // ---- Pagos
  private aFilaPago(p: PagoPayload): Record<string, unknown> {
    return {
      fecha: p.fecha,
      nombre: p.nombre,
      descripcion: p.descripcion,
      coste: p.coste,
      anio: p.anio ?? null,
      categoriaId: p.categoria?.id ?? null,
      pagado: p.pagado ?? true,
    };
  }

  getPagos(): Observable<Pago[]> {
    return this.run<Pago[]>(() => this.db.from('pago').select(SELECT_PAGO)).pipe(map((r) => r || []));
  }

  getPagosByCampo(campoId: number): Observable<Pago[]> {
    return this.run<Pago[]>(() =>
      this.db.from('pago').select(SELECT_PAGO).eq('campoId', campoId).order('fecha', { ascending: false })
    ).pipe(map((r) => r || []));
  }

  createPago(payload: CrearPagoPayload): Observable<Pago> {
    return this.run<Pago>(() =>
      this.db.from('pago').insert({ ...this.aFilaPago(payload), campoId: payload.campo.id }).select(SELECT_PAGO).single()
    );
  }

  /** Reparte el coste entre todos los campos según su tamaño (función SQL `pago_conjunto`). */
  createPagoConjunto(payload: CrearPagoConjuntoPayload): Observable<Pago[]> {
    return this.run<Pago[]>(() =>
      this.db.rpc('pago_conjunto', {
        p_fecha: payload.fecha,
        p_nombre: payload.nombre,
        p_descripcion: payload.descripcion,
        p_coste: payload.coste,
        p_anio: payload.anio ?? null,
        p_categoria_id: payload.categoria?.id ?? null,
        p_pagado: payload.pagado ?? true,
      })
    ).pipe(map((r) => r || []));
  }

  updatePago(id: number, payload: PagoPayload): Observable<Pago> {
    return this.run<Pago>(() =>
      this.db.from('pago').update(this.aFilaPago(payload)).eq('id', id).select(SELECT_PAGO).single()
    );
  }

  /** Marca un pago como pagado del todo o pendiente, sin tocar el resto de datos. */
  setPagado(id: number, pagado: boolean): Observable<Pago> {
    return this.run<Pago>(() => this.db.from('pago').update({ pagado }).eq('id', id).select(SELECT_PAGO).single());
  }

  deletePago(id: number): Observable<Pago> {
    return this.run<Pago>(() => this.db.from('pago').delete().eq('id', id).select().single());
  }

  // ---- Cheques (ingresos)
  private aFilaCheque(c: ChequePayload): Record<string, unknown> {
    return { dia: c.dia, cantidad: c.cantidad, anio: c.anio ?? null };
  }

  getCheques(): Observable<Cheque[]> {
    return this.run<Cheque[]>(() =>
      this.db.from('cheque').select(SELECT_CHEQUE).order('dia', { ascending: false })
    ).pipe(map((r) => r || []));
  }

  getChequesByCampo(campoId: number): Observable<Cheque[]> {
    return this.run<Cheque[]>(() =>
      this.db.from('cheque').select(SELECT_CHEQUE).eq('campoId', campoId).order('dia', { ascending: false })
    ).pipe(map((r) => r || []));
  }

  createCheque(payload: CrearChequePayload): Observable<Cheque> {
    return this.run<Cheque>(() =>
      this.db.from('cheque').insert({ ...this.aFilaCheque(payload), campoId: payload.campo.id }).select(SELECT_CHEQUE).single()
    );
  }

  updateCheque(id: number, payload: ChequePayload & { campo?: { id: number } }): Observable<Cheque> {
    const fila: Record<string, unknown> = this.aFilaCheque(payload);
    if (payload.campo?.id) fila['campoId'] = payload.campo.id;
    return this.run<Cheque>(() => this.db.from('cheque').update(fila).eq('id', id).select(SELECT_CHEQUE).single());
  }

  deleteCheque(id: number): Observable<Cheque> {
    return this.run<Cheque>(() => this.db.from('cheque').delete().eq('id', id).select().single());
  }

  // ---- Categorías
  getCategorias(): Observable<Categoria[]> {
    return this.run<Categoria[]>(() => this.db.from('categoria').select('*').order('nombre')).pipe(map((r) => r || []));
  }

  createCategoria(nombre: string, color?: string): Observable<Categoria> {
    return this.run<Categoria>(() =>
      this.db.from('categoria').insert(color ? { nombre: nombre.trim(), color } : { nombre: nombre.trim() }).select().single()
    );
  }

  updateCategoria(id: number, payload: { nombre: string; color?: string }): Observable<Categoria> {
    const fila = payload.color ? { nombre: payload.nombre.trim(), color: payload.color } : { nombre: payload.nombre.trim() };
    return this.run<Categoria>(() => this.db.from('categoria').update(fila).eq('id', id).select().single());
  }

  /** accion: 'sin' (pagos a «Sin categoría»), 'mover' (a `destino`) o 'eliminar' (borra también sus pagos) */
  deleteCategoria(id: number, accion: 'sin' | 'mover' | 'eliminar' = 'sin', destino?: number): Observable<Categoria> {
    return this.run<Categoria>(() =>
      this.db.rpc('eliminar_categoria', { p_id: id, p_accion: accion, p_destino: destino ?? null })
    );
  }
}
