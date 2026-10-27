// Graba el vídeo de presentación de Gestor Campos: maneja sola la app en MODO DEMO (datos
// ficticios en memoria, sin Supabase ni login real) dentro de un "escenario" 1280×720, con el
// móvil a la derecha y los rótulos a la izquierda.
//
// Antes: npm --prefix front run build:demo   (genera docs/demo, la misma demo que se publica en Pages)
// Resultado: video/out/gestor-campos-demo.webm + capturas del final de cada escena en video/out/capturas
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', 'docs', 'demo');
const OUT = join(HERE, 'out');
const RAW = join(OUT, 'crudo');
/** Capturas del final de cada escena, para revisar el vídeo sin reproducirlo. */
const SNAPS = join(OUT, 'capturas');
const LOGO = join(HERE, '..', 'docs', 'assets', 'gestor-campos-logo.svg');
const PORT = 4310;
const APP = `http://localhost:${PORT}`;

if (!existsSync(join(WEB, 'index.html'))) {
  console.error('Falta la build demo. Ejecuta antes: npm --prefix front run build:demo');
  process.exit(1);
}

// --- Servidor estático de la build demo (mismo origen que el escenario) -----------------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, APP).pathname)).replace(/^([/\\])+/, '');
  const fichero = join(WEB, ruta || 'index.html');
  if (!fichero.startsWith(WEB) || !existsSync(fichero) || ruta.endsWith('/')) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(fichero)] || 'application/octet-stream' });
  res.end(readFileSync(fichero));
});
await new Promise((r) => server.listen(PORT, r));

// --- Escenario -----------------------------------------------------------------------
const logoData = 'data:image/svg+xml;base64,' + readFileSync(LOGO).toString('base64');
const ESCENARIO = /* html */ `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Gestor Campos</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; }
  body { background: radial-gradient(circle at 25% 20%, #1c2b3d, #0d1117 55%, #090d13); color: #e6edf3; }
  .side { position: absolute; left: 80px; top: 0; bottom: 0; width: 640px;
    display: flex; flex-direction: column; justify-content: center; }
  .step { font-size: 18px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #7ee787; margin-bottom: 14px; min-height: 22px; }
  h1 { font-size: 50px; line-height: 1.1; margin: 0 0 22px; }
  p { font-size: 25px; line-height: 1.45; margin: 0; color: #a9b6c3; max-width: 600px; }
  .fade { transition: opacity .35s ease, transform .35s ease; }
  .hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
  .phone { position: absolute; right: 120px; top: 20px; width: 380px; height: 680px;
    border-radius: 46px; background: #000; padding: 12px;
    box-shadow: 0 30px 70px rgba(0,0,0,.55), 0 0 0 2px #2d3748; }
  .phone iframe { width: 356px; height: 656px; border: 0; border-radius: 36px; background: #0d1117; }
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; z-index: 10;
    background: radial-gradient(circle at 50% 40%, #1c2b3d, #0d1117 70%); }
  .card img { width: 170px; height: 170px; margin-bottom: 26px; filter: drop-shadow(0 16px 40px rgba(0,0,0,.5)); }
  .card h1 { font-size: 64px; margin-bottom: 14px; }
  .card p { font-size: 28px; max-width: 900px; }
</style></head>
<body>
  <div class="side">
    <div class="step fade" id="step"></div>
    <h1 class="fade" id="title"></h1>
    <p class="fade" id="text"></p>
  </div>
  <div class="phone"><iframe id="app" src="about:blank"></iframe></div>
  <div class="card fade" id="card"><img src="${logoData}" alt=""><h1 id="cardTitle"></h1><p id="cardText"></p></div>
</body></html>`;

// --- Utilidades ----------------------------------------------------------------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const dir of [RAW, SNAPS]) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) rmSync(join(dir, f));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
});
await context.route(`${APP}/__escenario`, (route) =>
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: ESCENARIO }),
);
const stage = await context.newPage();
await stage.goto(`${APP}/__escenario`);

let snapCount = 0;
async function snap() {
  const name = `${String(++snapCount).padStart(2, '0')}.png`;
  await stage.screenshot({ path: join(SNAPS, name) }).catch(() => undefined);
}

async function caption(step, title, text = '') {
  await snap();
  await stage.evaluate(
    async ([s, t, x]) => {
      const els = ['step', 'title', 'text'].map((id) => document.getElementById(id));
      els.forEach((e) => e.classList.add('hidden'));
      await new Promise((r) => setTimeout(r, 350));
      els[0].textContent = s;
      els[1].textContent = t;
      els[2].textContent = x;
      els.forEach((e) => e.classList.remove('hidden'));
    },
    [step, title, text],
  );
}

async function card(title, text, ms = 3500) {
  await snap();
  await stage.evaluate(([t, x]) => {
    document.getElementById('cardTitle').textContent = t;
    document.getElementById('cardText').textContent = x;
    document.getElementById('card').classList.remove('hidden');
  }, [title, text]);
  await wait(600);
  await snap();
  await wait(Math.max(0, ms - 600));
}

async function hideCard() {
  await stage.evaluate(() => document.getElementById('card').classList.add('hidden'));
  await wait(400);
}

const app = stage.frameLocator('#app');
const appFrame = () => stage.frames().find((f) => f.url().startsWith(APP) && !f.url().includes('__escenario'));

/** Carga la app en el móvil (solo una vez: la demo guarda los datos en memoria). */
async function abrirApp() {
  await stage.locator('#app').evaluate((el, url) => (el.src = url), `${APP}/#/login`);
  await wait(2500);
  await appFrame().evaluate(() => {
    // Los toques se marcan con un círculo, porque la grabación no muestra el cursor.
    const style = document.createElement('style');
    style.textContent = `.__tap{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;
      border-radius:50%;background:rgba(126,231,135,.3);border:3px solid rgba(126,231,135,.85);
      pointer-events:none;animation:__tap .6s ease-out forwards}
      @keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(style);
    document.addEventListener('pointerdown', (e) => {
      const d = document.createElement('div');
      d.className = '__tap';
      d.style.left = e.clientX + 'px';
      d.style.top = e.clientY + 'px';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 700);
    }, true);
  });
}

/** Desplaza suavemente la página del móvil (ventana o .content-area, la que tenga scroll). */
async function scroll(px, ms = 1400) {
  await appFrame().evaluate((dy) => {
    const area = document.querySelector('.content-area');
    const el = area && area.scrollHeight > area.clientHeight + 4 ? area : document.scrollingElement;
    el.scrollBy({ top: dy, behavior: 'smooth' });
  }, px);
  await wait(ms);
}

async function scrollTop() {
  await appFrame().evaluate(() => {
    document.querySelector('.content-area')?.scrollTo({ top: 0 });
    document.scrollingElement.scrollTo({ top: 0 });
  });
}

/** Solo los elementos visibles (muchas vistas repiten botones para móvil y escritorio). */
const visible = (locator) => locator.filter({ visible: true }).first();

async function tap(locator, pause = 700) {
  const el = visible(locator);
  await el.scrollIntoViewIfNeeded();
  await wait(250);
  await el.click();
  await wait(pause);
}

async function type(locator, text, pause = 350) {
  const el = visible(locator);
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await el.fill('');
  await el.pressSequentially(text, { delay: 55 });
  await wait(pause);
}

const nav = (name) => app.locator('nav.main-nav a', { hasText: name });
const button = (name) => app.getByRole('button', { name });
const dialog = app.locator('[role=dialog]').last();

// --- Guion -----------------------------------------------------------------------------
try {
  await card('Gestor Campos', 'Lo que pagas y lo que cobras de cada campo, año a año. En el móvil y en el ordenador.', 4500);
  await abrirApp();
  await hideCard();

  // 1. Login
  await caption('Paso 1 · Acceso', 'Solo entras tú', 'Login con email y contraseña. Los datos están protegidos en la base de datos: nadie más puede verlos.');
  // En la demo el acceso ya viene relleno con datos ficticios.
  await wait(3000);
  await tap(button('Entrar'), 2200);

  // 2. Vista general
  await caption('Paso 2 · Campos', 'Todos tus campos de un vistazo', 'Gastos, ingresos y beneficio de cada campo en el año elegido, y el total por hanegada.');
  await wait(1500);
  await visible(app.locator('select')).selectOption({ label: '2025' });
  await wait(1800);
  await scroll(320, 2200);
  await scroll(-320, 900);

  // 3. Pago conjunto
  await caption('Paso 3 · Pago conjunto', 'Un gasto para todos los campos', 'Se reparte solo entre los campos según su tamaño, al céntimo.');
  await tap(button('Pago conjunto'), 1000);
  await type(dialog.getByLabel('Nombre'), 'Revisión del tractor');
  await type(dialog.getByLabel('Coste'), '480');
  await dialog.locator('app-categoria-select select').selectOption({ label: 'Maquinaria y mantenimiento' });
  await wait(600);
  await tap(dialog.getByRole('button', { name: 'Guardar pago conjunto' }), 2200);

  // 4. Detalle de un campo
  await caption('Paso 4 · Cada campo', 'Al detalle', 'Sus pagos y sus cheques del año. La fecha más reciente, siempre arriba.');
  await tap(app.locator('tr.data-row', { hasText: 'La Solana' }), 2000);
  await scroll(380, 2000);
  await scrollTop();
  await wait(500);
  await caption('Paso 4 · Cada campo', 'Apunta un gasto en segundos', 'Con su categoría. Si aún no está pagado del todo, desmarca la casilla y queda como pendiente.');
  await tap(button('Añadir pago'), 1000);
  await type(dialog.getByLabel('Nombre'), 'Sulfato de cobre');
  await type(dialog.getByLabel('Coste'), '186.40');
  await dialog.locator('app-categoria-select select').selectOption({ label: 'Abonos y fitosanitarios' });
  await wait(500);
  await tap(dialog.getByLabel('Pagado del todo'), 800);
  await tap(dialog.getByRole('button', { name: 'Guardar pago' }), 2000);
  await scroll(300, 2200);

  // 5. Gastos y pendientes
  await caption('Paso 5 · Gastos', 'Qué queda por pagar', 'Todos los gastos del año, con filtros por categoría y por estado, y el total pendiente.');
  await tap(nav('Gastos'), 1800);
  await visible(app.locator('label', { hasText: 'Estado' }).locator('select')).selectOption({ label: 'Pendientes de pagar' });
  await wait(3000);

  // 6. Ingresos
  await caption('Paso 6 · Ingresos', 'Cada cheque, en su campo', 'Las liquidaciones de la cosecha, con filtro por campo y por año.');
  await tap(nav('Ingresos'), 1600);
  await tap(button('Nuevo ingreso'), 1000);
  await dialog.locator('label', { hasText: 'Campo' }).locator('select').selectOption({ label: 'Los Almendros' });
  await wait(500);
  await type(dialog.getByLabel('Cantidad'), '2950');
  await tap(dialog.getByRole('button', { name: 'Guardar ingreso' }), 2200);

  // 7. Estadísticas por año
  await caption('Paso 7 · Estadísticas', 'El año, como un mapa', 'En el centro, el beneficio. Alrededor, en qué se ha ido el dinero, qué ha dado cada campo y qué queda pendiente.');
  await tap(nav('Estadísticas'), 2200);
  await scroll(330, 2200);
  await scroll(330, 2200);
  await scroll(330, 2200);
  await scrollTop();
  await wait(600);
  await tap(app.getByRole('button', { name: 'Año anterior' }), 2500);

  // 8. Entre años
  await caption('Paso 8 · Entre años', '¿Mejor o peor que el año pasado?', 'Gastos, ingresos y beneficio de cada campaña, uno al lado del otro.');
  await tap(app.locator('app-estadisticas-tabs a', { hasText: 'Entre años' }), 2200);
  await scroll(300, 2500);

  // 9. Categorías
  await caption('Paso 9 · Categorías', 'En qué se va el dinero', 'Abonos, riego, mano de obra… Con su color, su total y sus pagos.');
  await tap(nav('Categorías'), 1600);
  await tap(app.locator('button.cat-item__toggle', { hasText: 'Mano de obra' }), 2500);

  await card('Gestor Campos', 'Angular + Supabase · App Android y escritorio · Hecha para el día a día del campo.', 5000);
} catch (e) {
  // Para depurar: cómo estaba la pantalla cuando falló.
  await stage.screenshot({ path: join(OUT, 'error.png') }).catch(() => undefined);
  throw e;
} finally {
  const video = stage.video();
  await context.close();
  await browser.close();
  server.close();
  const path = await video?.path();
  if (path) {
    const final = join(OUT, 'gestor-campos-demo.webm');
    rmSync(final, { force: true });
    renameSync(path, final);
    console.log('Vídeo:', final);
  }
}
