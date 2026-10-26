import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase/supabase.service';

/** Solo deja pasar a usuarios con sesión iniciada. */
export const authGuard: CanActivateFn = async () => {
  // inject() debe llamarse antes de cualquier await (contexto de inyección).
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  await supabase.listo;
  return supabase.sesion() ? true : router.createUrlTree(['/login']);
};

/** Si ya hay sesión, /login redirige a la página principal. */
export const loginGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  await supabase.listo;
  return supabase.sesion() ? router.createUrlTree(['/']) : true;
};
