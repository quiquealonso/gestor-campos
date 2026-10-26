import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Campo } from '../../model/campo';
import { Pago } from '../../model/pago';
import { Categoria } from '../../model/categoria';
import { CategoriaSelectComponent } from '../categoria-select/categoria-select';
import { catchError, of } from 'rxjs';
import { CampoService } from '../../services/campo/campo.service';
import { sumar } from '../../utils/dinero';

@Component({
  selector: 'app-vista-gastos',
  imports: [CommonModule, FormsModule, RouterLink, CategoriaSelectComponent],
  templateUrl: './vista-gastos.html',
  styleUrl: './vista-gastos.css',
})
export class VistaGastosComponent implements OnInit {
  private campoService = inject(CampoService);

  campos = signal<Campo[]>([]);
  categorias = signal<Categoria[]>([]);
  categoriaFormularioId = signal<number | null>(null);
  pagos = signal<Pago[]>([]);
  campoFormularioId = signal<number | null>(null);
  /** null = todas · -1 = pagos sin categoría asignada · otro = id de categoría */
  categoriaFiltroId = signal<number | null>(null);
  estadoFiltro = signal<'todos' | 'pendientes' | 'pagados'>('todos');
  cargando = signal(true);
  error = signal('');
  editandoPagoId = signal<number | null>(null);
  mostrarFormulario = signal(false);
  guardandoPago = signal(false);
  eliminandoPago = signal(false);
  pagoAEliminar = signal<Pago | null>(null);
  mensajePago = signal('');
  anioSeleccionado = signal<number>(new Date().getFullYear());
  ordenPor = signal<'fecha' | 'coste'>('fecha');
  ordenAscendente = signal(false); // por defecto, la fecha más reciente primero
  paginaActual = signal(1);
  registrosPorPagina = 10;

  nuevoPago = {
    fecha: '',
    anio: null as number | null,
    nombre: '',
    descripcion: '',
    coste: null as number | null,
    pagado: true,
  };

  anosDisponibles = computed(() => {
    const anos = new Set<number>();
    anos.add(new Date().getFullYear());

    this.pagos().forEach((pago) => {
      if (pago.anio) {
        anos.add(pago.anio);
      } else if (pago.fecha) {
        anos.add(new Date(pago.fecha).getFullYear());
      }
    });

    return Array.from(anos).sort((a, b) => b - a);
  });

  pagosFiltrados = computed(() => {
    const anoSel = this.anioSeleccionado();
    let resultado = this.pagos().filter((pago) => {
      const ano = pago.anio || (pago.fecha ? new Date(pago.fecha).getFullYear() : null);
      return ano === anoSel;
    });

    const catSel = this.categoriaFiltroId();
    if (catSel !== null) {
      resultado = resultado.filter((pago) =>
        catSel === -1 ? !pago.categoria : pago.categoria?.id === catSel
      );
    }

    const estado = this.estadoFiltro();
    if (estado !== 'todos') {
      resultado = resultado.filter((pago) => (estado === 'pagados') === (pago.pagado !== false));
    }

    const ordenPor = this.ordenPor();
    const ascendente = this.ordenAscendente();
    resultado = [...resultado].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (ordenPor === 'fecha') {
        aVal = new Date(a.fecha).getTime();
        bVal = new Date(b.fecha).getTime();
      } else {
        aVal = Number(a.coste || 0);
        bVal = Number(b.coste || 0);
      }

      return ascendente ? aVal - bVal : bVal - aVal;
    });

    return resultado;
  });

  pagosEnPagina = computed(() => {
    const pagos = this.pagosFiltrados();
    const inicio = (this.paginaActual() - 1) * this.registrosPorPagina;
    const fin = inicio + this.registrosPorPagina;
    return pagos.slice(inicio, fin);
  });

  totalPaginas = computed(() => {
    return Math.ceil(this.pagosFiltrados().length / this.registrosPorPagina);
  });

  numeroPaginas = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  /** Importe aún pendiente de pagar entre los gastos filtrados. */
  totalPendiente = computed(() => sumar(this.pagosFiltrados().filter((p) => p.pagado === false).map((p) => p.coste)));

  totalGastos = computed(() =>
    this.pagosFiltrados().reduce((acc, pago) => acc + Number(pago.coste || 0), 0)
  );

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
      campos: this.campoService.getCampos(),
      pagos: this.campoService.getPagos(),
      categorias: this.campoService.getCategorias().pipe(catchError(() => of([] as Categoria[]))),
    }).subscribe({
      next: ({ campos, pagos, categorias }) => {
        this.campos.set(campos);
        this.categorias.set(categorias);
        this.pagos.set(pagos);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(`No se pudieron cargar los datos. ${e.message}`);
        this.cargando.set(false);
      },
    });
  }

  private formatFechaInput(fecha: string | null | undefined): string {
    if (!fecha) {
      return '';
    }

    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) {
      return String(fecha).slice(0, 10);
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onAnioSeleccionadoChange(anio: number): void {
    this.anioSeleccionado.set(Number(anio));
    this.paginaActual.set(1);
  }

  onCategoriaFiltroChange(id: number | null): void {
    this.categoriaFiltroId.set(id === null ? null : Number(id));
    this.paginaActual.set(1);
  }

  cambiarOrden(columna: 'fecha' | 'coste'): void {
    if (this.ordenPor() === columna) {
      this.ordenAscendente.set(!this.ordenAscendente());
    } else {
      this.ordenPor.set(columna);
      this.ordenAscendente.set(columna !== 'fecha');
    }
    this.paginaActual.set(1);
  }

  irAPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.paginaActual.set(pagina);
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.set(this.paginaActual() - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.set(this.paginaActual() + 1);
    }
  }

  abrirFormularioPago(): void {
    this.mostrarFormulario.set(true);
    if (!this.editandoPagoId()) {
      const today = new Date().toISOString().split('T')[0];
      this.nuevoPago = {
        fecha: today,
        anio: this.anioSeleccionado(),
        nombre: '',
        descripcion: '',
        coste: null,
        pagado: true,
      };
      this.campoFormularioId.set(null);
      this.categoriaFormularioId.set(this.categorias().find((c) => c.nombre === 'Sin categoría')?.id ?? null);
    }
    this.mensajePago.set('');
  }

  cerrarFormularioPago(): void {
    this.cancelarEdicion();
  }

  guardarPago(): void {
    const campoId = this.campoFormularioId();
    if (!this.editandoPagoId() && !campoId) {
      this.mensajePago.set('Selecciona un campo.');
      return;
    }

    if (
      !this.nuevoPago.fecha ||
      !this.nuevoPago.nombre.trim() ||
      this.nuevoPago.coste === null
    ) {
      this.mensajePago.set('Completa todos los datos obligatorios.');
      return;
    }

    if (Number(this.nuevoPago.coste) <= 0) {
      this.mensajePago.set('El coste debe ser mayor que 0.');
      return;
    }

    const pagoPayload = {
      fecha: this.nuevoPago.fecha,
      anio: this.nuevoPago.anio === null ? undefined : Number(this.nuevoPago.anio),
      nombre: this.nuevoPago.nombre.trim(),
      descripcion: this.nuevoPago.descripcion.trim(),
      coste: Number(this.nuevoPago.coste),
      categoria: this.categoriaFormularioId() ? { id: this.categoriaFormularioId()! } : null,
      pagado: this.nuevoPago.pagado,
    };

    this.guardandoPago.set(true);

    const pagoRequest = this.editandoPagoId()
      ? this.campoService.updatePago(this.editandoPagoId()!, pagoPayload)
      : this.campoService.createPago({ ...pagoPayload, campo: { id: campoId! } });

    pagoRequest.subscribe({
      next: (pagoCreado) => {
        this.guardandoPago.set(false);
        if (!pagoCreado) {
          this.mensajePago.set('No se pudo guardar el pago.');
          return;
        }

        this.mensajePago.set('Pago guardado correctamente.');
        this.cancelarEdicion();
        this.cargarDatos();
      },
      error: (e: Error) => {
        this.guardandoPago.set(false);
        this.mensajePago.set(`Error al guardar el pago. ${e.message}`);
      },
    });
  }

  editarPago(pago: Pago): void {
    this.editandoPagoId.set(pago.id);
    this.campoFormularioId.set(pago.campo?.id ?? null);
    this.categoriaFormularioId.set(pago.categoria?.id ?? null);
    this.nuevoPago = {
      fecha: this.formatFechaInput(pago.fecha),
      anio: pago.anio || null,
      nombre: pago.nombre,
      descripcion: pago.descripcion,
      coste: pago.coste,
      pagado: pago.pagado !== false,
    };
    this.mostrarFormulario.set(true);
    this.mensajePago.set('');
  }

  cancelarEdicion(): void {
    this.editandoPagoId.set(null);
    this.eliminandoPago.set(false);
    this.campoFormularioId.set(null);
    this.categoriaFormularioId.set(null);
    this.nuevoPago = {
      fecha: '',
      anio: null,
      nombre: '',
      descripcion: '',
      coste: null,
      pagado: true,
    };
    this.mostrarFormulario.set(false);
    this.mensajePago.set('');
  }

  eliminarPagoEnEdicion(): void {
    const pagoId = this.editandoPagoId();
    if (!pagoId) {
      return;
    }

    const pago = this.pagos().find((item) => item.id === pagoId);
    if (!pago) {
      this.mensajePago.set('No se encontró el pago a eliminar.');
      return;
    }

    this.eliminarPago(pago);
  }

  eliminarPago(pago: Pago): void {
    this.pagoAEliminar.set(pago);
  }

  cancelarEliminacion(): void {
    if (this.eliminandoPago()) return;
    this.pagoAEliminar.set(null);
  }

  confirmarEliminacion(): void {
    const pago = this.pagoAEliminar();
    if (!pago) return;

    this.eliminandoPago.set(true);
    this.campoService.deletePago(pago.id).subscribe({
      next: (pagoEliminado) => {
        this.eliminandoPago.set(false);
        this.pagoAEliminar.set(null);
        if (!pagoEliminado) {
          this.mensajePago.set('No se pudo eliminar el pago.');
          return;
        }

        this.cancelarEdicion();
        this.cargarDatos();
      },
      error: (e: Error) => {
        this.eliminandoPago.set(false);
        this.pagoAEliminar.set(null);
        this.mensajePago.set(`Error al eliminar el pago. ${e.message}`);
      },
    });
  }
}
