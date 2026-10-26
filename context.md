# Contexto del proyecto: Gestor Campos

> Documento de contexto para trabajar con el proyecto. Última revisión: 2026-10-04.

## Qué es
App para gestionar los **campos agrícolas** del propietario: registrar lo que se **paga** (gastos) y lo que se **ingresa** (cheques), con control de balance por campo y por año. Uso personal, un solo usuario (login con Supabase Auth).

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | Angular 20 (standalone components, signals), PrimeNG 20 + PrimeFlex/PrimeIcons (tema Aura; la mayoría de estilos son CSS propio por componente) |
| Escritorio | Electron 40 + electron-builder (portable Windows x64, `npm run electron-build` → `front/dist-electron/`). Carga `dist/gestor-campos/browser/index.html` (base href `./`); no arranca backend |
| Backend | **Ya no lo usa el front.** Node + Express 4 + TypeORM (en `back/`) se conserva para trabajo en local y para los scripts de migración (`migrate:*`, `sync-db:*`) |
| Datos (actual) | El front usa **supabase-js** directamente contra Supabase (`SupabaseService` + `CampoService`), con login (Supabase Auth) y RLS. Esquema, validaciones (CHECK), RLS y funciones en `supabase/schema.sql` |
| Móvil | APK con **Capacitor** (`capacitor.config.json`, `npm run apk:sync`); guía completa en `MOVIL.md` |
| BBDD | PostgreSQL con **dos perfiles**: `local` (localhost:5432, `campos_db`, es el original y el de por defecto) y `supabase` (pooler `aws-0-eu-west-1.pooler.supabase.com`). Config en `back/.env.local` y `back/.env.supabase` |
| Diseño móvil | **No es una app aparte**: el mismo front Angular está adaptado a móvil (responsive, `@media (max-width: 768px)` / `min-width: 769px` en el CSS de cada vista, viewport meta en `index.html`) y los formularios se abren como **diálogos modales** |

## Estructura
```
campos/
├── back/                      # API REST
│   └── src/
│       ├── index.ts           # Arranque Express (cors + json), registra rutas dinámicamente, puerto PORT||3000
│       ├── data-source.ts     # DataSource TypeORM (synchronize: true, entidades en entity/*.ts)
│       ├── routes.ts          # Agrega campo/pago/cheque .routes.ts
│       ├── *.routes.ts        # Arrays {method, route, controller, action}
│       ├── controller/        # CampoController, PagoController, ChequeController
│       ├── entity/            # Campo, Pago, Cheque
│       └── sync-database.ts   # `npm run sync-db`
├── front/
│   ├── electron-main.ts/.js, preload.js
│   ├── src/app/
│   │   ├── app.routes.ts
│   │   ├── components/vista-general | vista-campo | vista-gastos
│   │   ├── model/             # campo, pago, cheque, apiResult (category-type.ts es resto de otro proyecto)
│   │   └── services/campo/campo.service.ts   # único servicio HTTP
│   ├── src/enviroments/environment.ts        # (sic, "enviroments") apiUrl http://localhost:3000/api/campos/v1
│   ├── dist/ y dist-electron/ # builds generados
├── ELECTRON_SETUP.md, create-base-project.ps1 (generador de proyectos base)
```

## Modelo de datos
- **Campo**: `id`, `nombre`, `tamano` (numeric(12,4); superficie en hanegadas), `poligono` (int), `parcela` (int). Relaciones 1-N a Pago y Cheque.
- **Pago** (gasto): `id`, `fecha` (timestamp), `nombre`, `descripcion` (text), `coste` (numeric(12,2)), `anio` (int, nullable), `pagado` (boolean, default true: «Pagado del todo»; false = pendiente), `campo` (ManyToOne, CASCADE), `categoria` (ManyToOne nullable, SET NULL).
- **Cheque** (ingreso): `id`, `dia` (timestamp), `cantidad` (numeric(12,2)), `anio` (int, nullable), `campo` (ManyToOne, onDelete CASCADE).

- **Categoria**: `id`, `nombre` (único), `color` (#RRGGBB). Por defecto se siembran: Semillas y plantas, Abonos y fitosanitarios, Combustible, Maquinaria y mantenimiento, Mano de obra, Riego y agua, Seguros e impuestos, Arrendamiento y **Sin categoría**.
- Los `numeric` se devuelven como `number` mediante `utils/transformers.ts`.

`anio` permite asignar un movimiento a una campaña distinta del año de su fecha. Si es null, el front usa el año de `fecha`/`dia`.

## Acceso a datos actual: Supabase (sin backend propio)
- `front/src/app/services/supabase/supabase.service.ts`: cliente, sesión (`sesion` signal), `login/logout`. Config real en `front/src/enviroments/environment.local.ts` (ignorado por git; `environment.ts` es la plantilla y `angular.json` la sustituye al compilar; `environment.demo.ts` = modo demo con datos ficticios) (`supabaseUrl`, `supabaseAnonKey`; la anon key es pública, nunca poner password de BBDD ni service_role).
- `front/src/app/services/campo/campo.service.ts` mantiene los mismos métodos/Observables que antes, pero con `supabase-js`; los errores llegan como `Error(mensaje legible)` (`mensajeDeError`).
- Relaciones en las consultas: `campo:campo(id,nombre)`, `categoria:categoria(id,nombre,color)`; columnas FK `"campoId"` / `"categoriaId"` (camelCase heredado de TypeORM).
- Funciones SQL (RPC): `pago_conjunto(..., p_pagado)` (reparto por tamaño en céntimos), `eliminar_categoria(p_id,p_accion,p_destino)`, `categorizar_pagos()`.
- Validación: restricciones CHECK en la BBDD (importes, nombres, años 1989-2100, fechas 1990-2100, color #RRGGBB) + validación en formularios.
- Seguridad: RLS en las 4 tablas con política `propietario` (`es_propietario()`, security definer, mira la tabla `public.propietario(email)`, que no se expone por la API y se rellena a mano en el SQL Editor); `anon` sin acceso. Registro de usuarios desactivado en Supabase.
- Auth en el front: `/login`, `authGuard`/`loginGuard`, botón de salir en la barra superior, router con **hash location** (`withHashLocation`) para que funcione dentro del APK.

## API REST antigua del backend Express (solo en `back/`, ya no la usa el front) (prefijo `/api/campos/v1`)
Respuesta siempre `{ message, object }`; errores 4xx/5xx con el mismo formato.
- Campos: `GET /campos` (incluye `pagos`), `GET /campos/:id`, `POST /campos`, `PUT /campos/:id`, `DELETE /campos/:id`
- Pagos: `GET /pagos`, `GET /pagos/campo/:campoId`, `GET /pagos/:id`, `POST /pagos`, `PUT /pagos/:id`, `DELETE /pagos/:id` (todos devuelven `categoria`)
- **`POST /pagos/conjunto`**: reparte un gasto entre TODOS los campos proporcionalmente a `tamano`, trabajando en céntimos con método del resto mayor para que la suma cuadre; transacción única.
- Cheques: `GET /cheques`, `GET /cheques/campo/:campoId`, `GET /cheques/:id`, `POST /cheques`, `PUT /cheques/:id`, `DELETE /cheques/:id`
- Categorías: `GET /categorias`, `POST /categorias`, `PUT /categorias/:id`, `DELETE /categorias/:id?accion=sin|mover|eliminar&destino=<id>` (por defecto los pagos pasan a «Sin categoría»; «Sin categoría» no se puede borrar)
- `GET /campos/:id` añade `numPagos` y `numCheques` (para avisar antes de borrar).
- **Validación en servidor** (`utils/validate.ts`): campos obligatorios, importes > 0 redondeados a 2 decimales, fechas 1990-2100, año 1989-2100, existencia de campo/categoría; 400 con mensaje legible, 409 si duplicado, 500 genérico sin filtrar detalles. Solo se aceptan campos conocidos (no se guarda `body` tal cual).

## Frontend: vistas
- `/` **VistaGeneral**: tarjetas por campo con gastos/ingresos/beneficio del año seleccionado, totales, alta de campo y alta de pago conjunto.
- `/campos/:id` (y `/vista-campo`) **VistaCampo**: detalle de un campo; pagos (tabla ordenable y paginada, 10/pág) y cheques del año; altas/ediciones/borrado de pago, alta de cheque, edición del campo, selector de campo.
- `/gastos` **VistaGastos**: listado global de pagos del año, ordenable por fecha/coste, paginado, con CRUD.
- `/ingresos` **VistaIngresos**: cheques del año, filtro por campo, orden, paginación, alta/edición/borrado con diálogo.
- **Estadísticas** (pestañas «Por año» / «Entre años», componente `EstadisticasTabsComponent` en `vista-comparativa/estadisticas-comun.ts`; `/comparativa` redirige aquí):
  - `/estadisticas` **VistaComparativa**: «mapa mental» del año: nodo central (año con flechas ‹ ›, beneficio, €/hanegada) y 4 ramas: Gastos por categoría, Ingresos por campo, Campos (beneficio, ▲▼ vs año anterior) y Pendiente de pagar. Filtros año y campo; acepta `?anio=`. En ≥900px ramas en fila con líneas al nodo; en móvil, árbol vertical.
  - `/estadisticas/anios` **VistaEvolucion**: solo comparación entre años (gráfico de barras + tabla con variación del beneficio), filtro por campo; pulsar un año abre su mapa.
- `/categorias` **VistaCategorias**: lista de categorías (color, nº de pagos, total) desplegables con sus pagos; crear/editar (nombre + color), eliminar con elección sobre sus pagos (dejarlos en «Sin categoría», moverlos a otra o eliminarlos), mover o eliminar pagos individuales. «Sin categoría» no se puede eliminar.
- Navegación global: **barra inferior fija (footer)** en `app.html` con iconos PrimeIcons (Campos · Gastos · Ingresos · Comparativa · Categorías); `.content-area` tiene padding inferior para no quedar tapado. Los diálogos (z-index 1100) cubren la barra (1000).
- Gastos: filtros por año, categoría (`categoriaFiltroId`: null=todas, -1=sin asignar) y estado (todos/pendientes/pagados) con total pendiente. Listas de pagos ordenadas por defecto con la fecha más reciente primero.
- Pagado: casilla «Pagado del todo» (`.check-pagado`) en los formularios de pago y pago conjunto; etiqueta `.badge-pendiente` en las tablas (estilos globales en `styles.css`). `CampoService.setPagado(id, pagado)` para cambiarlo sin tocar el resto.
- Categorías: componente `categoria-select` (selector + alta rápida; **estilos propios dentro del componente**, porque el CSS de las vistas no le afecta) usado en los formularios de pago y pago conjunto; chip de color en las tablas de pagos.
- Estados: carga (`.state-box` + `.spinner`), error con botón Reintentar y vacío, estilos globales en `styles.css`. El servicio ya **no** traga errores: lanza `Error` con mensaje legible (`mensajeDeError`).
- Eliminar campo: botón en el diálogo de edición; confirmación obligando a escribir el nombre y mostrando cuántos pagos/cheques se perderán.
- Las tablas de Comparativa y Categorías reutilizan el estilo de tabla de la vista general (`.data-table` + `.table-scroll`); `html, body` tienen `overflow-x: hidden` para evitar scroll horizontal de página.
- Detalle de campo: en móvil se muestra un banner con el nombre, polígono, parcela y tamaño (`.campo-banner`).
- Año de un cheque/pago: `anio` si existe, si no el año de la fecha (igual en todas las vistas).
- Convenciones: signals + `computed`, `forkJoin` para cargar, filtrado por año en cliente, textos en español, los errores del servicio llegan al `error:` del subscribe como `Error(message)`.

## Diseño móvil / diálogos
- Mobile-first en la práctica: cada vista tiene su bloque `@media (max-width: 768px)` y otro `@media (min-width: 769px)` en su propio CSS.
- Todos los formularios (alta/edición de campo, pago, cheque y pago conjunto) son **diálogos modales** con el patrón: `form-panel-backdrop` + `form-card form-card--dialog` (`role="dialog"`, `aria-modal`, `aria-labelledby`), con `dialog-lead` y `dialog-field-summary` como cabecera. Se controlan con signals `mostrarFormulario*`. Reutilizar este patrón en cualquier formulario nuevo.
- Al tocar una vista, comprobar siempre ambos breakpoints.

## Perfiles de BBDD y migración (scripts del back)
> En Supabase el esquema lo crea `supabase/schema.sql`; los scripts del back **no** sincronizan TypeORM contra Supabase (borraría los CHECK). `migrate:local-to-supabase -- --replace` solo copia datos.
- Perfil = `DB_PROFILE` o primer argumento (`local`|`supabase`); por defecto `local` (también lo que usa Electron). Lo resuelve `back/src/data-source.ts`.
- Back: `npm run start:local` / `npm run start:supabase`; esquema: `npm run sync-db:local` / `sync-db:supabase`.
- `src/schema.ts` → `ensureSchema()`: convierte `float`→`numeric` con `ALTER ... USING` (sin perder datos), sincroniza tablas (solo local al arrancar; en Supabase con `sync-db:supabase`), siembra categorías y **auto-categoriza por palabras clave** los pagos sin categoría (el resto → «Sin categoría»). `synchronize` de TypeORM está siempre desactivado en el DataSource.
- Tras actualizar a esta versión: arrancar en local (`npm start`) o `npm run sync-db:local`/`sync-db:supabase` una vez.
- Migración (conserva ids, reajusta secuencias, verifica conteos): `npm run migrate:local-to-supabase` (o `supabase-to-local`). Añadir tras `--`: `--dry-run` (solo cuenta) y `--replace` (vacía el destino; sin él aborta si hay datos).
- Los `.env*` están en `.gitignore`. Rellenar `DB_PASSWORD` en `.env.local`.

## Cómo ejecutar
- Back: `cd back && npm i && npm start` (necesita `back/.env.local` o `.env.supabase`, ver `.env.example`: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, PORT).
- Front: `cd front && npm i && npm start` (http://localhost:4200). Escritorio: `npm run electron-dev`; empaquetar: `npm run electron-build`.

## Puntos de atención / deuda técnica detectados


5. `front/package.json` depende de `typeorm` (no hace falta en el front) y arrastra `category-type.ts` sin uso.
9. Los `back/.env*` tienen credenciales reales: están en `.gitignore` (raíz y `back/`). Nunca subirlos. La config real de Supabase del front va en `environment.local.ts` (ignorado).
10. Tests básicos (Karma, `npm test`): App, LoginComponent, guards y utils de dinero. `src/testing/supabase-fake.ts` sustituye a SupabaseService.
11. Comentarios y logs mezclan español y catalán; mantener español en UI y mensajes.

## Demo, vídeo y web (repo GitHub `quiquealonso/gestor-campos`)
- **Modo demo** (`ng serve|build --configuration demo`, `npm run demo` / `build:demo`): `environment.demo.ts` (`demo: true`) hace que `app.config.ts` sustituya `SupabaseService`/`CampoService` por `services/demo/demo.services.ts` (datos ficticios en memoria de `datos-demo.ts`, semilla fija; login acepta cualquier email). La build sale en `docs/demo/` (GitHub Pages).
- **Vídeo**: `video/grabar.mjs` (Playwright) sirve `docs/demo`, graba un escenario 1280×720 con el móvil y rótulos; MP4/póster en `docs/media/`, capturas del móvil en `docs/assets/capturas/`. Ver `video/README.md`. Al cambiar la UI, regenerar demo + vídeo + capturas.
- **Web**: `docs/index.html` (GitHub Pages desde `main` /docs). Logo: `docs/assets/gestor-campos-logo.svg` (copia en `front/public/logo.svg`, usado en login, barra superior y favicon).
- Nada personal en el repo: ni emails (los propietarios están en la tabla `propietario` de Supabase), ni claves, ni `.env`, ni APK.

## Pendiente de aclarar
- Si el .exe Electron es el modo de uso principal o solo se usa en desarrollo, y cómo se accede desde el móvil (¿navegador contra el back expuesto, o PWA?).
