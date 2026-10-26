import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Cheque } from '../../model/cheque';
import { Pago } from '../../model/pago';

/** Año de campaña de un pago: `anio` si existe, si no el año de la fecha. */
export const anioPago = (p: Pago): number | null => {
  if (p.anio) return Number(p.anio);
  const a = new Date(p.fecha).getFullYear();
  return Number.isNaN(a) ? null : a;
};

/** Año de campaña de un cheque: `anio` si existe, si no el año del día. */
export const anioCheque = (c: Cheque): number | null => {
  if (c.anio) return Number(c.anio);
  const a = new Date(c.dia).getFullYear();
  return Number.isNaN(a) ? null : a;
};

/** Pestañas para cambiar entre las dos páginas de estadísticas. */
@Component({
  selector: 'app-estadisticas-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="stats-tabs" aria-label="Tipo de estadística">
      <a routerLink="/estadisticas" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <i class="pi pi-sitemap" aria-hidden="true"></i> Por año
      </a>
      <a routerLink="/estadisticas/anios" routerLinkActive="active">
        <i class="pi pi-chart-bar" aria-hidden="true"></i> Entre años
      </a>
    </nav>
  `,
  styles: [
    `
      .stats-tabs {
        display: flex;
        gap: 0.3rem;
        padding: 0.25rem;
        margin: 0 0 0.9rem;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-surface-soft);
      }
      a {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.5rem 0.6rem;
        border-radius: 9px;
        color: var(--text-muted);
        text-decoration: none;
        font-weight: 600;
        font-size: 0.92rem;
      }
      a:hover {
        color: var(--text-main);
      }
      a.active {
        background: rgba(88, 166, 255, 0.2);
        color: var(--text-main);
        box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.45);
      }
    `,
  ],
})
export class EstadisticasTabsComponent {}
