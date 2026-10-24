// Bettél - page controller (Lenis + GSAP ScrollTrigger, 3D watch, builder).
import { WatchStudio, webglAvailable } from './watch3d.js';
import { PRODUCTS } from './data.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const narrow = () => innerWidth < 861;
const EMAIL = 'info@bettelwatches.com';
const SHOP = 'https://www.bettelwatches.com/shop/';
const fmtZar = n => 'R' + n.toLocaleString('en-ZA').replace(/,/g, ' ');
if (reduced) root.classList.add('no-motion');

// ------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reduced && Lenis) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToEl(el) {
  const off = -(($('.hdr')?.offsetHeight || 72) - 1);
  if (lenis) lenis.scrollTo(el, { offset: el === 0 ? 0 : off, duration: 1.4 });
  else if (el === 0) scrollTo({ top: 0 }); else el.scrollIntoView();
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#top' ? 0 : id.length > 1 && $(id);
  if (el === false || el === null) return;
  e.preventDefault();
  closeMenu();
  if (a.dataset.preset) applyPreset(a.dataset.preset);
  scrollToEl(el);
});

// ------------------------------------------------------------ header + menu
const hdr = $('[data-hdr]');
let lastY = 0;
function onScroll() {
  const y = scrollY;
  hdr.classList.toggle('is-solid', y > 40);
  hdr.classList.toggle('is-hidden', y > 600 && y > lastY + 2 && !menuOpen);
  if (y < lastY - 2) hdr.classList.remove('is-hidden');
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const menuBtn = $('.hdr__menu'), menu = $('#menu');
let menuOpen = false;
function closeMenu() { if (!menuOpen) return; menuOpen = false; menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); lenis?.start(); }
menuBtn.addEventListener('click', () => {
  menuOpen = !menuOpen; menu.hidden = !menuOpen; menuBtn.setAttribute('aria-expanded', String(menuOpen));
  menuOpen ? lenis?.stop() : lenis?.start();
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

// ------------------------------------------------------------ materials band
if (!reduced) {
  const track = $('.band__track');
  [...track.children].forEach(n => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
}

// ------------------------------------------------------------ display type fit
// the headline must never run under the 3D watch: measure real rects and shrink until clear
const title = $('[data-wordmark]'), media = $('[data-hero-media]');
function fitTitle() {
  title.style.fontSize = '';
  if (narrow()) return;
  let fs = parseFloat(getComputedStyle(title).fontSize);
  for (let i = 0; i < 30; i++) {
    const widest = Math.max(...$$('.ln > span', title).map(s => s.getBoundingClientRect().right));
    if (widest + 24 <= media.getBoundingClientRect().left || fs < 28) break;
    fs -= 2; title.style.fontSize = fs + 'px';
  }
}
document.fonts?.ready.then(fitTitle); fitTitle();
addEventListener('resize', fitTitle);

// ------------------------------------------------------------ 3D watches
const gl = webglAvailable();
let hero = null, story = null;
if (gl) {
  try {
    hero = new WatchStudio($('[data-gl="hero"]'));
    story = new WatchStudio($('[data-gl="story"]'), { dpr: 1.75 });
    root.classList.add('has-gl');
  } catch (err) { console.warn('3D disabled:', err); hero = story = null; }
}
if (hero) {
  hero.tPitch = 0.22; hero.tYaw = -0.5; hero.scale = 1.75; hero.resize();
  if (finePointer && !reduced) {
    addEventListener('pointermove', e => { hero.pointer.x = (e.clientX / innerWidth - 0.5) * 2; hero.pointer.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  }
  if (reduced) hero.still();
}

// hero intro + turn the watch over as the hero scrolls away
const heroEl = $('.hero');
if (!reduced) {
  gsap.from('.hero__title .ln > span', { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.09, delay: 0.15 });
  gsap.from(['.hero .eyebrow', '.hero__lede', '.hero__ctas', '.hero__facts'], { opacity: 0, y: 18, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.45 });
  gsap.from('.hero__stage', { opacity: 0, scale: 0.92, duration: 1.6, ease: 'expo.out', delay: 0.1 });
  if (hero) {
    ScrollTrigger.create({
      trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: st => {
        const p = st.progress;
        hero.tYaw = -0.5 + p * (Math.PI + 0.5);
        hero.tPitch = 0.22 + p * 0.2;
        heroEl.classList.toggle('is-turned', p > 0.42);
      },
    });
  }
}

// ------------------------------------------------------------ making-of story
const steps = $$('.step'), bars = $$('.making__progress li');
const DIAL_SEQ = ['beech', 'walnut', 'carbon'];
let lastDial = 'walnut';
function storyAt(p) {
  const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
  bars.forEach((b, i) => b.classList.toggle('on', i <= idx));
  steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
  if (!story) return;
  // exploded while sketching and cutting, assembled by the finishing step
  const asm = Math.min(1, Math.max(0, (p - 0.08) / 0.78));
  story.explode(1 - asm);
  story.tYaw = -1.05 + asm * 1.05 + Math.sin(p * Math.PI) * 0.25;
  story.tPitch = 0.42 - asm * 0.3;
  // the dial step cycles through the three dials, then settles on walnut
  const local = p * steps.length - 2;
  const dial = local >= 0 && local < 1 ? DIAL_SEQ[Math.min(2, Math.floor(local * 3))] : 'walnut';
  if (dial !== lastDial) { story.setDial(dial); lastDial = dial; }
}
if (story) { story.idle = !reduced; story.scale = 1; }
if (reduced) {
  storyAt(0.999);
  story?.still();
} else {
  storyAt(0);
  ScrollTrigger.create({ trigger: '.steps', start: 'top 70%', end: 'bottom bottom', scrub: true, onUpdate: st => storyAt(st.progress) });
  steps.forEach(s => {
    gsap.from(s.children, { opacity: 0, y: 30, duration: 0.9, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: s, start: 'top 75%' } });
  });
}

// ------------------------------------------------------------ workshop film + counters
const film = $('.film'), video = $('.film__video');
if (!reduced) {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!video.src) { video.src = video.dataset.src; }
      video.play().catch(() => {});
    } else video.pause();
  }, { rootMargin: '200px' }).observe(film);
  $$('[data-count]').forEach(b => {
    const n = +b.dataset.count, o = { v: 0 };
    b.textContent = '0';
    gsap.to(o, { v: n, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: film, start: 'top 60%' }, onUpdate: () => { b.textContent = Math.round(o.v); } });
  });
}

// ------------------------------------------------------------ range cards
const FEATURED = [
  { slug: 'albatross-walnut', strap: 'brown', tag: 'Bestseller', spec: '44 mm · American walnut · Brown strap', cfg: '44,quartz,walnut,silver,brown' },
  { slug: 'acorn-beech', strap: 'tan', gold: true, tag: 'Ladies bestseller', spec: '36 mm · White beech · Gold · Tan strap', cfg: '36,quartz,beech,gold,tan' },
  { slug: 'albatross-automatic-walnut', strap: 'brown', tag: 'Automatic', spec: '44 mm · Automatic skeleton · Walnut', cfg: '44,skeleton,walnut,silver,brown' },
  { slug: 'automatic-40mm-date-beech', strap: 'black', tag: 'Automatic', spec: '40 mm · Automatic date · White beech · Black strap', cfg: '40,date,beech,silver,black' },
  { slug: 'carbon-portal-44mm', strap: 'black', tag: 'Carbon', spec: '44 mm · Carbon fibre dial · Black strap', cfg: '44,quartz,carbon,silver,black' },
];
const imgOf = (slug, strap, gold) => `assets/img/w/${slug}-${strap}-1${gold ? '-gold' : ''}.webp`;
const cards = $('[data-cards]');
cards.innerHTML = FEATURED.map(f => {
  const p = PRODUCTS[f.slug];
  return `<article class="card" data-reveal>
    <div class="card__img"><span class="card__tag">${f.tag}</span>
      <img src="${imgOf(f.slug, f.strap, f.gold)}" alt="${p.name}, ${f.spec}" width="1100" height="1100" loading="lazy">
      <img src="${imgOf(f.slug, f.strap, !f.gold)}" alt="" width="1100" height="1100" loading="lazy">
    </div>
    <div class="card__body"><div><h3>${p.name}</h3><p class="card__spec">${f.spec}</p></div><p class="card__price">${fmtZar(p.zar)}</p></div>
    <div class="card__act"><a href="#builder" data-preset="${f.cfg}">Open in the builder</a><a href="${SHOP}${f.slug}/" target="_blank" rel="noopener">Details</a></div>
  </article>`;
}).join('') + `<article class="card" data-reveal>
    <div class="card__img"><span class="card__tag">Sunglasses</span>
      <img src="assets/img/s/wooden-sunglasses-brown-1.webp" alt="The Curve wooden sunglasses" width="1100" height="1100" loading="lazy">
      <img src="assets/img/s/wooden-sunglasses-brown-2.webp" alt="" width="1100" height="1100" loading="lazy">
    </div>
    <div class="card__body"><div><h3>The Curve</h3><p class="card__spec">Wooden sunglasses · Polarised UV400 lenses</p></div><p class="card__price">${fmtZar(3900)}</p></div>
    <div class="card__act"><a href="#sunglasses">See the sunglasses</a><a href="${SHOP}wooden-sunglasses/" target="_blank" rel="noopener">Details</a></div>
  </article>`;

// ------------------------------------------------------------ builder
// size -> movement -> dial -> slug (every combination Bettél actually makes)
const SKU = {
  36: { quartz: { beech: 'acorn-beech', walnut: 'acorn-walnut' } },
  40: { quartz: { beech: 'favourite-beech', walnut: 'favourite-walnut', carbon: 'carbon-portal-40mm' },
        skeleton: { beech: 'automatic-40mm-beech', walnut: 'automatic-40mm' },
        date: { beech: 'automatic-40mm-date-beech', walnut: 'automatic-40mm-date' } },
  44: { quartz: { beech: 'albatross-beech', walnut: 'albatross-walnut', carbon: 'carbon-portal-44mm' },
        skeleton: { beech: 'albatross-automatic-beech', walnut: 'albatross-automatic-walnut' },
        date: { beech: 'albatross-automatic-date-beech', walnut: 'albatross-automatic-date' } },
};
const LABEL = { quartz: 'Quartz', skeleton: 'Automatic skeleton', date: 'Automatic date', beech: 'White beech', walnut: 'American walnut', carbon: 'Carbon', silver: 'Silver', gold: 'Gold', brown: 'Brown', black: 'Black', tan: 'Tan' };
const cfg = { size: '44', movement: 'quartz', dial: 'walnut', metal: 'silver', strap: 'brown' };
const valid = c => !!SKU[c.size]?.[c.movement]?.[c.dial];
const bimgs = $$('[data-bimg]');
let view = 'front';

function resolve(changed) {
  if (valid(cfg)) return '';
  const order = ['size', 'movement', 'dial'].filter(k => k !== changed);
  const fallbacks = { size: ['44', '40', '36'], movement: ['quartz', 'skeleton', 'date'], dial: ['walnut', 'beech', 'carbon'] };
  for (const k of order) {
    for (const v of fallbacks[k]) { const t = { ...cfg, [k]: v }; if (valid(t)) { const was = cfg[k]; cfg[k] = v; return noteFor(changed, k, was, v); } }
  }
  for (const a of fallbacks[order[0]]) for (const b of fallbacks[order[1]]) {
    const t = { ...cfg, [order[0]]: a, [order[1]]: b };
    if (valid(t)) { Object.assign(cfg, t); return 'We adjusted your other choices to a watch we make.'; }
  }
  return '';
}
function noteFor(changed, k, was, v) {
  if (changed === 'dial' && cfg.dial === 'carbon') return 'The carbon dial comes with a quartz movement, in 40 or 44 mm.';
  if (changed === 'size' && cfg.size === '36') return 'The 36 mm Acorn comes in beech or walnut, with a quartz movement.';
  if (changed === 'movement' && cfg.movement !== 'quartz' && k === 'size') return 'Automatics come in 40 and 44 mm.';
  if (changed === 'movement' && cfg.movement !== 'quartz' && k === 'dial') return 'Automatics come with beech or walnut dials.';
  const name = { size: 'case size', movement: 'movement', dial: 'dial' }[k];
  return `We changed the ${name} from ${LABEL[was] || was + ' mm'} to ${LABEL[v] || v + ' mm'} to match.`;
}
function viewSrc(slug) {
  const g = cfg.metal === 'gold';
  if (view === 'front') return imgOf(slug, cfg.strap, g);
  if (view === 'box') return 'assets/img/x/detail-box.webp';
  return `assets/img/x/detail-${view}${g ? '-gold' : ''}.webp`;
}
let swapTok = 0;
function showImg(src, alt) {
  const on = bimgs.find(i => i.classList.contains('is-on')), off = bimgs.find(i => i !== on);
  if (on.getAttribute('src') === src) return;
  const tok = ++swapTok;
  off.onload = () => { if (tok !== swapTok) return; off.alt = alt; off.classList.add('is-on'); on.classList.remove('is-on'); on.alt = ''; };
  off.src = src;
  if (off.complete && off.naturalWidth) off.onload();
}
function renderBuilder(note = '') {
  const slug = SKU[cfg.size][cfg.movement][cfg.dial], p = PRODUCTS[slug];
  $$('.builder .opt').forEach(fs => {
    const k = fs.dataset.opt;
    $$('button', fs).forEach(b => {
      b.setAttribute('aria-pressed', String(cfg[k] === b.dataset.v));
      b.classList.toggle('is-off', !valid({ ...cfg, [k]: b.dataset.v }));
    });
  });
  $('[data-b-name]').textContent = p.name;
  $('[data-b-price]').textContent = fmtZar(p.zar);
  $('[data-b-usd]').textContent = `approx. US$${p.usd}`;
  $('[data-b-desc]').textContent = p.desc;
  $('[data-b-size]').textContent = cfg.size + ' mm';
  const specs = [['Case', 'Kiaat'], ['Dial', p.dial], ['Case size', p.size], ['Movement', p.movement || (cfg.movement === 'date' ? 'Japanese automatic, date' : 'Japanese automatic')],
    ['Metal', LABEL[cfg.metal]], ['Strap', `${LABEL[cfg.strap]} full-grain leather`], ['Fits wrists', p.wrist], ['Strap width', p.strap], ['Thickness', p.thick], ['Weight', p.weight]].filter(s => s[1]);
  $('[data-b-specs]').innerHTML = specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const ship = $('[data-b-ship]');
  ship.textContent = p.ship; ship.classList.toggle('is-mto', /order/i.test(p.ship));
  const subject = `Order: ${p.name} (${LABEL[cfg.metal]}, ${LABEL[cfg.strap].toLowerCase()} strap)`;
  const body = `Hello Bettél,\n\nI would like to order:\n\n${p.name}\nCase size: ${cfg.size} mm\nMovement: ${LABEL[cfg.movement]}\nDial: ${LABEL[cfg.dial]}\nMetal: ${LABEL[cfg.metal]}\nStrap: ${LABEL[cfg.strap]}\nPrice: ${fmtZar(p.zar)} (approx. US$${p.usd})\n\nShip to:\n\nThank you`;
  $('[data-b-order]').href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $('[data-b-shop]').href = `${SHOP}${slug}/${cfg.metal === 'gold' ? '#gold' : ''}`;
  $('[data-note]').textContent = note;
  showImg(viewSrc(slug), `${p.name}, ${LABEL[cfg.metal].toLowerCase()} with a ${LABEL[cfg.strap].toLowerCase()} strap`);
  const thumbs = $('[data-thumbs]');
  const g = cfg.metal === 'gold';
  const T = [['front', imgOf(slug, cfg.strap, g), 'Front'], ['side', `assets/img/x/detail-side${g ? '-gold' : ''}.webp`, 'Side'], ['back', `assets/img/x/detail-back${g ? '-gold' : ''}.webp`, 'Back'], ['box', 'assets/img/x/detail-box.webp', 'In the box']];
  thumbs.innerHTML = T.map(([v, src, l]) => `<button type="button" data-view="${v}" aria-pressed="${v === view}" aria-label="${l}"><img src="${src}" alt="" width="1100" height="1100" loading="lazy"></button>`).join('');
}
$$('.builder .opt').forEach(fs => fs.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = fs.dataset.opt; cfg[k] = b.dataset.v;
  if (k !== 'metal' && k !== 'strap') view = 'front';
  renderBuilder(resolve(k));
}));
$('[data-thumbs]').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  view = b.dataset.view; renderBuilder($('[data-note]').textContent);
});
function applyPreset(s) {
  const [size, movement, dial, metal, strap] = s.split(',');
  Object.assign(cfg, { size, movement, dial, metal, strap }); view = 'front'; renderBuilder();
}
renderBuilder();
// warm the cache for the current slug's other strap and metal variants
const warm = () => { const slug = SKU[cfg.size][cfg.movement][cfg.dial]; for (const s of ['brown', 'black', 'tan']) for (const g of [false, true]) { const i = new Image(); i.src = imgOf(slug, s, g); } };
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { warm(); o.disconnect(); } }, { rootMargin: '400px' }).observe($('#builder'));

// ------------------------------------------------------------ sunglasses
const lensBox = $('[data-lens]'), sunImg = $('[data-sun-img]'), sunThumbs = $('[data-sun-thumbs]');
let lens = 'brown', sunView = '1';
const sunSrc = (l, v) => v === 'case' ? 'assets/img/s/wooden-sunglasses-case-1.webp' : `assets/img/s/wooden-sunglasses-${l}-${v}.webp`;
const LENS = { brown: 'brown', black: 'black', photochromic: 'photochromic grey' };
function renderSun() {
  $$('button', lensBox).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === lens)));
  $$('button', sunThumbs).forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.i === sunView));
    $('img', b).src = sunSrc(lens, b.dataset.i);
  });
  const src = sunSrc(lens, sunView);
  if (sunImg.getAttribute('src') !== src) {
    sunImg.classList.add('is-fading');
    const n = new Image(); n.onload = () => { sunImg.src = src; sunImg.alt = sunView === 'case' ? 'The leather and Kiaat pouch' : `The Curve with ${LENS[lens]} polarised lenses`; sunImg.classList.remove('is-fading'); }; n.src = src;
  }
  $('[data-sun-order]').href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Order: The Curve (${LENS[lens]} lenses)`)}&body=${encodeURIComponent(`Hello Bettél,\n\nI would like to order The Curve wooden sunglasses with ${LENS[lens]} lenses (R3 900).\n\nShip to:\n\nThank you`)}`;
}
lensBox.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; lens = b.dataset.v; if (sunView === 'case') sunView = '1'; renderSun(); });
sunThumbs.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sunView = b.dataset.i; renderSun(); });
renderSun();

// ------------------------------------------------------------ reveals + parallax
if (!reduced) {
  $$('.sec-head, .auto__copy, .sun__copy, .story__grid, .promise__copy, .visit__copy, .making__head').forEach(el => el.setAttribute('data-reveal', ''));
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 85%', once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08, onComplete: () => els.forEach(e => e.classList.add('is-in')) }),
  });
  gsap.to('[data-parallax]', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.story__media', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.auto__media img', { scale: 1.12, ease: 'none', scrollTrigger: { trigger: '.auto', start: 'top bottom', end: 'bottom top', scrub: true } });
}

// refresh only once everything has loaded (never per image)
addEventListener('load', () => ScrollTrigger.refresh());
requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
