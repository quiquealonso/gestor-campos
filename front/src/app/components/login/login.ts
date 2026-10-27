import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { environment } from '../../../enviroments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <main class="login">
      <form class="login-card" (ngSubmit)="entrar()" #f="ngForm">
        <img class="login-logo" src="logo.svg" alt="" />
        <h1>Gestor Campos</h1>
        <p class="login-sub">Inicia sesión para continuar</p>
        @if (demo) {
          <p class="login-demo">Demo con datos ficticios: el acceso ya está relleno, pulsa «Entrar».</p>
        }

        <label>
          Email
          <input type="email" name="email" autocomplete="username" required [(ngModel)]="email" />
        </label>
        <label>
          Contraseña
          <input type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
        </label>

        @if (error()) {
          <p class="login-error" role="alert">{{ error() }}</p>
        }

        <button type="submit" class="login-btn" [disabled]="cargando() || f.invalid">
          {{ cargando() ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
  styles: [
    `
      .login {
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .login-card {
        width: 100%;
        max-width: 380px;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding: 1.6rem 1.4rem;
        border: 1px solid var(--border-color);
        border-radius: 16px;
        background: var(--bg-surface);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
      }
      .login-logo {
        align-self: center;
        width: 64px;
        height: 64px;
        filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4));
      }
      h1 {
        margin: 0;
        text-align: center;
        font-size: 1.4rem;
        color: var(--text-main);
      }
      .login-sub {
        margin: -0.5rem 0 0.3rem;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.9rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        color: var(--text-muted);
        font-size: 0.9rem;
      }
      input {
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: #111822;
        color: var(--text-main);
        padding: 0.65rem 0.75rem;
        font: inherit;
        outline: none;
      }
      input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
      }
      .login-btn {
        margin-top: 0.3rem;
        padding: 0.7rem;
        border: 1px solid var(--accent);
        border-radius: 10px;
        background: rgba(88, 166, 255, 0.25);
        color: var(--text-main);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .login-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .login-demo {
        margin: 0;
        padding: 0.5rem 0.7rem;
        border-left: 3px solid var(--accent);
        border-radius: 6px;
        background: rgba(88, 166, 255, 0.1);
        color: #b9d8ff;
        font-size: 0.85rem;
      }
      .login-error {
        margin: 0;
        padding: 0.5rem 0.7rem;
        border-left: 3px solid #ff5555;
        border-radius: 6px;
        background: rgba(255, 85, 85, 0.1);
        color: #ff9a9a;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class LoginComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  readonly demo = environment.demo;
  // En la demo el acceso viene relleno con datos ficticios: no se envían a ningún sitio.
  email = this.demo ? 'demo@gestorcampos.es' : '';
  password = this.demo ? 'demo' : '';
  cargando = signal(false);
  error = signal('');

  async entrar(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.supabase.login(this.email, this.password);
      await this.router.navigate(['/']);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.cargando.set(false);
    }
  }
}
