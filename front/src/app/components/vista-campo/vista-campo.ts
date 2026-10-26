import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { Campo } from '../../model/campo';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';
import { Categoria } from '../../model/categoria';
import { CategoriaSelectComponent } from '../categoria-select/categoria-select';
import { catchError, of } from 'rxjs';
import { CampoService } from '../../services/campo/campo.service';

@Component({
  selector: 'app-vista-campo',
  imports: [CommonModule, FormsModule, RouterLink, CategoriaSelectComponent],
  templateUrl: './vista-campo.html',
  styleUrl: './vista-campo.css',
})
export class VistaCampoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private campoService = inject(CampoService);

  campo = signal<Campo | null>(null);
  categorias = signal<Categoria[]>([]);
  categoriaFormularioId = signal<number | null>(null);
  confirmandoEliminarCampo = signal(false);
  textoConfirmacionCampo = signal('');
  eliminandoCampo = signal(false);
  errorEliminarCampo = signal('');
  pagos = signal<Pago[]>([]);
  cheques = signal<Cheque[]>([]);
  camposDisponibles = signal<Campo[]>([]);
  mostrarSelector = signal(false);
  mostrarFormularioPago = signal(false);
  mostrarFormularioCheque = signal(false);
  mostrarFormularioCampo = signal(false);
  guardandoPago = signal(false);
  eliminandoPago = signal(false);
  pagoAEliminar = signal<Pago | null>(null);
  guardandoCheque = signal(false);
  guardandoCampo = signal(false);
  mensajePago = signal('');
  mensajeCheque = signal('');
  mensajeCampo = signal('');
  cargando = signal(true);
  error = signal('');
  editandoPagoId = signal<number | null>(null);
  anioSeleccionado = signal<number>(new Date().getFullYear());
  ordenPor = signal<'fecha' | 'anio' | 'coste'>('fecha');
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

  nuevoCheque = {
    dia: '',
    cantidad: null as number | null,
    anio: null as number | null,
  };

  campoEdicion = {
    nombre: '',
    tamano: null as number | null,
    poligono: null as number | null,
    parcela: null as number | null,
  };

  // Computed para obtener años únicos de los pagos y cheques
  anosDisponibles = computed(() => {
    const anos = new Set<number>();
    
    // Agregar año actual
    anos.add(new Date().getFullYear());
    
    // Agregar años de los pagos
    this.pagos().forEach(pago => {
      if (pago.anio) {
        anos.add(pago.anio);
      } else if (pago.fecha) {
        anos.add(new Date(pago.fecha).getFullYear());
      }
    });
    
    // Agregar años de los cheques
    this.cheques().forEach(cheque => {
      if (cheque.anio) {
        anos.add(cheque.anio);
      } else if (cheque.dia) {
        anos.add(new Date(cheque.dia).getFullYear());
      }
    });
    
    return Array.from(anos).sort((a, b) => b - a);
  });

  // Pagos filtrados y ordenados por año seleccionado
  pagosFiltrados = computed(() => {
    const anoSel = this.anioSeleccionado();
    let resultado = this.pagos().filter((pago) => {
      const ano = pago.anio || (pago.fecha ? new Date(pago.fecha).getFullYear() : null);
      return ano === anoSel;
    });

    // Ordenar
    const ordenPor = this.ordenPor();
    const ascendente = this.ordenAscendente();
    resultado = [...resultado].sort((a, b) => {
      let aVal: any, bVal: any;

      if (ordenPor === 'fecha') {
        aVal = new Date(a.fecha).getTime();
        bVal = new Date(b.fecha).getTime();
      } else if (ordenPor === 'anio') {
        aVal = a.anio || new Date(a.fecha).getFullYear();
        bVal = b.anio || new Date(b.fecha).getFullYear();
      } else if (ordenPor === 'coste') {
        aVal = Number(a.coste || 0);
        bVal = Number(b.coste || 0);
      }

      return ascendente ? aVal - bVal : bVal - aVal;
    });

    return resultado;
  });

  // Pagos para la página actual
  pagosEnPagina = computed(() => {
    const pagos = this.pagosFiltrados();
    const inicio = (this.paginaActual() - 1) * this.registrosPorPagina;
    const fin = inicio + this.registrosPorPagina;
    return pagos.slice(inicio, fin);
  });

  // Total de páginas
  totalPaginas = computed(() => {
    return Math.ceil(this.pagosFiltrados().length / this.registrosPorPagina);
  });

  // Array de números de página para mostrar
  numeroPaginas = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  // Cheques filtrados por año seleccionado
  chequesFiltrados = computed(() => {
    const anoSel = this.anioSeleccionado();
    return this.cheques().filter((cheque) => {
      const ano = cheque.anio || (cheque.dia ? new Date(cheque.dia).getFullYear() : null);
      return ano === anoSel;
    });
  });

  totalGastos = computed(() =>
    this.pagosFiltrados().reduce((acc, pago) => acc + Number(pago.coste || 0), 0)
  );

  totalIngresos = computed(() =>
    this.chequesFiltrados().reduce((acc, cheque) => acc + Number(cheque.cantidad || 0), 0)
  );

  cambiarOrden(columna: 'fecha' | 'anio' | 'coste'): void {
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

  ngOnInit(): void {
    this.route.paramMap.subscribe({
      next: (params) => {
        const idParam = params.get('id');
        if (!idParam) {
          this.cargarSelectorCampos();
          return;
        }

        const campoId = Number(idParam);
        if (!campoId) {
          this.error.set('ID de campo no valido.');
          this.cargando.set(false);
          return;
        }

        this.cargarDetalleCampo(campoId);
      },
      error: (e: Error) => {
        this.error.set(`No se pudo cargar la vista de campo. ${e.message}`);
        this.cargando.set(false);
      },
    });
  }

  reintentar(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.cargarDetalleCampo(id);
    } else {
      this.cargarSelectorCampos();
    }
  }

  // ---- Eliminar campo (con confirmación fuerte: hay que escribir el nombre)
  puedeConfirmarEliminarCampo(): boolean {
    const c = this.campo();
    return !!c && this.textoConfirmacionCampo().trim().toLowerCase() === c.nombre.trim().toLowerCase();
  }

  abrirEliminarCampo(): void {
    this.cerrarFormularioCampo();
    this.textoConfirmacionCampo.set('');
    this.errorEliminarCampo.set('');
    this.confirmandoEliminarCampo.set(true);
  }

  cancelarEliminarCampo(): void {
    if (this.eliminandoCampo()) return;
    this.confirmandoEliminarCampo.set(false);
  }

  confirmarEliminarCampo(): void {
    const c = this.campo();
    if (!c || !this.puedeConfirmarEliminarCampo()) return;
    this.eliminandoCampo.set(true);
    this.errorEliminarCampo.set('');
    this.campoService.deleteCampo(c.id).subscribe({
      next: () => {
        this.eliminandoCampo.set(false);
        this.confirmandoEliminarCampo.set(false);
        this.router.navigate(['/']);
      },
      error: (e: Error) => {
        this.eliminandoCampo.set(false);
        this.errorEliminarCampo.set(`No se pudo eliminar el campo. ${e.message}`);
      },
    });
  }

  private cargarSelectorCampos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.campo.set(null);
    this.pagos.set([]);
    this.cheques.set([]);
    this.mostrarSelector.set(true);

    this.campoService.getCampos().subscribe({
      next: (campos) => {
        this.camposDisponibles.set(campos);
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(`No se pudieron cargar los campos. ${e.message}`);
        this.cargando.set(false);
      },
    });
  }

  private cargarDetalleCampo(campoId: number): void {
    this.cargando.set(true);
    this.error.set('');
    this.mostrarSelector.set(false);
    this.mostrarFormularioPago.set(false);
    this.mostrarFormularioCheque.set(false);

    this.campoService
      .getCampoById(campoId)
      .pipe(switchMap((campo) => {
        if (!campo) {
          throw new Error('Campo no encontrado.');
        }

        this.campo.set(campo);
        return forkJoin({
          pagos: this.campoService.getPagosByCampo(campo.id),
          cheques: this.campoService.getChequesByCampo(campo.id),
          categorias: this.campoService.getCategorias().pipe(catchError(() => of([] as Categoria[]))),
        });
      }))
      .subscribe({
        next: ({ pagos, cheques, categorias }) => {
          this.categorias.set(categorias);
          this.pagos.set(pagos);
          this.cheques.set(cheques);
          this.cargando.set(false);
        },
        error: (e: Error) => {
          this.error.set(`No se pudo cargar el detalle del campo. ${e.message}`);
          this.cargando.set(false);
        },
      });
  }

  onAnioSeleccionadoChange(anio: number): void {
    this.anioSeleccionado.set(Number(anio));
    this.paginaActual.set(1);
  }

  abrirFormularioPago(): void {
    this.cerrarFormularioCampo();
    this.cerrarFormularioCheque();
    this.mostrarFormularioPago.set(true);
    if (!this.editandoPagoId()) {
      const today = new Date().toISOString().split('T')[0];
      this.nuevoPago.fecha = today;
      this.nuevoPago.anio = this.anioSeleccionado() || new Date().getFullYear();
      this.categoriaFormularioId.set(this.categorias().find((c) => c.nombre === 'Sin categoría')?.id ?? null);
    }
    this.mensajePago.set('');
  }

  cerrarFormularioPago(): void {
    this.cancelarEdicion();
  }

  abrirFormularioCheque(): void {
    this.cerrarFormularioCampo();
    this.cerrarFormularioPago();
    this.mostrarFormularioCheque.set(true);
    this.nuevoCheque.cantidad = null;
    this.nuevoCheque.dia = new Date().toISOString().split('T')[0];
    this.nuevoCheque.anio = this.anioSeleccionado() || new Date().getFullYear();
    this.mensajeCheque.set('');
  }

  cerrarFormularioCheque(): void {
    this.mostrarFormularioCheque.set(false);
    this.mensajeCheque.set('');
  }

  abrirFormularioCampo(): void {
    this.cerrarFormularioPago();
    this.cerrarFormularioCheque();
    this.mostrarFormularioCampo.set(true);
    const c = this.campo();
    if (c) {
      this.campoEdicion = {
        nombre: c.nombre,
        tamano: c.tamano,
        poligono: c.poligono,
        parcela: c.parcela,
      };
    }
    this.mensajeCampo.set('');
  }

  cerrarFormularioCampo(): void {
    this.mostrarFormularioCampo.set(false);
    this.mensajeCampo.set('');
  }

  guardarPago(): void {
    const campo = this.campo();
    if (!campo) {
      this.mensajePago.set('Primero selecciona un campo.');
      return;
    }

    if (
      !this.nuevoPago.fecha ||
      !this.nuevoPago.nombre.trim() ||
      this.nuevoPago.coste === null
    ) {
      this.mensajePago.set('Completa todos los datos obligatorios del pago.');
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

    // Si estamos editando, usar updatePago, si no, usar createPago
    const pagoRequest = this.editandoPagoId()
      ? this.campoService.updatePago(this.editandoPagoId()!, pagoPayload)
      : this.campoService.createPago({ ...pagoPayload, campo: { id: campo.id } });

    pagoRequest.subscribe({
      next: (pagoCreado) => {
        this.guardandoPago.set(false);
        if (!pagoCreado) {
          this.mensajePago.set('No se pudo guardar el pago.');
          return;
        }

        this.nuevoPago = {
          fecha: '',
          anio: null,
          nombre: '',
          descripcion: '',
          coste: null,
          pagado: true,
        };
        this.editandoPagoId.set(null);
        this.mensajePago.set('Pago guardado correctamente.');
        this.mostrarFormularioPago.set(false);

        this.campoService.getPagosByCampo(campo.id).subscribe({
          next: (pagos) => this.pagos.set(pagos),
          error: () => this.mensajePago.set('Pago guardado, pero no se pudo refrescar la lista.'),
        });
      },
      error: (e: Error) => {
        this.guardandoPago.set(false);
        this.mensajePago.set(`Error al guardar el pago. ${e.message}`);
      },
    });
  }

  editarPago(pago: Pago): void {
    this.cerrarFormularioCampo();
    this.cerrarFormularioCheque();
    this.editandoPagoId.set(pago.id);
    this.categoriaFormularioId.set(pago.categoria?.id ?? null);
    this.nuevoPago = {
      fecha: this.formatFechaInput(pago.fecha),
      anio: pago.anio || null,
      nombre: pago.nombre,
      descripcion: pago.descripcion,
      coste: pago.coste,
      pagado: pago.pagado !== false,
    };
    this.mostrarFormularioPago.set(true);
    this.mensajePago.set('');
  }

  cancelarEdicion(): void {
    this.editandoPagoId.set(null);
    this.eliminandoPago.set(false);
    this.categoriaFormularioId.set(null);
    this.nuevoPago = {
      fecha: '',
      anio: null,
      nombre: '',
      descripcion: '',
      coste: null,
      pagado: true,
    };
    this.mostrarFormularioPago.set(false);
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

    const campo = this.campo();
    if (!campo) return;

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
        this.campoService.getPagosByCampo(campo.id).subscribe({
          next: (pagos) => this.pagos.set(pagos),
          error: () => this.mensajePago.set('Pago eliminado, pero no se pudo refrescar la lista.'),
        });
      },
      error: (e: Error) => {
        this.eliminandoPago.set(false);
        this.pagoAEliminar.set(null);
        this.mensajePago.set(`Error al eliminar el pago. ${e.message}`);
      },
    });
  }

  guardarCheque(): void {
    const campo = this.campo();
    if (!campo) {
      this.mensajeCheque.set('Primero selecciona un campo.');
      return;
    }

    if (!this.nuevoCheque.dia || this.nuevoCheque.cantidad === null) {
      this.mensajeCheque.set('Completa los datos del cheque.');
      return;
    }

    this.guardandoCheque.set(true);
    
    const chequePayload = {
      dia: this.nuevoCheque.dia,
      cantidad: Number(this.nuevoCheque.cantidad),
      anio: this.nuevoCheque.anio || this.anioSeleccionado() || new Date(this.nuevoCheque.dia).getFullYear(),
      campo: { id: campo.id },
    };

    this.campoService
      .createCheque(chequePayload)
      .subscribe({
        next: (chequeCreado) => {
          this.guardandoCheque.set(false);
          if (!chequeCreado) {
            this.mensajeCheque.set('No se pudo guardar el cheque.');
            return;
          }

          this.nuevoCheque = {
            dia: '',
            cantidad: null,
            anio: null,
          };
          this.mensajeCheque.set('Cheque guardado correctamente.');
          this.mostrarFormularioCheque.set(false);

          this.campoService.getChequesByCampo(campo.id).subscribe({
            next: (cheques) => this.cheques.set(cheques),
            error: () => this.mensajeCheque.set('Cheque guardado, pero no se pudo refrescar la lista.'),
          });
        },
        error: (e: Error) => {
          this.guardandoCheque.set(false);
          this.mensajeCheque.set(`Error al guardar el cheque. ${e.message}`);
        },
      });
  }

  guardarCampo(): void {
    const c = this.campo();
    if (!c) {
      this.mensajeCampo.set('Error: campo no encontrado.');
      return;
    }

    if (
      !this.campoEdicion.nombre.trim() ||
      this.campoEdicion.tamano === null ||
      this.campoEdicion.poligono === null ||
      this.campoEdicion.parcela === null
    ) {
      this.mensajeCampo.set('Completa todos los datos obligatorios.');
      return;
    }

    this.guardandoCampo.set(true);
    this.campoService
      .updateCampo(c.id, {
        nombre: this.campoEdicion.nombre.trim(),
        tamano: Number(this.campoEdicion.tamano),
        poligono: Number(this.campoEdicion.poligono),
        parcela: Number(this.campoEdicion.parcela),
      })
      .subscribe({
        next: (campoActualizado) => {
          this.guardandoCampo.set(false);
          if (!campoActualizado) {
            this.mensajeCampo.set('No se pudo actualizar el campo.');
            return;
          }

          this.campo.set(campoActualizado);
          this.mensajeCampo.set('Campo actualizado correctamente.');
          this.mostrarFormularioCampo.set(false);
        },
        error: (e: Error) => {
          this.guardandoCampo.set(false);
          this.mensajeCampo.set(`Error al actualizar el campo. ${e.message}`);
        },
      });
  }
}
