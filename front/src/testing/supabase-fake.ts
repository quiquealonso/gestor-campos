import { signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';

/** Sustituto de SupabaseService para los tests: no hace llamadas de red. */
export class SupabaseFake {
  sesion = signal<Session | null>(null);
  listo = Promise.resolve();
  login = jasmine.createSpy('login').and.resolveTo();
  logout = jasmine.createSpy('logout').and.resolveTo();

  conSesion(): this {
    this.sesion.set({ user: { email: 'yo@ejemplo.com' } } as Session);
    return this;
  }
}
