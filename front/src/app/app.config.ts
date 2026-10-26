import { ApplicationConfig, Provider } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { environment } from '../enviroments/environment';
import { CampoService } from './services/campo/campo.service';
import { SupabaseService } from './services/supabase/supabase.service';
import { DemoCampoService, DemoSupabaseService } from './services/demo/demo.services';

/** Modo demo: datos ficticios en memoria en lugar de Supabase (ver environment.demo.ts). */
const proveedoresDemo: Provider[] = environment.demo
    ? [
          { provide: SupabaseService, useClass: DemoSupabaseService },
          { provide: CampoService, useClass: DemoCampoService },
      ]
    : [];

export const appConfig: ApplicationConfig = {
    providers: [
        provideAnimationsAsync(),
        provideRouter(routes, withHashLocation()),
        providePrimeNG({
            theme: {
                preset: Aura
            }
        }),
        ...proveedoresDemo,
    ]
};
