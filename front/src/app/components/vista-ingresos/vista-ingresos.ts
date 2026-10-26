import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Campo } from '../../model/campo';
import { Cheque } from '../../model/cheque';
import { CampoService } from '../../services/campo/campo.service';
import { sumar } from '../../utils/dinero';

@Component({
  selector: 'app-vista-ingresos',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vista-ingresos.html',
  styleUrl: './vista-ingresos.css',
})
export class VistaIngresosComponent implements OnInit {
  private campoService = inject(CampoService);

  campos = signal<Campo[]>([]);
  cheques = signal<Cheque[]>([]);
  cargando = signal(true);
  error = signal('');

  anioSeleccionado = signal<number>(new Date().getFullYear());
  campoFiltroId = signal<number | null>(null);
  ordenPor = signal<'dia' | 'cantidad'>('dia');
  ordenAscendente = signal(false);
  paginaActual = signal(1);
  registrosPorPagina = 10;

  // Formulario (alta / edición)
  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);
  campoFormularioId = signal<number | null>(null);
  guardando = signal(false);
  mensaje = signal('');
  nuevoCheque = { dia: '', anio: null as number | null, cantidad: null as number | null };

  // Confirmación de borrado
  chequeAEliminar = signal<Cheque | null>(null);
  eliminando = signal(false);
  errorEliminar = signal('');

  private anioDe(c: Cheque): number | null {
    if (c.anio) return Number(c.anio);
    const a = new Date(c.dia).getFullYear();
    return Number.isNaN(a) ? null : a;
  }

  anosDisponibles = computed(() => {
    const anos = new Set<number>([new Date().getFullYear()]);
    this.cheques().forEach((c) => {
      const a = this.anioDe(c);
      if (a) anos.add(a);
    });
    return Array.from(anos).sort((a, b) => b - a);
  });

  chequesFiltrados = computed(() => {
    const anio = this.anioSeleccionado();
    const campoId = this.campoFiltroId();
    const asc = this.ordenAscendente();
    const por = this.ordenPor();
    return this.cheques()
      .filter((c) => this.anioDe(c) === anio && (campoId === null || c.campo?.id === campoId))
      .sort((a, b) => {
        const av = por === 'dia' ? new Date(a.dia).getTime() : Number(a.cantidad || 0);
        const bv = por === 'dia' ? new Date(b.dia).getTime() : Number(b.cantidad || 0);
        return asc ? av - bv : bv - av;
      });
  });

  chequesEnPagina = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.registrosPorPagina;
    return this.chequesFiltrados().slice(inicio, inicio + this.registrosPorPagina);
  });

  totalPaginas = computed(() => Math.ceil(this.chequesFiltrados().length / this.registrosPorPagina));
  totalIngresos = computed(() => sumar(this.chequesFiltrados().map((c) => c.cantidad)));

  ngOnInit(): void {
    this.cargarDatos();
  }

  reintentar(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.error.set('');
    forkJoin({ campos: this.campoService.getCampos(), cheques: this.campoService.getCheques() }).subscribe({
      next: ({ campos, cheques }) => {
        this.campos.set(campos);
        this.cheques.set(cheques);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message);
        this.cargando.set(false);
      },
    });
  }

  nombreCampo(c: Cheque): string {
    return c.campo?.nombre || this.campos().find((x) => x.id === c.campo?.id)?.nombre || '—';
  }

  onAnioChange(anio: number): void {
    this.anioSeleccionado.set(Number(anio));
    this.paginaActual.set(1);
  }

  onCampoFiltroChange(id: number | null): void {
    this.campoFiltroId.set(id === null ? null : Number(id));
    this.paginaActual.set(1);
  }

  cambiarOrden(col: 'dia' | 'cantidad'): void {
    if (this.ordenPor() === col) {
      this.ordenAscendente.set(!this.ordenAscendente());
    } else {
      this.ordenPor.set(col);
      this.ordenAscendente.set(col === 'dia' ? false : true);
    }
    this.paginaActual.set(1);
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) this.paginaActual.set(this.paginaActual() - 1);
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) this.paginaActual.set(this.paginaActual() + 1);
  }

  private fechaInput(f: string): string {
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return String(f).slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  abrirFormulario(): void {
    this.editandoId.set(null);
    this.campoFormularioId.set(this.campoFiltroId());
    this.nuevoCheque = {
      dia: new Date().toISOString().split('T')[0],
      anio: this.anioSeleccionado(),
      cantidad: null,
    };
    this.mensaje.set('');
    this.mostrarFormulario.set(true);
  }

  editar(c: Cheque): void {
    this.editandoId.set(c.id);
    this.campoFormularioId.set(c.campo?.id ?? null);
    this.nuevoCheque = { dia: this.fechaInput(c.dia), anio: c.anio ?? null, cantidad: c.cantidad };
    this.mensaje.set('');
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    this.mostrarFormulario.set(false);
    this.editandoId.set(null);
    this.mensaje.set('');
  }

  guardar(): void {
    const campoId = this.campoFormularioId();
    if (!campoId) {
      this.mensaje.set('Selecciona un campo.');
      return;
    }
    if (!this.nuevoCheque.dia || this.nuevoCheque.cantidad === null || Number(this.nuevoCheque.cantidad) <= 0) {
      this.mensaje.set('Indica el día y una cantidad mayor que 0.');
      return;
    }

    const payload = {
      dia: this.nuevoCheque.dia,
      cantidad: Number(this.nuevoCheque.cantidad),
      anio: this.nuevoCheque.anio ? Number(this.nuevoCheque.anio) : new Date(this.nuevoCheque.dia).getFullYear(),
      campo: { id: campoId },
    };

    this.guardando.set(true);
    const id = this.editandoId();
    const req = id ? this.campoService.updateCheque(id, payload) : this.campoService.createCheque(payload);
    req.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarFormulario();
        this.cargarDatos();
      },
      error: (e: Error) => {
        this.guardando.set(false);
        this.mensaje.set(`No se pudo guardar el ingreso. ${e.message}`);
      },
    });
  }

  chequeEnEdicion(): Cheque {
    return this.cheques().find((c) => c.id === this.editandoId())!;
  }

  pedirEliminar(c: Cheque): void {
    this.errorEliminar.set('');
    this.chequeAEliminar.set(c);
  }

  cancelarEliminar(): void {
    if (!this.eliminando()) this.chequeAEliminar.set(null);
  }

  confirmarEliminar(): void {
    const c = this.chequeAEliminar();
    if (!c) return;
    this.eliminando.set(true);
    this.campoService.deleteCheque(c.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.chequeAEliminar.set(null);
        this.cerrarFormulario();
        this.cargarDatos();
      },
      error: (e: Error) => {
        this.eliminando.set(false);
        this.errorEliminar.set(`No se pudo eliminar el ingreso. ${e.message}`);
      },
    });
  }
}
