import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Campo } from '../../model/campo';
import { Pago } from '../../model/pago';
import { Cheque } from '../../model/cheque';
import { Categoria } from '../../model/categoria';
import { CategoriaSelectComponent } from '../categoria-select/categoria-select';
import { catchError, of } from 'rxjs';
import { CampoService } from '../../services/campo/campo.service';

type CampoConFinanzas = Campo & {
  totalGastos: number;
  totalIngreso: number;
  beneficio: number;
  beneficioPorUnidad: number;
};

@Component({
  selector: 'app-vista-general',
  imports: [CommonModule, FormsModule, RouterLink, CategoriaSelectComponent],
  templateUrl: './vista-general.html',
  styleUrl: './vista-general.css',
})
export class VistaGeneralComponent implements OnInit {
  private campoService = inject(CampoService);

  camposConFinanzas = signal<CampoConFinanzas[]>([]);
  cargando = signal(true);
  error = signal('');
  anioSeleccionado = signal<number>(new Date().getFullYear());
  aniosDisponibles = signal<number[]>([]);
  mostrarFormularioCampo = signal(false);
  mostrarFormularioPagoConjunto = signal(false);
  guardandoCampo = signal(false);
  guardandoPagoConjunto = signal(false);
  mensajeCampo = signal('');
  mensajePagoConjunto = signal('');
  categorias = signal<Categoria[]>([]);
  categoriaConjuntoId = signal<number | null>(null);

  nuevoCampo = {
    nombre: '',
    tamano: null as number | null,
    poligono: null as number | null,
    parcela: null as number | null,
  };

  nuevoPagoConjunto = {
    fecha: '',
    anio: null as number | null,
    nombre: '',
    descripcion: '',
    coste: null as number | null,
    pagado: true,
  };

  private camposBase: Campo[] = [];
  private pagosBase: Pago[] = [];
  private chequesBase: Cheque[] = [];

  totalGastos = computed(() =>
    this.camposConFinanzas().reduce((acc, campo) => acc + campo.totalGastos, 0)
  );

  totalIngreso = computed(() =>
    this.camposConFinanzas().reduce((acc, campo) => acc + campo.totalIngreso, 0)
  );

  totalBeneficio = computed(() => this.totalIngreso() - this.totalGastos());

  totalSuperficie = computed(() =>
    this.camposConFinanzas().reduce((acc, campo) => acc + Number(campo.tamano || 0), 0)
  );

  beneficioPorUnidad = computed(() =>
    this.totalSuperficie() > 0 ? this.totalBeneficio() / this.totalSuperficie() : 0
  );

  ngOnInit(): void {
    this.cargarDatos();
  }

  abrirFormularioCampo(): void {
    this.cerrarFormularioPagoConjunto();
    this.mostrarFormularioCampo.set(true);
    this.mensajeCampo.set('');
  }

  cerrarFormularioCampo(): void {
    this.mostrarFormularioCampo.set(false);
    this.mensajeCampo.set('');
  }

  abrirFormularioPagoConjunto(): void {
    this.cerrarFormularioCampo();
    this.mostrarFormularioPagoConjunto.set(true);
    this.mensajePagoConjunto.set('');

    const hoy = new Date();
    this.nuevoPagoConjunto.fecha = this.nuevoPagoConjunto.fecha || hoy.toISOString().split('T')[0];
    this.nuevoPagoConjunto.anio = this.nuevoPagoConjunto.anio ?? this.anioSeleccionado();
    this.categoriaConjuntoId.set(this.categorias().find((c) => c.nombre === 'Sin categoría')?.id ?? null);
  }

  cerrarFormularioPagoConjunto(): void {
    this.mostrarFormularioPagoConjunto.set(false);
    this.mensajePagoConjunto.set('');
  }

  guardarCampo(): void {
    if (
      !this.nuevoCampo.nombre.trim() ||
      this.nuevoCampo.tamano === null ||
      this.nuevoCampo.poligono === null ||
      this.nuevoCampo.parcela === null
    ) {
      this.mensajeCampo.set('Completa todos los datos del campo.');
      return;
    }

    this.guardandoCampo.set(true);
    this.campoService
      .createCampo({
        nombre: this.nuevoCampo.nombre.trim(),
        tamano: Number(this.nuevoCampo.tamano),
        poligono: Number(this.nuevoCampo.poligono),
        parcela: Number(this.nuevoCampo.parcela),
      })
      .subscribe({
        next: (campoCreado) => {
          this.guardandoCampo.set(false);
          if (!campoCreado) {
            this.mensajeCampo.set('No se pudo guardar el campo.');
            return;
          }

          this.nuevoCampo = {
            nombre: '',
            tamano: null,
            poligono: null,
            parcela: null,
          };
          this.mensajeCampo.set('Campo creado correctamente.');
          this.mostrarFormularioCampo.set(false);
          this.cargarDatos();
        },
        error: (e: Error) => {
          this.guardandoCampo.set(false);
          this.mensajeCampo.set(`Error al guardar el campo. ${e.message}`);
        },
      });
  }

  guardarPagoConjunto(): void {
    if (
      !this.nuevoPagoConjunto.fecha ||
      !this.nuevoPagoConjunto.nombre.trim() ||
      this.nuevoPagoConjunto.coste === null
    ) {
      this.mensajePagoConjunto.set('Completa todos los datos obligatorios del pago conjunto.');
      return;
    }

    if (Number(this.nuevoPagoConjunto.coste) <= 0) {
      this.mensajePagoConjunto.set('El coste debe ser mayor que 0.');
      return;
    }

    this.guardandoPagoConjunto.set(true);
    this.campoService
      .createPagoConjunto({
        fecha: this.nuevoPagoConjunto.fecha,
        anio: this.nuevoPagoConjunto.anio === null ? undefined : Number(this.nuevoPagoConjunto.anio),
        nombre: this.nuevoPagoConjunto.nombre.trim(),
        descripcion: this.nuevoPagoConjunto.descripcion.trim(),
        coste: Number(this.nuevoPagoConjunto.coste),
        categoria: this.categoriaConjuntoId() ? { id: this.categoriaConjuntoId()! } : null,
        pagado: this.nuevoPagoConjunto.pagado,
      })
      .subscribe({
        next: (pagosCreados) => {
          this.guardandoPagoConjunto.set(false);
          if (!pagosCreados.length) {
            this.mensajePagoConjunto.set('No se pudo registrar el pago conjunto.');
            return;
          }

          this.nuevoPagoConjunto = {
            fecha: '',
            anio: null,
            nombre: '',
            descripcion: '',
            coste: null,
            pagado: true,
          };
          this.mostrarFormularioPagoConjunto.set(false);
          this.mensajePagoConjunto.set(
            `Pago conjunto aplicado en ${pagosCreados.length} campo(s).`
          );
          this.cargarDatos();
        },
        error: (e: Error) => {
          this.guardandoPagoConjunto.set(false);
          this.mensajePagoConjunto.set(`Error al registrar el pago conjunto. ${e.message}`);
        },
      });
  }

  reintentar(): void {
    this.error.set('');
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.error.set('');
    this.cargando.set(true);
    forkJoin({
      campos: this.campoService.getCampos(),
      pagos: this.campoService.getPagos(),
      cheques: this.campoService.getCheques(),
      categorias: this.campoService.getCategorias().pipe(catchError(() => of([] as Categoria[]))),
    }).subscribe({
      next: ({ campos, pagos, cheques, categorias }) => {
        this.categorias.set(categorias);
        this.camposBase = campos;
        this.pagosBase = pagos;
        this.chequesBase = cheques;
        this.aniosDisponibles.set(this.construirAniosDisponibles(pagos, cheques));
        this.aplicarFiltro();
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(`No se pudieron cargar los campos. ${e.message}`);
        this.cargando.set(false);
      },
    });
  }

  onAnioSeleccionadoChange(anio: number): void {
    this.anioSeleccionado.set(Number(anio));
    this.aplicarFiltro();
  }

  private aplicarFiltro(): void {
    const anio = this.anioSeleccionado();
    const pagosFiltrados = this.pagosBase.filter((pago) => this.obtenerAnioPago(pago) === anio);
    const chequesFiltrados = this.chequesBase.filter(
      (cheque) => this.obtenerAnioCheque(cheque) === anio
    );

    const gastosPorCampo = this.crearMapaGastosPorCampo(pagosFiltrados);
    const ingresosPorCampo = this.crearMapaIngresosPorCampo(chequesFiltrados);

    const data = this.camposBase.map((campo) => {
      const totalGastos = gastosPorCampo.get(campo.id) || 0;
      const totalIngreso = ingresosPorCampo.get(campo.id) || 0;
      return {
        ...campo,
        totalGastos,
        totalIngreso,
        beneficio: totalIngreso - totalGastos,
        beneficioPorUnidad: Number(campo.tamano) > 0 ? (totalIngreso - totalGastos) / Number(campo.tamano) : 0,
      };
    });

    this.camposConFinanzas.set(data);
  }

  private construirAniosDisponibles(pagos: Pago[], cheques: Cheque[]): number[] {
    const anios = new Set<number>();
    anios.add(new Date().getFullYear());

    pagos.forEach((pago) => {
      const anio = this.obtenerAnioPago(pago);
      if (anio) anios.add(anio);
    });

    cheques.forEach((cheque) => {
      const anio = this.obtenerAnioCheque(cheque);
      if (anio) anios.add(anio);
    });

    return Array.from(anios).sort((a, b) => b - a);
  }

  private obtenerAnioPago(pago: Pago): number | null {
    if (pago.anio) return Number(pago.anio);

    const anioFecha = new Date(pago.fecha).getFullYear();
    return Number.isNaN(anioFecha) ? null : anioFecha;
  }

  private obtenerAnioCheque(cheque: Cheque): number | null {
    if (cheque.anio) return Number(cheque.anio);
    const anio = new Date(cheque.dia).getFullYear();
    return Number.isNaN(anio) ? null : anio;
  }

  private crearMapaGastosPorCampo(pagos: Pago[]): Map<number, number> {
    const mapa = new Map<number, number>();

    pagos.forEach((pago) => {
      const campoId = pago.campo?.id;
      if (!campoId) return;

      const totalActual = mapa.get(campoId) || 0;
      mapa.set(campoId, totalActual + Number(pago.coste || 0));
    });

    return mapa;
  }

  private crearMapaIngresosPorCampo(cheques: Cheque[]): Map<number, number> {
    const mapa = new Map<number, number>();

    cheques.forEach((cheque) => {
      const campoId = cheque.campo?.id;
      if (!campoId) return;

      const totalActual = mapa.get(campoId) || 0;
      mapa.set(campoId, totalActual + Number(cheque.cantidad || 0));
    });

    return mapa;
  }
}
