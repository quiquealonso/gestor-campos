import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Categoria } from '../../model/categoria';
import { Pago } from '../../model/pago';
import { CampoService } from '../../services/campo/campo.service';
import { sumar } from '../../utils/dinero';

type FilaCategoria = {
  id: number; // -1 = pagos sin categoría asignada (no editable)
  nombre: string;
  color: string;
  pagos: Pago[];
  total: number;
  protegida: boolean;
};

const SIN_ASIGNAR = -1;

@Component({
  selector: 'app-vista-categorias',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vista-categorias.html',
  styleUrl: './vista-categorias.css',
})
export class VistaCategoriasComponent implements OnInit {
  private campoService = inject(CampoService);

  readonly SIN_ASIGNAR = SIN_ASIGNAR;
  readonly PAGINA = 10;

  categorias = signal<Categoria[]>([]);
  pagos = signal<Pago[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  expandida = signal<number | null>(null);
  visibles = signal(this.PAGINA);

  filas = computed<FilaCategoria[]>(() => {
    const pagos = this.pagos();
    const filas = this.categorias().map((c) => {
      const propios = pagos.filter((p) => p.categoria?.id === c.id);
      return {
        id: c.id,
        nombre: c.nombre,
        color: c.color,
        pagos: propios,
        total: sumar(propios.map((p) => p.coste)),
        protegida: c.nombre === 'Sin categoría',
      };
    });
    const huerfanos = pagos.filter((p) => !p.categoria);
    if (huerfanos.length) {
      filas.push({
        id: SIN_ASIGNAR,
        nombre: 'Sin asignar',
        color: '#5d6b7a',
        pagos: huerfanos,
        total: sumar(huerfanos.map((p) => p.coste)),
        protegida: true,
      });
    }
    return filas;
  });

  totalGastos = computed(() => sumar(this.pagos().map((p) => p.coste)));

  // ---- Diálogo crear / editar categoría
  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);
  formNombre = '';
  formColor = '#58a6ff';
  guardando = signal(false);
  mensajeForm = signal('');

  // ---- Diálogo eliminar categoría
  categoriaAEliminar = signal<FilaCategoria | null>(null);
  accionEliminar: 'sin' | 'mover' | 'eliminar' = 'sin';
  destinoEliminar: number | null = null;
  eliminandoCategoria = signal(false);
  errorEliminarCategoria = signal('');

  // ---- Diálogo eliminar pago
  pagoAEliminar = signal<Pago | null>(null);
  eliminandoPago = signal(false);
  errorEliminarPago = signal('');

  movimiento = signal<number | null>(null); // id del pago que se está moviendo

  ngOnInit(): void {
    this.cargarDatos();
  }

  reintentar(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.error.set('');
    forkJoin({
      categorias: this.campoService.getCategorias(),
      pagos: this.campoService.getPagos(),
    }).subscribe({
      next: ({ categorias, pagos }) => {
        this.categorias.set(categorias);
        this.pagos.set(pagos);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message);
        this.cargando.set(false);
      },
    });
  }

  private refrescar(): void {
    forkJoin({
      categorias: this.campoService.getCategorias(),
      pagos: this.campoService.getPagos(),
    }).subscribe({
      next: ({ categorias, pagos }) => {
        this.categorias.set(categorias);
        this.pagos.set(pagos);
      },
      error: (e: Error) => this.error.set(e.message),
    });
  }

  alternar(fila: FilaCategoria): void {
    this.visibles.set(this.PAGINA);
    this.expandida.set(this.expandida() === fila.id ? null : fila.id);
  }

  pagosOrdenados(fila: FilaCategoria): Pago[] {
    return [...fila.pagos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  // ---------- crear / editar categoría
  abrirNueva(): void {
    this.editandoId.set(null);
    this.formNombre = '';
    this.formColor = '#58a6ff';
    this.mensajeForm.set('');
    this.mostrarFormulario.set(true);
  }

  abrirEditar(fila: FilaCategoria): void {
    this.editandoId.set(fila.id);
    this.formNombre = fila.nombre;
    this.formColor = fila.color;
    this.mensajeForm.set('');
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.mostrarFormulario.set(false);
  }

  guardarCategoria(): void {
    const nombre = this.formNombre.trim();
    if (!nombre) {
      this.mensajeForm.set('Escribe un nombre.');
      return;
    }
    this.guardando.set(true);
    const id = this.editandoId();
    const req = id
      ? this.campoService.updateCategoria(id, { nombre, color: this.formColor })
      : this.campoService.createCategoria(nombre, this.formColor);
    req.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);
        this.aviso.set(id ? 'Categoría actualizada.' : 'Categoría creada.');
        this.refrescar();
      },
      error: (e: Error) => {
        this.guardando.set(false);
        this.mensajeForm.set(e.message);
      },
    });
  }

  // ---------- eliminar categoría
  pedirEliminarCategoria(fila: FilaCategoria): void {
    this.accionEliminar = 'sin';
    this.destinoEliminar = this.categorias().find((c) => c.id !== fila.id && c.nombre !== 'Sin categoría')?.id ?? null;
    this.errorEliminarCategoria.set('');
    this.categoriaAEliminar.set(fila);
  }

  otrasCategorias(fila: FilaCategoria): Categoria[] {
    return this.categorias().filter((c) => c.id !== fila.id);
  }

  cancelarEliminarCategoria(): void {
    if (!this.eliminandoCategoria()) this.categoriaAEliminar.set(null);
  }

  confirmarEliminarCategoria(): void {
    const fila = this.categoriaAEliminar();
    if (!fila) return;
    if (this.accionEliminar === 'mover' && !this.destinoEliminar) {
      this.errorEliminarCategoria.set('Elige la categoría de destino.');
      return;
    }
    this.eliminandoCategoria.set(true);
    this.campoService
      .deleteCategoria(fila.id, this.accionEliminar, this.destinoEliminar ?? undefined)
      .subscribe({
        next: () => {
          this.eliminandoCategoria.set(false);
          this.categoriaAEliminar.set(null);
          if (this.expandida() === fila.id) this.expandida.set(null);
          this.aviso.set(`Categoría «${fila.nombre}» eliminada.`);
          this.refrescar();
        },
        error: (e: Error) => {
          this.eliminandoCategoria.set(false);
          this.errorEliminarCategoria.set(e.message);
        },
      });
  }

  // ---------- pagos asociados
  moverPago(pago: Pago, destino: number | null): void {
    this.movimiento.set(pago.id);
    this.campoService
      .updatePago(pago.id, {
        fecha: pago.fecha,
        nombre: pago.nombre,
        descripcion: pago.descripcion,
        coste: pago.coste,
        anio: pago.anio ?? undefined,
        categoria: destino ? { id: Number(destino) } : null,
      })
      .subscribe({
        next: () => {
          this.movimiento.set(null);
          this.aviso.set('Pago movido de categoría.');
          this.refrescar();
        },
        error: (e: Error) => {
          this.movimiento.set(null);
          this.error.set(`No se pudo mover el pago. ${e.message}`);
        },
      });
  }

  pedirEliminarPago(pago: Pago): void {
    this.errorEliminarPago.set('');
    this.pagoAEliminar.set(pago);
  }

  cancelarEliminarPago(): void {
    if (!this.eliminandoPago()) this.pagoAEliminar.set(null);
  }

  confirmarEliminarPago(): void {
    const pago = this.pagoAEliminar();
    if (!pago) return;
    this.eliminandoPago.set(true);
    this.campoService.deletePago(pago.id).subscribe({
      next: () => {
        this.eliminandoPago.set(false);
        this.pagoAEliminar.set(null);
        this.aviso.set('Pago eliminado.');
        this.refrescar();
      },
      error: (e: Error) => {
        this.eliminandoPago.set(false);
        this.errorEliminarPago.set(`No se pudo eliminar el pago. ${e.message}`);
      },
    });
  }
}
