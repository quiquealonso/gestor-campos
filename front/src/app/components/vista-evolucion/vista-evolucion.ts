import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Campo } from '../../model/campo';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';
import { CampoService } from '../../services/campo/campo.service';
import { redondear2, sumar } from '../../utils/dinero';
import { anioCheque, anioPago, EstadisticasTabsComponent } from '../vista-comparativa/estadisticas-comun';

type FilaAnual = { anio: number; gastos: number; ingresos: number; beneficio: number; varBeneficio: number | null };

/** Estadísticas · Entre años: solo la evolución de gastos, ingresos y beneficio año a año. */
@Component({
  selector: 'app-vista-evolucion',
  imports: [CommonModule, FormsModule, RouterLink, EstadisticasTabsComponent],
  templateUrl: './vista-evolucion.html',
  styleUrl: '../vista-comparativa/vista-comparativa.css',
})
export class VistaEvolucionComponent implements OnInit {
  private campoService = inject(CampoService);
  private router = inject(Router);

  campos = signal<Campo[]>([]);
  pagos = signal<Pago[]>([]);
  cheques = signal<Cheque[]>([]);
  cargando = signal(true);
  error = signal('');

  campoFiltroId = signal<number | null>(null);

  /** Una fila por año (ascendente) respetando el filtro de campo. */
  resumenAnual = computed<FilaAnual[]>(() => {
    const id = this.campoFiltroId();
    const pagos = id === null ? this.pagos() : this.pagos().filter((p) => p.campo?.id === id);
    const cheques = id === null ? this.cheques() : this.cheques().filter((c) => c.campo?.id === id);

    const set = new Set<number>([new Date().getFullYear()]);
    this.pagos().forEach((p) => { const a = anioPago(p); if (a) set.add(a); });
    this.cheques().forEach((c) => { const a = anioCheque(c); if (a) set.add(a); });

    const filas = Array.from(set).sort((a, b) => a - b).map((anio) => {
      const gastos = sumar(pagos.filter((p) => anioPago(p) === anio).map((p) => p.coste));
      const ingresos = sumar(cheques.filter((c) => anioCheque(c) === anio).map((c) => c.cantidad));
      return { anio, gastos, ingresos, beneficio: redondear2(ingresos - gastos), varBeneficio: null as number | null };
    });
    for (let i = 1; i < filas.length; i++) {
      filas[i].varBeneficio = redondear2(filas[i].beneficio - filas[i - 1].beneficio);
    }
    return filas;
  });

  private maxBarra = computed(() => Math.max(1, ...this.resumenAnual().flatMap((f) => [f.gastos, f.ingresos])));

  alturaBarra(valor: number): number {
    return Math.max(2, Math.round((valor / this.maxBarra()) * 100));
  }

  hayDatos = computed(() => this.pagos().length > 0 || this.cheques().length > 0);

  /** Abre el mapa del año elegido. */
  verAnio(anio: number): void {
    this.router.navigate(['/estadisticas'], { queryParams: { anio } });
  }

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
      cheques: this.campoService.getCheques(),
    }).subscribe({
      next: ({ campos, pagos, cheques }) => {
        this.campos.set(campos);
        this.pagos.set(pagos);
        this.cheques.set(cheques);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message);
        this.cargando.set(false);
      },
    });
  }
}
