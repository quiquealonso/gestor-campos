/**
 * PLANTILLA de configuración de Supabase. La app NO usa este fichero al compilar: se sustituye
 * por `environment.local.ts` (ignorado por git), que tiene los valores reales:
 *
 *   cp src/enviroments/environment.ts src/enviroments/environment.local.ts
 *
 * y rellena (Supabase > Project Settings > API Keys):
 *  - supabaseUrl:     Project URL
 *  - supabaseAnonKey: clave "publishable" (sb_publishable_…) o "anon public". Es PÚBLICA por diseño;
 *                     la seguridad la dan el login y las políticas RLS de supabase/schema.sql.
 *  ¡NUNCA pongas aquí la contraseña de la base de datos ni la clave secret / service_role!
 *
 * `demo: true` (environment.demo.ts) arranca la app con datos ficticios en memoria, sin Supabase.
 */
export const environment = {
  production: false,
  demo: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'sb_publishable_…',
};
