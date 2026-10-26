import { Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Categoria } from '../../model/categoria';
import { CampoService } from '../../services/campo/campo.service';

/** Selector de categoría con alta rápida de categorías nuevas. */
@Component({
  selector: 'app-categoria-select',
  imports: [FormsModule],
  template: `
    <label class="cs-field">
      <span class="cs-label">Categoría</span>
      <span class="cs-control">
        <i class="cs-dot" [style.background]="colorSeleccionado()"></i>
        <select [ngModel]="valor()" (ngModelChange)="valor.set($event)">
          <option [ngValue]="null">Sin asignar</option>
          @for (c of categorias(); track c.id) {
            <option [ngValue]="c.id">{{ c.nombre }}</option>
          }
        </select>
      </span>
    </label>

    @if (creando()) {
      <div class="cs-new">
        <span class="cs-new-title">Nueva categoría</span>
        <div class="cs-new-row">
          <input
            type="text"
            placeholder="Ej. Alquiler de maquinaria"
            maxlength="60"
            [ngModel]="nombre()"
            (ngModelChange)="nombre.set($event)"
            (keydown.enter)="$event.preventDefault(); crear()"
          />
          <button type="button" class="cs-btn cs-btn--primary" (click)="crear()" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : 'Añadir' }}
          </button>
          <button type="button" class="cs-btn" (click)="cancelar()" [disabled]="guardando()">Cancelar</button>
        </div>
        @if (error()) {
          <p class="cs-error">{{ error() }}</p>
        }
      </div>
    } @else {
      <button type="button" class="cs-add" (click)="creando.set(true)">
        <span aria-hidden="true">+</span> Nueva categoría
      </button>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .cs-field { display: flex; flex-direction: column; gap: 0.3rem; }
      .cs-label { color: var(--text-muted); font-size: 0.92rem; }
      .cs-control { position: relative; display: flex; align-items: center; }
      .cs-dot {
        position: absolute; left: 0.7rem; width: 10px; height: 10px; border-radius: 50%;
        pointer-events: none; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
      }
      select, input {
        width: 100%; border: 1px solid var(--border-color); border-radius: 8px;
        background: #111822; color: var(--text-main); padding: 0.5rem 0.65rem;
        font: inherit; font-size: 0.95rem; outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      select {
        appearance: none; cursor: pointer; padding-left: 1.9rem; padding-right: 2rem;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%239aa6b2' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>");
        background-repeat: no-repeat; background-position: right 0.75rem center;
      }
      select:focus, input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2); }
      input::placeholder { color: #5d6b7a; }
      .cs-add {
        margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.35rem 0.8rem; border: 1px dashed var(--accent); border-radius: 999px;
        background: rgba(88, 166, 255, 0.08); color: var(--accent); font: inherit;
        font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease;
      }
      .cs-add:hover { background: rgba(88, 166, 255, 0.18); }
      .cs-new {
        margin-top: 0.6rem; padding: 0.75rem; border: 1px solid var(--border-color);
        border-radius: 10px; background: rgba(255, 255, 255, 0.03);
      }
      .cs-new-title {
        display: block; margin-bottom: 0.45rem; font-size: 0.8rem; font-weight: 600;
        letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-muted);
      }
      .cs-new-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .cs-new-row input { flex: 1 1 100%; }
      .cs-btn {
        flex: 1 1 0; padding: 0.45rem 0.9rem; border: 1px solid var(--text-muted); border-radius: 8px;
        background: rgba(145, 152, 161, 0.15); color: var(--text-main); font: inherit;
        font-weight: 600; cursor: pointer;
      }
      .cs-btn--primary { border-color: var(--accent); background: rgba(88, 166, 255, 0.22); }
      .cs-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .cs-error {
        margin: 0.5rem 0 0; padding: 0.4rem 0.6rem; border-left: 3px solid #ff5555; border-radius: 6px;
        background: rgba(255, 85, 85, 0.1); color: #ff9a9a; font-size: 0.85rem;
      }
    `,
  ],
})
export class CategoriaSelectComponent {
  private service = inject(CampoService);

  categorias = model<Categoria[]>([]);
  valor = model<number | null>(null);

  creando = signal(false);
  guardando = signal(false);
  nombre = signal('');
  error = signal('');

  colorSeleccionado(): string {
    return this.categorias().find((c) => c.id === this.valor())?.color || '#5d6b7a';
  }

  crear(): void {
    const nombre = this.nombre().trim();
    if (!nombre) {
      this.error.set('Escribe un nombre.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.service.createCategoria(nombre).subscribe({
      next: (cat) => {
        this.guardando.set(false);
        this.categorias.set([...this.categorias(), cat].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.valor.set(cat.id);
        this.cancelar();
      },
      error: (e: Error) => {
        this.guardando.set(false);
        this.error.set(e.message);
      },
    });
  }

  cancelar(): void {
    this.creando.set(false);
    this.nombre.set('');
    this.error.set('');
  }
}
