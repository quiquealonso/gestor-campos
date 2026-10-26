/**
 * Modo demo: la app funciona con datos FICTICIOS en memoria (services/demo/), sin Supabase ni
 * login real. Se usa para el vídeo de presentación y la demo de GitHub Pages:
 *   ng serve --configuration demo        ·        ng build --configuration demo
 */
export const environment = {
  production: true,
  demo: true,
  supabaseUrl: '',
  supabaseAnonKey: '',
};
