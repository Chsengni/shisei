/* A library page (costume/, prop/, furniture/, animal/, scene/, light/): a grid and a lightbox, built from the
   library data the build inlines. Every library is a satellite of the pose gallery (docs/DESIGN.md, 素材库与搭配): an
   item is picked to go with a pose, through the tray (tray.ts). */
import { Album, copy, openShare } from './common';
import { I18N, I18N_LIB } from './i18n';
import { tray } from './tray';
import { LANGS, PREFIX, isLoc, type LibData, type LibItem } from './types';
import { $, closest, esc, store, toast, toggleTheme } from './util';

interface Item extends LibItem { suggestive: boolean }

const DATA = JSON.parse($('libdata').textContent || '{}') as LibData;
const LIB = DATA.lib;
const cfg = window.SHISEI ?? { repo: '', version: '', base: '', lang: 'zh' };
const loc = isLoc(cfg.lang) ? cfg.lang : 'zh';
const BASE = cfg.base || '';
const T = I18N[loc], TC = I18N_LIB[loc];
const LN = (T.libs as Record<string, { name: string; unit: string; sub: string }>)[LIB];
const VIEWS = DATA.views;
const VNAME = VIEWS.map((v) => (TC.views as Record<string, string>)[v] ?? v);
const MEDIA = window.SHISEI_NAV ? window.SHISEI_NAV.media : BASE;
const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const GAP_IC = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const img = (tier: string, f: string | null) => MEDIA + 'images/' + DATA.dir + '/' + tier + '/' + (f ?? '');
const srcset = (f: string) => img('w300', f) + ' 300w, ' + img('w600', f) + ' 600w, ' + img('w900', f) + ' 900w';
const items: Item[] = DATA.items.map((c) => ({ ...c, suggestive: c.r === 'suggestive' }));
const byId = new Map(items.map((c) => [c.id, c]));
const get = (id: string | undefined): Item => {
  const c = id ? byId.get(id) : undefined;
  if (!c) throw new Error('unknown item ' + id);
  return c;
};
const catName = new Map(DATA.cats.map((c) => [c.key, c.name[loc]]));
const params = new URLSearchParams(location.search);
type Gender = 'all' | 'F' | 'M' | 'U';
const isGender = (x: string | null): x is Gender => x === 'F' || x === 'M' || x === 'U';
// Same switch and storage key as the gallery's (D-06, D-11): lingerie stays blurred until shown.
const S = {
  cat: catName.has(params.get('cat') ?? '') ? (params.get('cat') as string) : 'all',
  g: (isGender(params.get('g')) ? params.get('g') : 'all') as Gender,
  // -1: each item on its own main view (an animal's side, a bird's front); a view picked here applies to all.
  view: VIEWS.indexOf(params.get('view') ?? ''),
  adult: store.get('adult') === '1',
  revealed: new Set<string>()
};
const veiled = (c: Item) => c.suggestive && !S.adult && !S.revealed.has(c.id);
const first = (c: Item) => Math.max(0, c.v.findIndex(Boolean));
const shown = (c: Item) => (S.view >= 0 && c.v[S.view] ? S.view : c.m);
const hasGender = items.some((c) => c.g);
const sameMain = items.every((c) => c.m === items[0].m);
tray.setPage(LIB);
const lb = $<HTMLDialogElement>('clb');

function syncUrl(): void {
  const p = new URLSearchParams();
  if (S.cat !== 'all') p.set('cat', S.cat);
  if (S.g !== 'all') p.set('g', S.g);
  if (S.view >= 0) p.set('view', VIEWS[S.view]);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}

/* text */
function applyText(): void {
  const TT = T as unknown as Record<string, unknown>;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { const v = TT[el.dataset.i18n ?? '']; if (typeof v === 'string') el.textContent = v; });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { const v = TT[el.dataset.i18nAria ?? '']; if (typeof v === 'string') el.setAttribute('aria-label', v); });
  $('langName').textContent = T.langName;
  $('langShort').textContent = T.langShort;
  $('cTitle').textContent = TC.title(LN.name, items.length, LN.unit);
  $('cCrumbLib').textContent = T.navLibrary;
  $('cCrumbName').textContent = LN.name;
  $('cSub').textContent = LN.sub;
  $('cDataLink').textContent = ($('cDataLink').getAttribute('href') || '').split('/').pop() ?? '';
  $('clbDescLabel').textContent = TC.descLabel;
  $('clbKeys').textContent = TC.keys;
  document.body.dataset.kind = DATA.kind;
}

/* filters */
const pool = () => items.filter((c) => (S.cat === 'all' || c.cat === S.cat) && (S.g === 'all' || c.g === S.g));
type SegOpt = [string, string, boolean];
const seg = (label: string, opts: SegOpt[]) => '<div class="seg" role="group" aria-label="' + esc(label) + '">' +
  opts.map(([text, act, on]) => '<button type="button" data-cact="' + act + '" aria-pressed="' + on + '">' + esc(text) + '</button>').join('') + '</div>';
function renderFilters(): void {
  const base = items.filter((c) => S.g === 'all' || c.g === S.g);
  const chip = (key: string, label: string, n: number) => '<button type="button" class="chip" role="tab" aria-selected="' + (S.cat === key) + '" data-cact="cat:' + key + '">' +
    esc(label) + '<span class="n">' + n + '</span></button>';
  $('cCats').setAttribute('aria-label', TC.cat);
  $('cCats').innerHTML = chip('all', TC.all, base.length) +
    DATA.cats.map((k) => [k, base.filter((c) => c.cat === k.key).length] as const).filter((x) => x[1])
      .map(([k, n]) => chip(k.key, k.name[loc], n)).join('');
  $('cFilters').innerHTML = (hasGender ? seg(TC.genderLabel, (['all', 'F', 'M', 'U'] as const).map((g): SegOpt => [TC.gender[g], 'g:' + g, S.g === g])) : '') +
    // Every item opens on its main view; when they all share it, that view shows as picked. Animals differ (a
    // quadruped's side, a bird's front), so they get a "main view" choice of their own.
    seg(TC.viewLabel, (sameMain ? [] : [[TC.mainView, 'view:-1', S.view < 0] as SegOpt]).concat(VNAME.map((v, i): SegOpt => [v, 'view:' + i, S.view === i || (S.view < 0 && sameMain && i === items[0].m)])));
  const adult = $('adult');
  adult.hidden = !items.some((c) => c.suggestive);
  adult.setAttribute('aria-checked', String(S.adult));
  adult.title = TC.adultHint;
  adult.innerHTML = esc(S.adult ? TC.adultOn : TC.adultOff) + '<span class="track" aria-hidden="true"><i></i></span>';
}

/* grid */
// Hover / focus shortcut on desktop: pair without opening the lightbox, when a pose is waiting in the tray.
function quickHtml(c: Item): string {
  const pose = tray.get().pose;
  return pose ? '<button type="button" class="cquick" data-cpair="' + c.id + '">' + esc(TC.pairWith(pose.id)) + '</button>' : '';
}
function cardHtml(c: Item): string {
  const v = shown(c), f = c.v[v];
  const veil = veiled(c);
  const name = c.n[loc];
  return '<article class="ccard' + (veil ? ' veiled' : '') + '" data-id="' + c.id + '">' +
    '<div class="ctile-box"><a class="ctile" href="#' + c.id + '-' + VIEWS[v] + '" data-copen="' + c.id + '" aria-label="' + esc(TC.open(c.id) + ' ' + name) + '">' +
      (f ? '<img src="' + img('w300', f) + '" srcset="' + srcset(f) + '" sizes="(max-width: 720px) 31vw, 240px" alt="' + esc(c.id + ' ' + name + ' · ' + VNAME[v]) + '" loading="lazy" decoding="async">' : '') +
      (S.view >= 0 && v !== S.view ? '<span class="cvlabel">' + esc(VNAME[v]) + '</span>' : '') + '</a>' +
      (veil ? '<button type="button" class="veil" data-creveal="' + c.id + '" aria-label="' + esc(T.veilShow(c.id) + ' ' + name) + '"><span class="veil-ic">' + EYE_OFF + '</span><span class="veil-t">' + esc(T.veilTap) + '</span></button>' : '') +
      quickHtml(c) + '</div>' +
    '<div class="ccard-t"><h3>' + esc(name) + '</h3><span class="mono">' + c.id + ' · ' + esc(c.sub ? c.sub[loc] : catName.get(c.cat)) + '</span></div></article>';
}
function renderGrid(): void {
  const list = pool();
  $('cGrid').innerHTML = list.length ? list.map(cardHtml).join('') : '<p class="empty">' + esc(TC.empty) + '</p>';
  $('count').textContent = TC.count(list.length, items.length);
}
function renderAll(): void { applyText(); renderLangs(); renderFilters(); renderGrid(); if (lb.open) renderLb(); }

document.addEventListener('click', (e) => {
  const b = closest(e, '[data-cact]');
  if (!b) return;
  const [k, v] = (b.dataset.cact ?? '').split(':');
  if (k === 'cat') S.cat = v;
  else if (k === 'g') { S.g = isGender(v) ? v : 'all'; if (S.cat !== 'all' && !items.some((c) => c.cat === S.cat && (S.g === 'all' || c.g === S.g))) S.cat = 'all'; }
  else if (k === 'view') S.view = +v;
  renderFilters(); renderGrid(); syncUrl();
});
$('adult').addEventListener('click', () => {
  S.adult = !S.adult;
  store.set('adult', S.adult ? '1' : '0');
  S.revealed.clear();
  renderAll();
});
function reveal(id: string): void {
  S.revealed.add(id);
  const card = document.querySelector('.ccard[data-id="' + id + '"]');
  if (card) { card.classList.remove('veiled'); card.querySelector('.veil')?.remove(); }
  if (lb.open) renderLb();
}
$('cGrid').addEventListener('click', (e) => {
  const rv = closest(e, '[data-creveal]');
  if (rv) { reveal(rv.dataset.creveal ?? ''); return; }
  const q = closest(e, '[data-cpair]');
  if (q) { const c = get(q.dataset.cpair); pairIt(c, shown(c)); return; }
  const a = closest(e, '[data-copen]');
  if (a) { e.preventDefault(); const c = get(a.dataset.copen); openLb(c.id, shown(c)); }
});

/* pairing */
function pairIt(c: Item, v: number): void {
  tray.setItem(LIB, { id: c.id, files: c.v, names: c.n, clause: c.clause, v });
  if (lb.open) lb.close();
  // With a pose waiting, the tray opens the pair: that is the confirmation.
  // No pose yet: the pose is the anchor, so go and pick one; the tray keeps the item.
  if (!tray.get().pose) location.href = BASE + PREFIX[loc] + '#all';
}
window.addEventListener('shisei:combo', () => {
  document.querySelectorAll<HTMLElement>('.ccard').forEach((card) => {
    const box = card.querySelector('.ctile-box');
    if (!box) return;
    box.querySelector('.cquick')?.remove();
    box.insertAdjacentHTML('beforeend', quickHtml(get(card.dataset.id)));
  });
  if (lb.open) renderLb();
});
// The tray's slot for this library opens that item here instead of reloading the page.
tray.onSlot = (kind, st) => {
  const x = st.items[kind];
  if (kind !== LIB || !x || !byId.has(x.id)) return false;
  openLb(x.id, tray.viewFor(LIB, x.files));
  return true;
};

/* lightbox */
const LB = { id: '', v: 0 };
// Phones save to the photo album through the share sheet, as in the gallery (common.ts Album).
const ALBUM = Album.on;
// General-rated items have a page of their own with its own share card (tools/site_pages.py item_page); a shared
// link goes there, since link previews never see a #fragment. Suggestive items have no page (D-06), so their link
// is the library page with the item's hash: it opens the item, with the library's card.
const hasPage = (c: Item) => !c.suggestive;
const itemPage = (c: Item) => BASE + PREFIX[loc] + LIB + '/' + c.id + '/';
function lbList(): Item[] { const l = pool(); return l.some((c) => c.id === LB.id) ? l : items; }
function openLb(id: string, v: number): void {
  const c = byId.get(id);
  if (!c) return;
  LB.id = id;
  LB.v = c.v[v] ? v : first(c);
  renderLb();
  if (!lb.open) lb.showModal();
}
function renderLb(): void {
  const c = get(LB.id), f = c.v[LB.v], name = c.n[loc];
  const veil = veiled(c);
  lb.classList.toggle('veiled', veil);
  $('clbVeil').hidden = !veil;
  $('clbVeilTitle').textContent = TC.veilTitle;
  $('clbVeilOne').textContent = T.veilOne;
  $('clbVeilAll').textContent = T.veilAll;
  const im = $<HTMLImageElement>('clbImg');
  im.hidden = !f;
  if (f) { im.src = img('w900', f); im.alt = c.id + ' ' + name + ' · ' + VNAME[LB.v]; }
  $('clbGap').hidden = !!f;
  $('clbGap').innerHTML = f ? '' : '<span class="gap-ic">' + GAP_IC + '</span><b>' + esc(TC.gap) + '</b>';
  $('clbCounter').textContent = VNAME[LB.v] + ' ' + (LB.v + 1) + '/' + VIEWS.length;
  $<HTMLButtonElement>('clbPrev').disabled = $<HTMLButtonElement>('clbNext').disabled = c.v.filter(Boolean).length < 2;
  const list = lbList();
  $('clbMeta').textContent = [c.id, catName.get(c.cat), c.sub?.[loc], c.g && TC.gender[c.g], (list.indexOf(c) + 1) + '/' + list.length].filter(Boolean).join(' · ');
  $('clbTitle').textContent = name;
  $('clbNames').innerHTML = LANGS.filter((l) => l !== loc).map((l) => '<dt>' + l.toUpperCase() + '</dt><dd>' + esc(c.n[l]) + '</dd>').join('');
  $('clbChips').setAttribute('aria-label', TC.viewLabel);
  $('clbChips').innerHTML = VIEWS.map((_, i) => '<button type="button" data-cv="' + i + '" aria-pressed="' + (i === LB.v) + '"' + (c.v[i] ? '' : ' disabled') + '>' +
    '<span class="cchip">' + (c.v[i] ? '<img src="' + img('w300', c.v[i]) + '" alt="">' : GAP_IC) + '</span>' + esc(VNAME[i]) + '</button>').join('');
  $('clbDesc').textContent = c.desc || '';
  $('clbDescBox').hidden = !c.desc;
  const pose = tray.get().pose;
  const pair = $<HTMLButtonElement>('clbPair');
  pair.textContent = pose ? TC.pairWith(pose.id) : TC.startWith;
  pair.disabled = veil;
  const dl = $<HTMLAnchorElement>('clbDl');
  $('clbDlText').textContent = ALBUM ? TC.save : TC.download;
  if (f && !veil) {
    dl.href = img('w900', f);
    dl.setAttribute('download', 'shisei_' + c.id + '_' + VIEWS[LB.v] + '.webp');
    dl.removeAttribute('aria-disabled');
    void Album.prefetch(dl.href, dl.getAttribute('download'));
  } else { dl.removeAttribute('href'); dl.setAttribute('aria-disabled', 'true'); }
  $<HTMLButtonElement>('clbShare').disabled = veil;
  const pg = $<HTMLAnchorElement>('clbPage');
  pg.hidden = !hasPage(c);
  if (hasPage(c)) pg.href = itemPage(c);
  history.replaceState(null, '', location.pathname + location.search + '#' + c.id + '-' + VIEWS[LB.v]);
}
function stepView(d: number): void {
  const c = get(LB.id);
  const n = VIEWS.length;
  for (let k = 1; k <= n; k++) { const i = (LB.v + d * k + 2 * n) % n; if (c.v[i]) { LB.v = i; break; } }
  renderLb();
}
function stepItem(d: number): void {
  const list = lbList(), i = list.findIndex((c) => c.id === LB.id);
  openLb(list[(i + d + list.length) % list.length].id, LB.v);
}
$('clbPrev').addEventListener('click', () => stepView(-1));
$('clbNext').addEventListener('click', () => stepView(1));
$('clbPrevItem').addEventListener('click', () => stepItem(-1));
$('clbNextItem').addEventListener('click', () => stepItem(1));
$('clbClose').addEventListener('click', () => lb.close());
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
lb.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
$('clbChips').addEventListener('click', (e) => { const b = closest<HTMLButtonElement>(e, '[data-cv]'); if (b && !b.disabled) { LB.v = +(b.dataset.cv ?? 0); renderLb(); } });
$('clbPair').addEventListener('click', () => pairIt(get(LB.id), LB.v));
$('clbCopy').addEventListener('click', () => void copy(get(LB.id).desc));
$('clbVeilOne').addEventListener('click', () => reveal(LB.id));
$('clbVeilAll').addEventListener('click', () => { S.adult = true; store.set('adult', '1'); renderAll(); });
$<HTMLAnchorElement>('clbDl').addEventListener('click', (e) => {
  const a = e.currentTarget as HTMLAnchorElement;
  if (!ALBUM || !a.href) return;
  e.preventDefault();
  Album.save([{ url: a.href, name: a.getAttribute('download') || 'shisei.webp' }], (why) => toast(why === 'preparing' ? T.preparing : T.holdToSave, 1800));
});
$('clbShare').addEventListener('click', () => {
  const c = get(LB.id), f = c.v[LB.v] || c.v[c.m];
  openShare({
    url: hasPage(c) ? itemPage(c) : BASE + PREFIX[loc] + LIB + '/#' + c.id + '-' + VIEWS[LB.v],
    heading: T.itemShareTitle,
    text: T.itemShareText.replace('{name}', c.n[loc]).replace('{lib}', LN.name),
    image: hasPage(c) ? new URL(img('w900', f), location.href).href : undefined
  });
});
document.addEventListener('keydown', (e) => {
  if (!lb.open) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); stepView(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepView(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); stepItem(-1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepItem(1); }
});
let sx: number | null = null;
$('clbStage').addEventListener('pointerdown', (e) => { sx = e.clientX; });
$('clbStage').addEventListener('pointerup', (e) => {
  if (sx === null) return;
  const dx = e.clientX - sx;
  sx = null;
  if (Math.abs(dx) > 50) stepView(dx < 0 ? 1 : -1);
});

/* language menu and theme, as on the gallery */
function renderLangs(): void {
  const qs = new URLSearchParams(location.search);
  qs.delete('lang');
  const tail = LIB + '/' + (qs.toString() ? '?' + qs.toString() : '') + location.hash;
  $('langList').innerHTML = LANGS.map((l) => '<a href="' + esc(BASE + PREFIX[l] + tail) + '" lang="' + I18N[l].htmlLang + '" hreflang="' + I18N[l].htmlLang +
    '" data-lang-link="' + l + '"' + (l === loc ? ' aria-current="true"' : '') + '>' + esc(I18N[l].langName) + '</a>').join('');
}
const langBtn = $('lang');
const setLangOpen = (o: boolean) => { if (o) renderLangs(); langBtn.setAttribute('aria-expanded', String(o)); $('langList').hidden = !o; };
langBtn.addEventListener('click', () => setLangOpen(langBtn.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', (e) => { if (!closest(e, '.lang-menu')) setLangOpen(false); });
$('theme').addEventListener('click', toggleTheme);

// Deep links: #C061, #C061-back, #E029-above.
function openFromHash(): void {
  const m = location.hash.match(/^#([A-Z]\d{3})(?:-([a-z]+))?$/);
  if (m && byId.has(m[1])) openLb(m[1], m[2] && VIEWS.includes(m[2]) ? VIEWS.indexOf(m[2]) : get(m[1]).m);
}
window.addEventListener('hashchange', openFromHash);

renderAll();
openFromHash();
