import { Injectable, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/environment';

/** Traduce los errores de autenticación más habituales. */
function mensajeAuth(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu email antes de entrar.';
  if (/failed to fetch|network/i.test(msg)) return 'No se puede conectar con el servidor. Revisa tu conexión.';
  if (/too many requests|rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento.';
  return msg;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  /** Sesión actual (null si no ha iniciado sesión). */
  readonly sesion = signal<Session | null>(null);

  /** Se resuelve cuando ya se ha leído la sesión guardada (para los guards). */
  readonly listo: Promise<void>;

  constructor() {
    this.listo = this.client.auth.getSession().then(({ data }) => {
      this.sesion.set(data.session);
    });
    this.client.auth.onAuthStateChange((_evento, sesion) => this.sesion.set(sesion));
  }

  get email(): string {
    return this.sesion()?.user?.email ?? '';
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(mensajeAuth(error.message));
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }
}
