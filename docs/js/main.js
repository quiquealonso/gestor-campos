// Animaciones de la web de Gestor Campos (GSAP + ScrollTrigger + SplitText).
// Sin GSAP o con "reducir movimiento", la página se ve completa y estática.
(() => {
  const root = document.documentElement;
  const $ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const $1 = (sel, scope = document) => scope.querySelector(sel);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  // ---- Modo claro / oscuro (el inicial lo fija el script del <head>) ----
  const themeBtn = $1('[data-theme-toggle]');
  const themeMeta = $1('meta[name="theme-color"]');
  const paintTheme = () => {
    const light = root.dataset.theme === 'light';
    themeBtn?.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    themeMeta?.setAttribute('content', light ? '#f1f7f0' : '#06100c');
  };
  paintTheme();
  themeBtn?.addEventListener('click', (event) => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('gc-theme', next); } catch (e) {}
      paintTheme();
    };
    // El nuevo modo se revela en un círculo que nace del botón (si el navegador lo permite).
    if (!document.startViewTransition || reduce) return apply();
    const r = themeBtn.getBoundingClientRect();
    const x = event.clientX || r.left + r.width / 2;
    const y = event.clientY || r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  });

  // ---- Copiar los comandos ----
  $('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = $1(btn.dataset.copy)?.innerText ?? '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'copiado ✓';
      } catch (e) {
        btn.textContent = 'no se pudo';
      }
      setTimeout(() => (btn.textContent = 'copiar'), 1800);
    });
  });

  // ---- Apariciones y maquetas: solo cuando se ven ----
  const show = (el) => el.classList.add('is-shown', 'is-visible');
  const watched = $('[data-reveal], [data-watch]');
  if (reduce || !('IntersectionObserver' in window)) {
    watched.forEach(show);
  } else {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      }),
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
    );
    watched.forEach((el) => io.observe(el));
  }

  // ---- Cifras que cuentan ----
  const counters = $('[data-count]');
  const countUp = (el) => {
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduce || end === 0) return (el.textContent = end + suffix);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); }
    }), { threshold: 0.6 });
    counters.forEach((el) => { if (!reduce && Number(el.dataset.count)) el.textContent = '0' + (el.dataset.suffix || ''); io.observe(el); });
  }

  // ---- Texto que se "desordena" hasta la siguiente frase ----
  const scramble = $1('[data-scramble]');
  if (scramble && !reduce) {
    const phrases = scramble.dataset.scramble.split('|');
    const glyphs = 'abcdefghijklmnñopqrstuvwxyz€%·';
    let i = 0;
    const to = (target) => new Promise((resolve) => {
      const from = scramble.textContent;
      const len = Math.max(from.length, target.length);
      let frame = 0;
      const tick = () => {
        let out = '';
        for (let k = 0; k < len; k++) {
          const reveal = frame - k * 0.6;
          if (reveal > 8) out += target[k] ?? '';
          else if (reveal > 0) out += target[k] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
          else out += from[k] ?? '';
        }
        scramble.textContent = out;
        frame++;
        if (frame < len * 0.6 + 10) requestAnimationFrame(tick);
        else { scramble.textContent = target; resolve(); }
      };
      tick();
    });
    setInterval(() => { i = (i + 1) % phrases.length; to(phrases[i]); }, 3200);
  }

  // ---- Móvil del hero: las pantallas pasan solas ----
  const carousel = $1('[data-carousel]');
  if (carousel && !reduce) {
    const imgs = $('img', carousel);
    let n = 0;
    setInterval(() => {
      imgs[n].classList.remove('is-on');
      n = (n + 1) % imgs.length;
      imgs[n].classList.add('is-on');
    }, 2800);
  }

  // ---- Recorrido: el móvil fijo cambia de pantalla según el paso que se lee ----
  const steps = $('.tour-step');
  const tourImgs = $('[data-tour-screen] img');
  const dots = $('.tour-progress i');
  const activate = (idx) => {
    steps.forEach((s, k) => s.classList.toggle('is-active', k === idx));
    tourImgs.forEach((im, k) => im.classList.toggle('is-on', k === idx));
    dots.forEach((d, k) => d.classList.toggle('is-on', k === idx));
  };
  if (steps.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) activate(Number(e.target.dataset.step));
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
  }

  // ---- Enlace activo del menú ----
  const links = $('.nav-links a');
  const sections = links.map((a) => $1(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  // ---- GSAP: entrada del hero, títulos, vídeo, inclinación y botones magnéticos ----
  window.addEventListener('load', () => {
    const { gsap, ScrollTrigger, SplitText } = window;
    if (reduce || !gsap) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    // Entrada del hero: letras que suben, luego el resto
    const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    $('[data-split]').forEach((el, k) => {
      const split = SplitText.create(el, { type: 'chars', mask: 'chars' });
      intro.from(split.chars, { yPercent: 110, duration: 1.2, stagger: 0.035 }, k * 0.15);
    });
    intro
      .from('[data-intro]', { y: 26, opacity: 0, duration: 1, stagger: 0.09 }, 0.35)
      .from('[data-intro-phone]', { y: 60, rotate: 4, opacity: 0, duration: 1.4 }, 0.3);

    // Títulos de sección: palabras que suben al entrar
    $('[data-split-scroll]').forEach((el) => {
      const split = SplitText.create(el, { type: 'words', mask: 'words' });
      gsap.from(split.words, {
        yPercent: 105, duration: 1, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    // La ventana del vídeo se acerca mientras haces scroll
    const win = $1('[data-scale]');
    if (win) {
      gsap.fromTo(win, { scale: 0.88, rotateX: 8, transformPerspective: 1200 }, {
        scale: 1, rotateX: 0, ease: 'none',
        scrollTrigger: { trigger: win, start: 'top bottom', end: 'top 25%', scrub: true },
      });
    }

    // El móvil del hero baja más despacio que la página
    gsap.to('.hero-phone', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    // Y el pie se llena al llegar
    gsap.from('.footer-big', { xPercent: -8, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 90%' } });

    if (!finePointer) return;

    // Inclinación del móvil siguiendo el ratón
    const tilt = $1('[data-tilt]');
    if (tilt) {
      const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      gsap.set(tilt, { transformPerspective: 900 });
      window.addEventListener('pointermove', (e) => {
        ry((e.clientX / innerWidth - 0.5) * 14);
        rx(-(e.clientY / innerHeight - 0.5) * 10);
      });
    }

    // Botones magnéticos
    $('[data-magnetic]').forEach((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  });
})();
