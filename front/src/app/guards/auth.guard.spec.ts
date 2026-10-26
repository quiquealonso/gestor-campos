import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, loginGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase/supabase.service';
import { SupabaseFake } from '../../testing/supabase-fake';

describe('guards de autenticación', () => {
  let supabase: SupabaseFake;
  const ejecutar = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  const url = (r: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  beforeEach(() => {
    supabase = new SupabaseFake();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupabaseService, useValue: supabase }],
    });
  });

  it('authGuard manda a /login si no hay sesión', async () => {
    expect(url(await ejecutar(authGuard))).toBe('/login');
  });

  it('authGuard deja pasar con sesión', async () => {
    supabase.conSesion();
    expect(await ejecutar(authGuard)).toBeTrue();
  });

  it('loginGuard deja ver el login sin sesión', async () => {
    expect(await ejecutar(loginGuard)).toBeTrue();
  });

  it('loginGuard manda a / si ya hay sesión', async () => {
    supabase.conSesion();
    expect(url(await ejecutar(loginGuard))).toBe('/');
  });
});
