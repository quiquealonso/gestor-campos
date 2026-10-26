# Gestor Campos en el móvil (Supabase + APK)

La app ya **no necesita servidor propio**: el front habla directamente con Supabase.
La seguridad la dan el **login** y las **políticas RLS** de la base de datos (no el secreto de la URL ni del APK).

## 1. Preparar Supabase (una sola vez)

1. **Autenticación → Providers → Email**: activa Email. En **Authentication → Sign In / Providers → "Allow new users to sign up"** ponlo en **OFF** para que nadie más pueda registrarse.
2. **Authentication → Users → Add user**: crea tu usuario (tu email + contraseña, marca "Auto confirm user").
3. **SQL Editor**: ejecuta `supabase/schema.sql` (es idempotente: se puede repetir) y, una sola vez, autoriza tu email:
   `insert into public.propietario (email) values ('tu-email@ejemplo.com');`
   Crea/ajusta tablas (importes a `numeric`), validaciones, RLS, las funciones `pago_conjunto` y `eliminar_categoria`, siembra las categorías y clasifica los pagos que ya haya.
4. **Project Settings → API**: copia la **Project URL** y la clave **anon public**.
5. Copia `front/src/enviroments/environment.ts` a `environment.local.ts` (ignorado por git) y pega ahí `supabaseUrl` y `supabaseAnonKey`.
   La clave `anon` es pública por diseño; sin login y sin cumplir la política RLS no da acceso a ningún dato.
   **Nunca** pongas ahí la contraseña de la base de datos ni la clave `service_role`.

## 2. Pasar los datos de tu BBDD local a Supabase (si tienes datos en local)

Con tu PostgreSQL local arrancado y `back/.env.local` / `back/.env.supabase` rellenados:

```bash
cd back
npm run migrate:local-to-supabase -- --dry-run     # solo cuenta filas
npm run migrate:local-to-supabase -- --replace     # vacía Supabase y copia todo (conserva ids)
```

(`schema.sql` debe haberse ejecutado antes; el script no crea tablas en Supabase.)

## 3. Probar en el ordenador

```bash
cd front
npm install
npm start          # http://localhost:4200  → entra con tu usuario de Supabase
```

## 4. Generar el APK (Capacitor)

Requisitos: **Android Studio** (incluye el SDK de Android y el JDK).

```bash
cd front
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap add android          # solo la primera vez (crea la carpeta android/)
npm run apk:sync             # compila en producción y copia la web al proyecto Android
npm run apk:open             # abre Android Studio
```

En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
El archivo queda en `front/android/app/build/outputs/apk/debug/app-debug.apk`.
Pásalo al móvil (cable, Drive, Telegram…) y ábrelo; Android pedirá permitir "instalar apps desconocidas".

Para actualizar la app tras cambios: `npm run apk:sync` y volver a generar/instalar el APK.

## ¿Qué ve alguien que consiga el APK?

Solo la pantalla de login. El APK lleva la URL del proyecto y la clave `anon` (públicas); sin tu email y contraseña,
y con el registro desactivado, Supabase no devuelve ningún dato (RLS).

## Alternativa sin APK (opcional)

El mismo front se puede alojar como web estática (Cloudflare Pages, Netlify, Vercel…) e instalar como PWA.
Aunque la URL sea pública, solo se ve el login. Si quieres ocultarla del todo, Cloudflare Access permite
restringir el acceso por email.
