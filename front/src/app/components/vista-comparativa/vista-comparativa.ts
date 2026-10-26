import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Campo } from '../../model/campo';
import { Categoria } from '../../model/categoria';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';
import { CampoService } from '../../services/campo/campo.service';
import { redondear2, sumar } from '../../utils/dinero';
import { anioCheque, anioPago, EstadisticasTabsComponent } from './estadisticas-comun';

type FilaCampo = {
  campo: Campo;
  gastos: number;
  ingresos: number;
  beneficio: number;
  beneficioPrevio: number | null;
};
type FilaCategoria = { nombre: string; color: string; total: number; porcentaje: number; previo: number; diferencia: number };

/** Estadísticas de un año, presentadas como mapa mental: el año en el centro y sus ramas alrededor. */
@Component({
  selector: 'app-vista-comparativa',
  imports: [CommonModule, FormsModule, RouterLink, EstadisticasTabsComponent],
  templateUrl: './vista-comparativa.html',
  styleUrl: './vista-comparativa.css',
})
export class VistaComparativaComponent implements OnInit {
  private campoService = inject(CampoService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  campos = signal<Campo[]>([]);
  pagos = signal<Pago[]>([]);
  cheques = signal<Cheque[]>([]);
  categorias = signal<Categoria[]>([]);
  cargando = signal(true);
  error = signal('');

  anioSeleccionado = signal<number>(new Date().getFullYear());
  campoFiltroId = signal<number | null>(null);

  private pagosFiltrados = computed(() => {
    const id = this.campoFiltroId();
    return id === null ? this.pagos() : this.pagos().filter((p) => p.campo?.id === id);
  });

  private chequesFiltrados = computed(() => {
    const id = this.campoFiltroId();
    return id === null ? this.cheques() : this.cheques().filter((c) => c.campo?.id === id);
  });

  anios = computed(() => {
    const set = new Set<number>([new Date().getFullYear(), this.anioSeleccionado()]);
    this.pagos().forEach((p) => { const a = anioPago(p); if (a) set.add(a); });
    this.cheques().forEach((c) => { const a = anioCheque(c); if (a) set.add(a); });
    return Array.from(set).sort((a, b) => b - a);
  });

  private totalesAnio(anio: number) {
    const gastos = sumar(this.pagosFiltrados().filter((p) => anioPago(p) === anio).map((p) => p.coste));
    const ingresos = sumar(this.chequesFiltrados().filter((c) => anioCheque(c) === anio).map((c) => c.cantidad));
    return { gastos, ingresos, beneficio: redondear2(ingresos - gastos) };
  }

  /** Nodo central: totales del año seleccionado. */
  resumen = computed(() => this.totalesAnio(this.anioSeleccionado()));
  resumenPrevio = computed(() => this.totalesAnio(this.anioSeleccionado() - 1));

  totalSuperficie = computed(() => {
    const id = this.campoFiltroId();
    return this.campos()
      .filter((c) => id === null || c.id === id)
      .reduce((acc, c) => acc + Number(c.tamano || 0), 0);
  });

  beneficioPorUnidad = computed(() => {
    const sup = this.totalSuperficie();
    return sup > 0 ? redondear2(this.resumen().beneficio / sup) : 0;
  });

  /** Rama «Campos»: beneficio de cada campo en el año seleccionado. */
  porCampo = computed<FilaCampo[]>(() => {
    const anio = this.anioSeleccionado();
    const id = this.campoFiltroId();
    const totales = (a: number, campoId: number) => {
      const g = sumar(this.pagos().filter((p) => p.campo?.id === campoId && anioPago(p) === a).map((p) => p.coste));
      const i = sumar(this.cheques().filter((c) => c.campo?.id === campoId && anioCheque(c) === a).map((c) => c.cantidad));
      return { gastos: g, ingresos: i, beneficio: redondear2(i - g) };
    };
    const hayPrevio = this.anios().includes(anio - 1);
    return this.campos()
      .filter((campo) => id === null || campo.id === id)
      .map((campo) => ({
        campo,
        ...totales(anio, campo.id),
        beneficioPrevio: hayPrevio ? totales(anio - 1, campo.id).beneficio : null,
      }))
      .sort((a, b) => b.beneficio - a.beneficio);
  });

  /** Rama «Ingresos»: solo los campos que han ingresado algo. */
  ingresosPorCampo = computed(() =>
    this.porCampo().filter((f) => f.ingresos > 0).sort((a, b) => b.ingresos - a.ingresos)
  );

  /** Rama «Gastos»: gastos por categoría del año frente al anterior. */
  porCategoria = computed<FilaCategoria[]>(() => {
    const anio = this.anioSeleccionado();
    const pagos = this.pagosFiltrados();
    const nombreDe = (p: Pago) => p.categoria?.nombre || 'Sin categoría';
    const colorDe = (nombre: string) => this.categorias().find((c) => c.nombre === nombre)?.color || '#8b949e';

    const acumular = (a: number) => {
      const m = new Map<string, number>();
      pagos.filter((p) => anioPago(p) === a).forEach((p) => {
        m.set(nombreDe(p), (m.get(nombreDe(p)) || 0) + Number(p.coste || 0));
      });
      return m;
    };
    const actual = acumular(anio);
    const previo = acumular(anio - 1);
    const total = Array.from(actual.values()).reduce((x, y) => x + y, 0);

    return Array.from(actual.keys())
      .map((nombre) => {
        const t = redondear2(actual.get(nombre) || 0);
        const p = redondear2(previo.get(nombre) || 0);
        return {
          nombre,
          color: colorDe(nombre),
          total: t,
          porcentaje: total > 0 ? Math.round((t / total) * 1000) / 10 : 0,
          previo: p,
          diferencia: redondear2(t - p),
        };
      })
      .sort((a, b) => b.total - a.total);
  });

  /** Rama «Pendiente de pagar»: pagos del año sin pagar del todo. */
  pendientes = computed(() =>
    this.pagosFiltrados()
      .filter((p) => p.pagado === false && anioPago(p) === this.anioSeleccionado())
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  );
  totalPendiente = computed(() => sumar(this.pendientes().map((p) => p.coste)));

  hayDatos = computed(() => this.pagos().length > 0 || this.cheques().length > 0);

  cambiarAnio(delta: number): void {
    this.anioSeleccionado.set(this.anioSeleccionado() + delta);
  }

  ngOnInit(): void {
    // ?anio=2024 (p. ej. al pulsar un año en «Entre años») abre el mapa de ese año
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const anio = Number(params.get('anio'));
      if (anio >= 1989 && anio <= 2100) this.anioSeleccionado.set(anio);
    });
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
      cheques: this.campoService.getCheques(),
      categorias: this.campoService.getCategorias().pipe(catchError(() => of([] as Categoria[]))),
    }).subscribe({
      next: ({ campos, pagos, cheques, categorias }) => {
        this.campos.set(campos);
        this.pagos.set(pagos);
        this.cheques.set(cheques);
        this.categorias.set(categorias);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message);
        this.cargando.set(false);
      },
    });
  }
}
