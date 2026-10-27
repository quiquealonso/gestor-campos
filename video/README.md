# Vídeo de demostración

Vídeo de minuto y medio que enseña Gestor Campos con **datos ficticios** (campos «La Solana»,
«Bancal del Pozo», «Los Almendros»…). Lo graba sola la app, sin voz y con rótulos en pantalla:

1. Portada.
2. Acceso (login).
3. Vista general de los campos.
4. Pago conjunto repartido entre todos los campos.
5. Detalle de un campo y alta de un pago pendiente.
6. Gastos pendientes de pagar.
7. Nuevo ingreso.
8. Estadísticas: el año como mapa mental.
9. Comparación entre años.
10. Categorías.
11. Cierre.

Resultado:
- `video/out/gestor-campos-demo.webm` (1280×720, ignorado por git).
- Capturas del final de cada escena en `video/out/capturas/`, para revisarlo sin reproducirlo.
- La versión publicada en MP4, con su póster, está en `docs/media/`, y las capturas del móvil en
  `docs/assets/capturas/`.

## Cómo se monta

- **Modo demo**: `ng build --configuration demo` usa `environment.demo.ts`, que sustituye
  `SupabaseService` y `CampoService` por `services/demo/demo.services.ts`. Los datos se generan en
  memoria (`services/demo/datos-demo.ts`, siempre iguales) y el login viene relleno con un acceso ficticio (`demo@gestorcampos.es` / `demo`):
  **no se conecta a Supabase ni toca datos reales**.
- La build demo sale en `docs/demo/`: es la misma que se publica en GitHub Pages.
- **Grabación**: Playwright (`grabar.mjs`) sirve `docs/demo` en `localhost:4310`, carga un
  «escenario» de 1280×720 con el móvil a la derecha (la app en un iframe de 356 px de ancho) y los
  rótulos a la izquierda, y graba la pantalla. Los toques se marcan con un círculo, porque la
  grabación no muestra el cursor.

## Volver a grabarlo

Una sola vez:

```bash
cd video && npm install && npx playwright install chromium
```

Cada vez:

```bash
# 1) build demo (docs/demo)
npm --prefix front run build:demo
# 2) grabar
node video/grabar.mjs
# 3) MP4 y póster para publicar (ffmpeg)
ffmpeg -i video/out/gestor-campos-demo.webm -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart -an docs/media/gestor-campos-demo.mp4
ffmpeg -ss 20 -i docs/media/gestor-campos-demo.mp4 -frames:v 1 -q:v 3 docs/media/gestor-campos-demo-poster.jpg
```

- Para sacar una captura del móvil de una escena: `ffmpeg -i video/out/capturas/05.png -vf "crop=356:656:792:32" docs/assets/capturas/campos.jpg`.
- Si la grabación falla, deja `video/out/error.png` con la pantalla del momento del fallo.
- Para cambiar el guion (textos, datos, ritmo), edita `grabar.mjs`. Cada escena es un `caption(...)`
  seguido de toques (`tap`) y textos escritos (`type`).
