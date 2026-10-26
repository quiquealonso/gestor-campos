import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { SupabaseFake } from '../../../testing/supabase-fake';

describe('LoginComponent', () => {
  let supabase: SupabaseFake;

  beforeEach(async () => {
    supabase = new SupabaseFake();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: supabase }],
    }).compileComponents();
  });

  it('se crea', () => {
    expect(TestBed.createComponent(LoginComponent).componentInstance).toBeTruthy();
  });

  it('al entrar bien navega a la página principal', async () => {
    const comp = TestBed.createComponent(LoginComponent).componentInstance;
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    comp.email = 'yo@ejemplo.com';
    comp.password = 'secreto';
    await comp.entrar();
    expect(supabase.login).toHaveBeenCalledWith('yo@ejemplo.com', 'secreto');
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(comp.error()).toBe('');
  });

  it('si el login falla muestra el error', async () => {
    supabase.login.and.rejectWith(new Error('Email o contraseña incorrectos.'));
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.componentInstance.entrar();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.login-error')?.textContent)
      .toContain('Email o contraseña incorrectos.');
    expect(fixture.componentInstance.cargando()).toBeFalse();
  });
});
