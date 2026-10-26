import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SupabaseService } from './services/supabase/supabase.service';
import { SupabaseFake } from '../testing/supabase-fake';

describe('App', () => {
  let supabase: SupabaseFake;

  beforeEach(async () => {
    supabase = new SupabaseFake();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: SupabaseService, useValue: supabase }],
    }).compileComponents();
  });

  it('se crea', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('sin sesión no muestra barra superior ni navegación', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.topbar')).toBeNull();
    expect(el.querySelector('.main-nav')).toBeNull();
  });

  it('con sesión muestra la navegación principal', () => {
    supabase.conSesion();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.topbar-title')?.textContent).toContain('Gestor Campos');
    expect(el.querySelectorAll('.main-nav a').length).toBe(5);
  });
});
