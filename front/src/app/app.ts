import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from './services/supabase/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'campos';
  private router = inject(Router);
  protected supabase = inject(SupabaseService);

  async cerrarSesion(): Promise<void> {
    await this.supabase.logout();
    await this.router.navigate(['/login']);
  }

  navegar(ruta: string) {
    this.router.navigate([ruta]);
  }
}
