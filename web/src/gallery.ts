// The pose gallery (index.html): hero, filters, grid, lightbox and download panel, all from the inlined catalog.
import { Album, copy, openShare, type SaveFile } from './common';
import { I18N, I18N_LIB, type Strings } from './i18n';
import { tray } from './tray';
import { LANGS, PREFIX, VIEWS, isLoc, type CatalogPose, type Loc, type MapKind, type Series } from './types';
import { $, closest, esc, store, toggleTheme } from './util';

type Kind = 'line' | 'photo' | MapKind;
type Medium = Kind | 'compare';
type Files = (string | null)[];
interface Pose extends CatalogPose {
  ci: number;
  tint: string;
  suggestive: boolean;
  line: Files;
  photo: Files;
  clay: Files;
  depth: Files;
  normal: Files;
}

const CATALOG = JSON.parse($('catalog').textContent || '[]') as CatalogPose[];
const SERIES: readonly Series[] = ['std', 'upper', 'sexy', 'duo'];
const MAP_KINDS: readonly MapKind[] = ['clay', 'depth', 'normal'];
// Categories per series, keyed by the catalog's class_en. std's order matches I18N[*].cats (its catalog names are
// long); the other series use their catalog class_* names as labels.
const CATS: Record<Series, [string, string][]> = {
  std: [['Sitting', '#D3D1E6'], ['Standing', '#AFC3E0'], ['Kneeling', '#BCD3C6'], ['Lying', '#E3CBB0'], ['Side sit / W-sit', '#EBC0BC'],
    ['Squatting', '#C7DCD6'], ['Leaning forward', '#E6B7A1'], ['Arching back', '#CBD0AC'], ['Twist', '#DDB9C8']],
  upper: [['Cute', '#EBC0BC'], ['Sexy', '#E6B7A1'], ['Chest emphasis', '#CBD0AC']],
  sexy: [['Standing', '#AFC3E0'], ['Sitting', '#D3D1E6'], ['Lying', '#E3CBB0'], ['Kneeling & all fours', '#BCD3C6'], ['Special', '#DDB9C8']],
  duo: [['Face-to-face lying', '#E3CBB0'], ['One behind the other', '#E6B7A1'], ['Seated, back to partner', '#D3D1E6'], ['Face-close', '#EBC0BC'],
    ['Seated on top', '#DDB9C8'], ['Standing', '#AFC3E0'], ['Standing close', '#C7DCD6'], ['Side-lying', '#CBD0AC'], ['Seated', '#D3D1E6'],
    ['Face-to-face seated', '#BCD3C6'], ['Seated close', '#D3D1E6'], ['Lying', '#E3CBB0'], ['Close contact', '#EBC0BC']]
};
// Suggestive poses (the sexy and duo series, upper's Sexy / Chest emphasis) stay in the grid but blurred until the
// reader taps one or turns them all on (DECISIONS D-06): a first visit from the README or a shared link shows nothing
// suggestive, yet the series are in plain sight instead of hidden behind a switch nobody found.
const SHOW_SUGGESTIVE_DEFAULT = false;
// After this many one-by-one reveals, offer to show them all.
const NUDGE_AT = 2;
const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const TOOLS = ['ComfyUI', 'Stable Diffusion', 'Flux', 'Midjourney', 'Nano Banana', 'Qwen-Image', '即梦'];
const NAME_LABEL = { cn: 'ZH', jp: 'JA', en: 'EN', kr: 'KO' } as const;
// Each language has its own copy of this page (zh at the root, the others under ja/ en/ ko/) so search engines and
// link previews see it in that language; BASE leads back to the site root from here.
const CFG = window.SHISEI ?? { repo: '', version: '', base: '', lang: 'zh', packs: null };
const BASE = CFG.base || '';
const SERIES_TINT: Record<Series, string> = { std: '#AFC3E0', upper: '#D3D1E6', sexy: '#EBC0BC', duo: '#BCD3C6' };
const PACKS = CFG.packs ?? null;  // null when the build found no data/packs.json
const mb = (b: number) => { const m = b / 1e6; return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' MB'; };
const DL_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>';

// A view is in the catalog only if it passed QC; a pose with no passing view is not shown at all.
const poses: Pose[] = CATALOG.filter((p) => VIEWS.some((v) => p.views[v])).map((p) => {
  const cats = CATS[p.series] || CATS.std;
  const ci = Math.max(0, cats.findIndex((c) => c[0] === p.class_en));
  const line = VIEWS.map((v) => p.views[v] || null);
  // Clay, depth and normal share the line art's file name, one folder each (tools/build_images.py).
  const maps = VIEWS.map((v) => p.maps?.[v] || null);
  return {
    ...p, ci, line, clay: maps, depth: maps, normal: maps,
    tint: cats[ci][1],
    suggestive: p.rating === 'suggestive',
    photo: VIEWS.map((v) => p.photos?.[v] || null)
  };
});
const byId = new Map(poses.map((p) => [p.id, p]));
const pose = (id: string): Pose => {
  const p = byId.get(id);
  if (!p) throw new Error('unknown pose ' + id);
  return p;
};

const params = new URLSearchParams(location.search);
const intParam = (k: string, lo: number, hi: number, dflt: number) => {
  const n = parseInt(params.get(k) ?? '', 10);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : dflt;
};
const isSeries = (x: string | null): x is Series => (SERIES as readonly (string | null)[]).includes(x);
// The page's own language; the head script already moved the reader if ?lang or their saved choice says otherwise.
const S = {
  lang: (isLoc(CFG.lang) ? CFG.lang : 'zh') as Loc,
  series: (isSeries(params.get('series')) ? params.get('series') : 'all') as Series | 'all',
  cat: intParam('cat', 0, 8, -1),
  adult: (store.get('adult') ?? (SHOW_SUGGESTIVE_DEFAULT ? '1' : '0')) === '1',
  angle: intParam('angle', 0, 4, -1),
  medium: (params.get('src') === 'photo' && poses.some((p) => p.photo.some(Boolean)) ? 'photo' : 'line') as 'line' | 'photo',
  view: (params.get('view') === 'single' ? 'single' : 'pose') as 'single' | 'pose',
  // Phone column count (CSS ignores it above 720px): a per-reader preference, so storage, not the URL.
  cols: store.get('cols') === '2' ? 2 : 3,
  per: {} as Record<string, number>,
  // Poses revealed one by one: this visit only, the switch is the lasting choice.
  revealed: new Set<string>(),
  nudged: false
};

const t = (): Strings => I18N[S.lang];
const TC = () => I18N_LIB[S.lang];
const nameOf = (p: Pose): string => p[`name_${t().suffix as 'cn' | 'jp' | 'en' | 'kr'}`];
const src = (kind: string, tier: string, file: string | null) => BASE + 'images/' + kind + '/' + tier + '/' + (file ?? '');
const srcset = (kind: string, file: string) => src(kind, 'w300', file) + ' 300w, ' + src(kind, 'w600', file) + ' 600w, ' + src(kind, 'w900', file) + ' 900w';
const files = (p: Pose, photo: boolean): Files => (photo ? p.photo : p.line);
const catLabel = (p: Pose): string => (p.series === 'std' ? t().cats[p.ci] : p[`class_${t().suffix as 'cn' | 'jp' | 'en' | 'kr'}`]);
const veiled = (p: Pose) => p.suggestive && !S.adult && !S.revealed.has(p.id);
const inSeries = () => poses.filter((p) => S.series === 'all' || p.series === S.series);
// A series this build does not ship (?series=duo on a std-only build) has no tab; fall back to all.
if (S.series !== 'all' && !poses.some((p) => p.series === S.series)) S.series = 'all';
const firstView = (arr: Files) => Math.max(0, arr.findIndex(Boolean));
// The closest angle that has an image, the next one first; -1 when the set has none.
const nearView = (arr: Files, v: number) => {
  for (let d = 1; d < VIEWS.length; d++) for (const i of [v + d, v - d]) if (arr[i]) return i;
  return -1;
};
const isMap = (m: string): m is MapKind => (MAP_KINDS as readonly string[]).includes(m);
// A gap is shown the same way whatever its cause (never generated or failed QC): readers only need to know
// it is on the way and where to look meanwhile, so every gap box offers one way out.
const ICON = {
  line: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14 8l3 3"/></svg>',
  photo: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  // Clay, depth and normal share one icon: stacked layers, as they are layers over the line art.
  map: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/></svg>'
};
const iconFor = (k: string) => ICON[isMap(k) ? 'map' : k === 'photo' ? 'photo' : 'line'];
const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// kind: 'line' | 'photo' | a map format (true / false still mean photo / line for the grid's two media).
const gapIcon = (kind: boolean | string) => '<span class="gap-ic">' + (kind === true ? ICON.photo : !kind ? ICON.line : iconFor(kind)) + '</span>';
const fmtName = (k: string): string => {
  const T = t();
  return k === 'line' ? T.line : k === 'photo' ? T.photo : k === 'compare' ? T.compare : isMap(k) ? T[k] : k;
};
const viewName = (i: number) => t().views[i];
// Grid card: the way out is the nearest angle in the same medium (the medium switch is page-wide).
function cardGapHtml(arr: Files, v: number, photo: boolean): string {
  const T = t();
  const n = nearView(arr, v);
  return gapIcon(photo) + '<b>' + esc(photo ? T.gapPhoto : T.gapLine) + '</b>' +
    '<span class="gap-sub">' + esc(photo ? T.gapOther : T.gapLineSub) + '</span>' +
    '<span class="gap-short">' + esc(photo ? T.gapPhotoShort : T.gapLineShort) + '</span>' +
    (n >= 0 ? '<button type="button" class="gap-go" data-go="' + n + '">' + esc(T.goView(viewName(n))) + ARROW + '</button>' : '');
}

function syncUrl(): void {
  const p = new URLSearchParams();
  if (S.series !== 'all') p.set('series', S.series);
  if (S.cat >= 0) p.set('cat', String(S.cat));
  if (S.angle >= 0) p.set('angle', String(S.angle));
  if (S.medium === 'photo') p.set('src', 'photo');
  if (S.view === 'single') p.set('view', 'single');
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}

/* static text */
function applyText(): void {
  const T = t();
  const TT = T as unknown as Record<string, unknown>;
  const str = (k: string | undefined) => { const v = TT[k ?? '']; return typeof v === 'string' ? v : null; };
  document.documentElement.lang = T.htmlLang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { const v = str(el.dataset.i18n); if (v !== null) el.textContent = v; });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => { el.placeholder = str(el.dataset.i18nPh) ?? ''; });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', str(el.dataset.i18nAria) ?? ''); });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => { el.title = str(el.dataset.i18nTitle) ?? ''; });
  $('langName').textContent = T.langName;
  $('langShort').textContent = T.langShort;
  // The hero counts the whole published library, so the number does not move when suggestive poses are hidden.
  const n = poses.length;
  const views = poses.reduce((s, p) => s + p.line.filter(Boolean).length, 0);
  // Two phrases that never break inside: CJK has no spaces, so a single string let balance split a word across lines.
  $('heroTitle').innerHTML = '<span class="tp">' + esc(T.heroTitle[0]) + '</span> <span class="tp mark">' + esc(T.heroTitle[1]) + '</span>';
  const sub = document.querySelector('.hero-sub');
  if (sub) sub.textContent = T.heroSub(n, views.toLocaleString('en-US'));
  const browse = document.querySelector('[data-i18n="browse"]');
  if (browse) browse.textContent = T.browse(n);
  $('heroSeries').innerHTML = SERIES.map((k) => [k, poses.filter((p) => p.series === k).length] as const).filter((x) => x[1])
    .map(([k, c]) => '<span><i style="background:' + SERIES_TINT[k] + '"></i>' + esc(T.series[k]) + '<b>' + c + '</b></span>').join('');
  renderBand();
  $('howList').innerHTML = T.how.map((s) => '<li>' + esc(s) + '</li>').join('');
  $('termsList').innerHTML = T.termsItems.map((s) => '<li>' + esc(s) + '</li>').join('');
}

/* libraries: a band after the grid and the tray (tray.ts); poses stay the anchor (docs/DESIGN.md) */
const NAV = window.SHISEI_NAV;
function renderBand(): void {
  const band = $('cBand');
  band.hidden = !NAV || !NAV.libs.length;
  if (!NAV || band.hidden) return;
  const T = t();
  $('cBandEyebrow').textContent = TC().bandEyebrow;
  $('cBandT').textContent = TC().bandTitle;
  $('cBandSub').textContent = TC().bandSub;
  $('cBandCount').textContent = TC().bandCount(NAV.libs.reduce((a, l) => a + l.n, 0), NAV.libs.reduce((a, l) => a + l.imgs, 0).toLocaleString('en-US'));
  const libs = T.libs as Record<string, { name: string; role: string; unit: string }>;
  $('cBandLibs').innerHTML = NAV.libs.map((l) => {
    const L = libs[l.key];
    return '<a class="c-lib ' + l.kind + '" href="' + l.key + '/"><span class="c-lib-img">' +
      (l.thumb ? '<img src="' + esc(NAV.media + 'images/' + l.dir + '/w300/' + l.thumb) + '" alt="" width="200" height="267" loading="lazy" decoding="async">' : '') + '</span>' +
      '<span class="c-lib-t"><b>' + esc(L.name) + '</b><span>' + esc(L.role) + '</span><span class="mono">' + l.n + ' ' + esc(L.unit) + '</span></span></a>';
  }).join('');
}
tray.setPage('pose');
// The tray's pose slot opens that pose here rather than reloading the page.
tray.onSlot = (kind, st) => {
  if (kind !== 'pose' || !st.pose || !byId.has(st.pose.id)) return false;
  openLb(st.pose.id, st.pose.v, 'line');
  return true;
};
window.addEventListener('shisei:combo', () => { if (lb.open) renderLb(); });
function pairPose(): void {
  const p = pose(LB.id);
  const v = p.line[LB.v] ? LB.v : firstView(p.line);
  tray.setPose({ id: p.id, v, file: p.line[v], tint: p.tint, desc: p.desc_en || '', names: tray.names(p) });
  lb.close();
  // Nothing picked yet: the tray lists the libraries to go to next.
  if (!tray.count()) tray.showAdd();
}

/* hero */
function renderMarquee(): void {
  const safe = poses.filter((p) => !p.suggestive);
  const row = (offset: number) => {
    const tiles: string[] = [];
    for (let k = 0; k < 18; k++) {
      const p = safe[(k * 7 + offset * 11) % safe.length];
      const vi = (k * 2 + offset) % 5;
      // Every other tile shows one of the map formats of the same view, so the hero says what each set holds.
      const mk = k % 2 ? MAP_KINDS[(k >> 1) % 3] : null;
      // Only the first tiles of the first row load at once; the rest (and the whole second row, hidden on phones)
      // load as they scroll into view.
      const lazy = offset || k >= 8 ? ' loading="lazy"' : '';
      if (mk && p[mk][vi]) {
        tiles.push('<span class="mq-tile map" data-mq="' + p.id + ',' + vi + ',' + mk + '"><img src="' + src(mk, 'w300', p[mk][vi]) + '" alt="" width="146" height="146" decoding="async" fetchpriority="low"' + lazy + '><b>' + esc(t()[mk]) + '</b></span>');
        continue;
      }
      const v = p.line[vi] ? vi : firstView(p.line);
      tiles.push('<span class="mq-tile" data-mq="' + p.id + ',' + v + ',line" style="background:' + p.tint + '"><img src="' + src('line', 'w300', p.line[v]) + '" alt="" width="146" height="146" decoding="async" fetchpriority="low"' + lazy + '></span>');
    }
    // The copy that makes the loop seamless is always off screen at first: lazy.
    return tiles.join('') + tiles.join('').replace(/fetchpriority="low"(?! loading)/g, 'fetchpriority="low" loading="lazy"');
  };
  $('mq1').innerHTML = row(0);
  $('mq2').innerHTML = row(3);
  // A tile opens its pose in the lightbox, at that angle and in that format. The rows stay aria-hidden and out of
  // the tab order (each tile is there twice); the grid below is the keyboard and screen-reader way in.
  $('tools').innerHTML = TOOLS.map((x) => '<span>' + esc(x) + '</span>').join('');
}

document.querySelector('.marquee')?.addEventListener('click', (e) => {
  const tile = closest(e, '[data-mq]');
  if (!tile) return;
  const [id, v, m] = (tile.dataset.mq ?? '').split(',');
  // The overview, with the tile's own format outlined: same landing as a grid card, and the click still shows its result.
  LB.hl = m;
  openLb(id, +v, 'compare');
});

/* filters */
function renderCats(): void {
  const T = t();
  const chip = (label: string, n: number, sel: boolean, dot: string, act: string) => '<button type="button" class="chip" role="tab" aria-selected="' + sel + '" data-act="' + act + '"><span class="dot" style="background:' + dot + '"></span>' + esc(label) + '<span class="n">' + n + '</span></button>';
  const tabs = ([['all', poses.length]] as [Series | 'all', number][]).concat(SERIES.map((k) => [k, poses.filter((p) => p.series === k).length] as [Series, number])).filter((x) => x[1] > 0);
  $('series').setAttribute('aria-label', T.seriesLabel);
  $('series').innerHTML = tabs.map(([k, n]) => '<button type="button" data-act="series:' + k + '" aria-pressed="' + (S.series === k) + '">' + esc(T.series[k]) + ' <span class="n">' + n + '</span></button>').join('');
  const adult = $('adult');
  // The public build ships no suggestive poses, so the toggle would switch nothing.
  adult.hidden = !poses.some((p) => p.suggestive);
  adult.setAttribute('aria-checked', String(S.adult));
  adult.title = T.adultHint;
  adult.innerHTML = esc(S.adult ? T.adultOn : T.adultOff) + '<span class="track" aria-hidden="true"><i></i></span>';
  const base = inSeries();
  const cats = S.series === 'all' ? [] : CATS[S.series].map((c, i) => {
    const sample = base.find((p) => p.ci === i);
    return sample ? chip(catLabel(sample), base.filter((p) => p.ci === i).length, S.cat === i, c[1], 'cat:' + i) : '';
  });
  // Categories only mean something inside one series; on "all" the row would hold a lone 全部 chip.
  $('cats').hidden = !cats.length;
  $('cats').innerHTML = cats.length ? chip(T.all, base.length, S.cat < 0, 'var(--accent)', 'cat:-1') + cats.join('') : '';
}

type SegOpt = [string, string, boolean];
function segHtml(cls: string, label: string, opts: SegOpt[]): string {
  return '<div class="seg ' + cls + '" role="group" aria-label="' + esc(label) + '">' +
    opts.map(([text, act, on]) => '<button type="button" data-act="' + act + '" aria-pressed="' + on + '">' + esc(text) + '</button>').join('') + '</div>';
}
function renderFilters(): void {
  const T = t();
  // The public build ships no photos; a switch to an empty mode is noise.
  const anyPhoto = poses.some((p) => p.photo.some(Boolean));
  const groups = [
    segHtml('angle', T.angle, ([[T.angleAll, 'angle:-1', S.angle < 0]] as SegOpt[]).concat(T.views.map((v, i): SegOpt => [v, 'angle:' + i, S.angle === i]))),
    anyPhoto ? segHtml('medium', T.medium, [[T.line, 'medium:line', S.medium === 'line'], [T.photo + ' · ' + inSeries().filter((p) => p.photo.some(Boolean)).length, 'medium:photo', S.medium === 'photo']]) : '',
    segHtml('view', T.view, [[T.byPose, 'view:pose', S.view === 'pose'], [T.single, 'view:single', S.view === 'single']])
  ];
  $('inlineFilters').innerHTML = groups.join('');
  const cols = $('cols');
  cols.setAttribute('aria-label', T.cols3);
  cols.setAttribute('aria-pressed', String(S.cols === 3));
  cols.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    [3, 9.75, 16.5].map((x) => '<rect x="' + x + '" y="4" width="4.5" height="7" rx="1"/><rect x="' + x + '" y="13" width="4.5" height="7" rx="1"/>').join('') + '</svg>';
}

/* grid */
function pool(): Pose[] {
  return inSeries().filter((p) => {
    if (S.series !== 'all' && S.cat >= 0 && p.ci !== S.cat) return false;
    return !(S.medium === 'photo' && !p.photo.some(Boolean));
  });
}
function curView(p: Pose): number {
  const arr = files(p, S.medium === 'photo');
  if (S.angle >= 0) return S.angle;
  return S.per[p.id] ?? firstView(arr);
}

// The veil is a button over the tile, not part of the link: the first tap reveals, the next one opens.
const veilBtn = (p: Pose) => '<button type="button" class="veil" data-reveal="' + p.id + '" aria-label="' + esc(t().veilShow(p.id) + ' ' + nameOf(p)) + '">' +
  '<span class="veil-ic">' + EYE_OFF + '</span><span class="veil-t">' + esc(t().veilTap) + '</span></button>';

function cardHtml(p: Pose): string {
  const T = t();
  const photo = S.medium === 'photo';
  const arr = files(p, photo);
  const cur = curView(p);
  const f = arr[cur];
  const kind = photo ? 'photo' : 'line';
  // Cards are about 300-330 px wide on desktop; claiming 290px keeps 2x screens on w600 (~20 KB) instead of w900
  // (~33 KB). The line art barely changes at that scale and the grid is most of the site's traffic.
  const dots = VIEWS.map((_, i) => '<button type="button" data-dot="' + i + '" aria-label="' + esc(viewName(i)) + '" aria-pressed="' + (i === cur) + '"' + (arr[i] ? '' : ' disabled') + '><i></i></button>').join('');
  // The gap box sits beside the tile link, not in it: its button cannot nest inside an <a>.
  const veil = veiled(p);
  return '<article class="card' + (veil ? ' veiled' : '') + '" data-id="' + p.id + '" style="--tint:' + p.tint + '">' +
    '<div class="tile-box"><a class="tile" href="#' + p.id + '-' + VIEWS[cur] + '" data-tile aria-label="' + esc(T.open(p.id) + ' ' + nameOf(p)) + '">' +
      '<img' + (f ? ' src="' + src(kind, 'w300', f) + '" srcset="' + srcset(kind, f) + '"' : '') + ' sizes="(max-width: 720px) 50vw, 290px" alt="' + esc(p.id + ' ' + nameOf(p) + ' · ' + viewName(cur)) + '" loading="lazy" decoding="async"' + (f ? '' : ' hidden') + '>' +
      (!photo && p.photo.some(Boolean) ? '<span class="badge ph">' + esc(T.hasPhoto) + '</span>' : '') +
      '<span class="vlabel">' + esc(viewName(cur)) + ' ' + (cur + 1) + '/5</span>' +
    '</a><div class="missing"' + (f ? ' hidden>' : '>' + cardGapHtml(arr, cur, photo)) + '</div>' + (veil ? veilBtn(p) : '') + '</div>' +
    '<div class="card-foot"><div class="card-t"><h3>' + esc(nameOf(p)) + '</h3><span>' + p.id + ' · ' + esc(catLabel(p)) + '</span></div>' +
    '<div class="dots" role="group" aria-label="' + esc(T.angle) + '">' + dots + '</div></div></article>';
}

// Swap one card's angle in place so hover state and transitions are not interrupted.
function updateCard(card: HTMLElement, p: Pose): void {
  const photo = S.medium === 'photo';
  const arr = files(p, photo);
  const cur = curView(p);
  const f = arr[cur];
  const kind = photo ? 'photo' : 'line';
  const img = card.querySelector('img');
  const miss = card.querySelector<HTMLElement>('.missing');
  if (!img || !miss) return;
  if (f) {
    img.src = src(kind, 'w300', f);
    img.srcset = srcset(kind, f);
    img.alt = p.id + ' ' + nameOf(p) + ' · ' + viewName(cur);
  }
  img.hidden = !f;
  miss.hidden = !!f;
  miss.innerHTML = f ? '' : cardGapHtml(arr, cur, photo);
  const vl = card.querySelector('.vlabel');
  if (vl) vl.textContent = viewName(cur) + ' ' + (cur + 1) + '/5';
  card.querySelector('[data-tile]')?.setAttribute('href', '#' + p.id + '-' + VIEWS[cur]);
  card.querySelectorAll<HTMLElement>('[data-dot]').forEach((b) => b.setAttribute('aria-pressed', String(+(b.dataset.dot ?? -1) === cur)));
}

function renderGrid(): void {
  const T = t();
  const list = pool();
  const grid = $('grid');
  const photo = S.medium === 'photo';
  grid.className = 'grid' + (S.view === 'single' ? ' single' : '') + (S.cols === 3 ? ' c3' : '') + (photo ? ' photo-mode' : '');
  let count = list.length;
  if (!list.length) {
    grid.className = '';
    grid.innerHTML = '<p class="empty">' + esc(T.empty) + '</p>';
  } else if (S.view === 'pose') {
    grid.innerHTML = list.map(cardHtml).join('');
  } else {
    const kind = photo ? 'photo' : 'line';
    const tiles: string[] = [];
    list.forEach((p) => files(p, photo).forEach((f, i) => {
      if (!f || (S.angle >= 0 && S.angle !== i)) return;
      tiles.push('<a class="stile' + (veiled(p) ? ' veiled' : '') + '" href="#' + p.id + '-' + VIEWS[i] + '" data-open="' + p.id + '" data-v="' + i + '" style="--tint:' + p.tint + '" aria-label="' + esc(p.id + ' ' + nameOf(p) + ' · ' + viewName(i)) + '">' +
        '<span class="tile"><img src="' + src(kind, 'w300', f) + '" srcset="' + srcset(kind, f) + '" sizes="(max-width: 720px) 50vw, 200px" alt="" loading="lazy" decoding="async">' +
        (veiled(p) ? '<span class="veil"><span class="veil-ic">' + EYE_OFF + '</span></span>' : '') + '</span>' +
        '<span class="stile-t"><span class="mono">' + p.id + '</span><span>' + esc(viewName(i)) + '</span></span></a>');
    }));
    count = tiles.length;
    grid.innerHTML = tiles.join('');
  }
  $('count').textContent = S.view === 'pose' ? T.countPoses(list.length, inSeries().length) : T.countImages(count);
}

function renderAll(): void {
  applyText();
  renderLangs();
  renderDl();
  renderCats();
  renderFilters();
  renderGrid();
  if (lb.open) renderLb();
}

/* actions */
function act(a: string): void {
  const [k, v] = a.split(':');
  if (k === 'cat') { S.cat = +v; }
  else if (k === 'series') { S.series = isSeries(v) ? v : 'all'; S.cat = -1; }
  else if (k === 'angle') { S.angle = +v; S.per = {}; }
  else if (k === 'medium') { S.medium = v === 'photo' ? 'photo' : 'line'; S.per = {}; }
  else if (k === 'view') { S.view = v === 'single' ? 'single' : 'pose'; }
  renderCats();
  renderFilters();
  renderGrid();
  syncUrl();
}
function setAdult(on: boolean): void {
  S.adult = on;
  store.set('adult', on ? '1' : '0');
  S.revealed.clear();
  S.nudged = false;
  $('nudge').hidden = true;
  renderAll();
}
$('adult').addEventListener('click', () => setAdult(!S.adult));
// Unveil one pose in place (every card and tile of it) so the grid does not re-render under the reader's finger.
function reveal(id: string): void {
  S.revealed.add(id);
  document.querySelectorAll('#grid [data-id="' + id + '"], #grid [data-open="' + id + '"]').forEach((el) => {
    el.classList.remove('veiled');
    el.querySelector('.veil')?.remove();
  });
  if (lb.open) renderLb();
  if (!S.nudged && S.revealed.size >= NUDGE_AT) {
    S.nudged = true;
    $('nudgeText').textContent = t().nudge(S.revealed.size);
    $('nudge').hidden = false;
  }
}
$('nudgeAll').addEventListener('click', () => setAdult(true));
$('nudgeClose').addEventListener('click', () => { $('nudge').hidden = true; });
document.addEventListener('click', (e) => {
  const b = closest(e, '[data-act]');
  if (b?.dataset.act) act(b.dataset.act);
});

const grid = $('grid');
const pickDot = (e: Event) => {
  const b = closest<HTMLButtonElement>(e, '[data-dot]');
  if (!b || b.disabled) return;
  const card = b.closest<HTMLElement>('.card');
  if (!card?.dataset.id) return;
  const p = pose(card.dataset.id);
  const i = +(b.dataset.dot ?? 0);
  if (curView(p) === i && S.angle < 0) return;
  S.angle = -1;
  S.per[p.id] = i;
  updateCard(card, p);
};
grid.addEventListener('mouseover', pickDot);
grid.addEventListener('focusin', pickDot);
grid.addEventListener('click', (e) => {
  const rv = closest(e, '[data-reveal]');
  if (rv) { const card = rv.closest('.card'); reveal(rv.dataset.reveal ?? ''); card?.querySelector<HTMLElement>('[data-tile]')?.focus(); return; }
  if (closest(e, '[data-dot]')) { pickDot(e); return; }
  const go = closest(e, '[data-go]');
  if (go) {
    const card = go.closest<HTMLElement>('.card');
    if (!card?.dataset.id) return;
    S.angle = -1;
    S.per[card.dataset.id] = +(go.dataset.go ?? 0);
    updateCard(card, pose(card.dataset.id));
    card.querySelector<HTMLElement>('[data-tile]')?.focus();
    return;
  }
  const tile = closest(e, '[data-tile]');
  if (tile) {
    e.preventDefault();
    const id = tile.closest<HTMLElement>('.card')?.dataset.id;
    if (!id) return;
    const p = pose(id);
    openLb(p.id, curView(p), S.medium === 'photo' ? 'photo' : 'compare');
    return;
  }
  const s = closest(e, '.stile');
  if (s?.dataset.open) {
    e.preventDefault();
    if (s.classList.contains('veiled')) reveal(s.dataset.open);
    else openLb(s.dataset.open, +(s.dataset.v ?? 0), S.medium === 'photo' ? 'photo' : 'compare');
  }
});
// An explicit list of the four languages: a single button that cycles them hid where the next click would land.
// ?lang is dropped from the targets, because on arrival it outranks the reader's pick (tools/site_pages.py).
function renderLangs(): void {
  const qs = new URLSearchParams(location.search);
  qs.delete('lang');
  const tail = (qs.toString() ? '?' + qs.toString() : '') + location.hash;
  $('langList').innerHTML = LANGS.map((l) => '<a href="' + esc(BASE + PREFIX[l] + tail) + '" lang="' + I18N[l].htmlLang + '" hreflang="' + I18N[l].htmlLang +
    '" data-lang-link="' + l + '"' + (l === S.lang ? ' aria-current="true"' : '') + '>' + esc(I18N[l].langName) + '</a>').join('');
}
const langBtn = $('lang');
const setLangOpen = (open: boolean) => {
  if (open) renderLangs();  // pick up the filters and hash the reader has set since
  langBtn.setAttribute('aria-expanded', String(open));
  $('langList').hidden = !open;
};
langBtn.addEventListener('click', () => setLangOpen(langBtn.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', (e) => { if (!closest(e, '.lang-menu')) setLangOpen(false); });
document.querySelector('.lang-menu')?.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Escape' && !$('langList').hidden) { setLangOpen(false); langBtn.focus(); }
});

/* downloads: sizes come from data/packs.json, written by tools/pack_release.py with the Release assets */
function renderDl(): void {
  const T = t();
  $('dlLic').textContent = 'v' + (PACKS ? PACKS.version : CFG.version) + ' · ' + T.dlLicense;
  if (!PACKS) {
    $('dlBody').innerHTML = '<a class="dl-row main" href="' + esc(CFG.repo + '/releases/latest') + '"><span><b>' + esc(T.dlAll) + '</b></span>' + DL_ICON + '</a>';
    return;
  }
  const P = PACKS.packs;
  const url = (k: string) => esc(CFG.repo + '/releases/download/v' + PACKS.version + '/' + P[k].file);
  // Every row says what is inside it (docs/DESIGN.md): the line-art zip is the recommended one, the complete zip
  // holds every format, each map format has its own zip, and the originals are line art and photos only.
  const chip = (k: string, n?: number) => '<span class="fmt-chip ' + k + '">' + esc(fmtName(k)) + (n ? ' ' + n.toLocaleString('en-US') : '') + '</span>';
  const nLine = poses.reduce((a, p) => a + p.line.filter(Boolean).length, 0);
  const nPhoto = poses.reduce((a, p) => a + p.photo.filter(Boolean).length, 0);
  const nMap = poses.reduce((a, p) => a + p.clay.filter(Boolean).length, 0);
  const size = (k: string, cls?: string) => '<span class="dl-s"><span class="' + (cls || 'mono') + '">' + mb(P[k].bytes) + '</span>' + DL_ICON + '</span>';
  const row = (k: string, cls: string, title: string, sub: string, dot?: string) => '<a class="dl-row ' + cls + '" href="' + url(k) + '" download>' +
    '<span class="dl-t">' + (dot ? '<i style="background:' + dot + '"></i>' : '') + '<span><b>' + title + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></span>' +
    size(k) + '</a>';
  const card = (k: string, title: string, chips: string, sub: string, cls: string) => '<a class="dl-row ' + cls + '" href="' + url(k) + '" download>' +
    '<span class="dl-t"><span><b>' + title + '</b><span class="fmt-chips">' + chips + '</span>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></span>' +
    size(k, cls === 'main' ? 'size-tag' : '') + '</a>';
  const series = SERIES.filter((k) => P[k]);
  const maps = MAP_KINDS.filter((k) => P[k]);
  $('dlBody').innerHTML =
    card('all', esc(T.dlLine) + ' <em>' + esc(T.dlRec) + '</em>', chip('line', nLine) + (nPhoto ? chip('photo', nPhoto) : ''), T.dlLineSub(P.all.sets ?? 0), 'main') +
    (P.complete ? card('complete', esc(T.dlComplete), ['line', 'photo', ...MAP_KINDS].map((k) => chip(k)).join(''), '', 'every') : '') +
    (maps.length ? '<h3>' + esc(T.dlMaps(nMap)) + '</h3><div class="dl-maps">' + maps.map((k) =>
      '<a class="dl-map" href="' + url(k) + '" download><span class="dl-map-h"><i class="sw ' + k + '"></i><b>' + esc(T[k]) + '</b></span>' +
      '<span class="mono">' + mb(P[k].bytes) + '</span><small>' + esc(T.dlMapSub[k]) + '</small></a>').join('') + '</div>' : '') +
    '<h3>' + esc(T.dlBySeries) + '</h3><div class="dl-series">' +
    series.map((k) => row(k, '', esc(T.series[k]), T.dlSets(P[k].sets ?? 0), SERIES_TINT[k])).join('') + '</div>' +
    (nPhoto ? '<p class="dl-foot">' + esc(T.dlPhotoNote) + '</p>' : '') +
    row('original', 'orig', esc(T.dlOriginalAll), T.dlOriginalSub);
}

$('theme').addEventListener('click', toggleTheme);

/* dialogs */
const dialogs: Record<string, HTMLDialogElement> = { how: $<HTMLDialogElement>('dlgHow'), terms: $<HTMLDialogElement>('dlgTerms'), dl: $<HTMLDialogElement>('dlgDl') };
document.addEventListener('click', (e) => {
  const o = closest(e, '[data-open="how"], [data-open="terms"], [data-open="dl"]');
  if (o?.dataset.open) dialogs[o.dataset.open].showModal();
  const c = closest(e, '[data-close]');
  if (c) c.closest('dialog')?.close();
});
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
$('cols').addEventListener('click', () => {
  S.cols = S.cols === 3 ? 2 : 3;
  store.set('cols', String(S.cols));
  renderFilters(); renderGrid();
});

/* lightbox */
// medium: 'line' | 'clay' | 'depth' | 'normal' | 'photo' | 'compare'. 'compare' is the overview the lightbox opens
// on (2026-11-01, design B1): every format of the angle at once, the four aligned ones in a 2×2 grid and the photo in
// its own column; a tile opens that format alone, and the format row comes back. A set with nothing beyond line
// art has no overview and opens on the line art. The grid of poses stays line art: it is for picking a pose.
// more: the phone lightbox keeps names, description and secondary actions folded away so one set fits one screen.
// hl: the format a marquee tile was, outlined in the overview it opens. pushed: a tile opened from the overview
// added a history entry, so the browser's back (a phone's back gesture) returns to the overview first.
const lb = $<HTMLDialogElement>('lb');
const LB = { id: '', v: 0, medium: 'line' as Medium, more: false, hl: null as string | null, pushed: false };
const MEDIA: readonly Medium[] = ['line', 'clay', 'depth', 'normal', 'photo', 'compare'];
const isMedium = (m: string | undefined): m is Medium => (MEDIA as readonly (string | undefined)[]).includes(m);
const kindFiles = (p: Pose, k: Kind): Files => p[k];
const hasMedium = (p: Pose, m: Medium) => m === 'line' || (m === 'compare' ? p.photo.some(Boolean) || p.clay.some(Boolean) : kindFiles(p, m).some(Boolean));
// In the overview an angle counts when any format has it; missing tiles show the usual gap icon.
const lbFiles = (p: Pose, m: Medium): Files => (m === 'compare' ? p.line.map((f, i) => f || p.clay[i] || p.photo[i]) : kindFiles(p, m));
function lbList(): Pose[] {
  const list = pool();
  return list.some((p) => p.id === LB.id) ? list : poses;
}
// keep: a format switch inside the lightbox stays on this angle even when the new format lacks it; the gap box
// then offers the way out (the line art of this angle, or the nearest angle that has the format).
function openLb(id: string, v: number, medium?: string, keep?: boolean): void {
  const p = byId.get(id);
  if (!p) return;
  LB.id = id;
  LB.medium = isMedium(medium) && hasMedium(p, medium) ? medium : hasMedium(p, 'compare') ? 'compare' : 'line';
  const arr = lbFiles(p, LB.medium);
  LB.v = arr[v] || (keep && arr.some(Boolean)) ? v : firstView(arr);
  renderLb();
  if (!lb.open) lb.showModal();
}
// Phones save to the photo album through the share sheet (common.ts Album, shared with the libraries).
const ALBUM = Album.on, SHARE_FILES = Album.canShare;
// The overview's save button on phones takes every format of the angle in one share sheet ("Save 5 Images" on
// iOS). All files must already be fetched when the tap comes: share() has to run inside the gesture.
let SAVE_SET: SaveFile[] | null = null;
function angleFiles(p: Pose): SaveFile[] {
  return (['line', ...MAP_KINDS, 'photo'] as Kind[]).filter((k) => p[k][LB.v])
    .map((k) => ({ url: src(k, 'w900', p[k][LB.v]), name: 'shisei_' + p.id + '_' + VIEWS[LB.v] + '_' + k + '.webp' }));
}
let tipTimer = 0;
function lbTip(msg: string): void {
  const el = $('lbTip');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => { el.hidden = true; }, 4000);
}
function saveToAlbum(e: MouseEvent): void {
  const a = e.currentTarget as HTMLAnchorElement;
  if (!ALBUM || !a.href) return;
  e.preventDefault();
  const many = !!SAVE_SET && a.id === 'lbDl';
  Album.save(many && SAVE_SET ? SAVE_SET : [{ url: a.href, name: a.getAttribute('download') || 'shisei.webp' }],
    (why) => lbTip(why === 'preparing' ? t().preparing : many ? t().holdMany : t().holdToSave));
}
function setDl(a: HTMLAnchorElement, label: string, f: string | null, kind: Kind, p: Pose): void {
  const span = a.querySelector('span');
  if (span) span.textContent = label;
  if (f) { a.href = src(kind, 'w900', f); a.setAttribute('download', 'shisei_' + p.id + '_' + VIEWS[LB.v] + (kind === 'line' ? '' : '_' + kind) + '.webp'); a.removeAttribute('aria-disabled'); }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
}
// Lightbox gap: the same angle in the other medium is the best way out when it exists, else the nearest angle.
// A map that did not pass QC points back to the line art it was drawn from, then to the nearest angle with that map.
function lbGapHtml(p: Pose, arr: Files, m: Medium, T: Strings): string {
  const v = LB.v;
  const btn = (attr: string, label: string, dark: boolean) => '<button type="button" class="gap-go' + (dark ? ' dark' : '') + '" ' + attr + '>' + esc(label) + (dark ? ARROW : '') + '</button>';
  if (isMap(m)) {
    const n = nearView(arr, v);
    const acts = (p.line[v] ? [btn('data-lbgm="line"', T.goLine, true)] : []).concat(n >= 0 ? [btn('data-lbgo="' + n + '"', T.goView(viewName(n)), !p.line[v])] : []);
    return gapIcon(m) + '<b>' + esc(viewName(v) + ' · ' + T.gapMap(T[m])) + '</b>' +
      '<span class="gap-sub">' + esc(p.line[v] ? T.gapPhotoSub : T.gapOther) + '</span>' +
      (acts.length ? '<span class="gap-acts">' + acts.join('') + '</span>' : '');
  }
  const photo = m === 'photo';
  const other = photo ? p.line[v] : p.photo[v];
  const n = nearView(arr, v);
  const acts: string[] = [];
  if (photo && other) acts.push(btn('data-lbgm="line"', T.goLine, true));
  if (n >= 0) acts.push(btn('data-lbgo="' + n + '"', T.goView(viewName(n)), !acts.length));
  if (!photo && other) acts.push(btn('data-lbgm="photo"', T.goPhoto, false));
  return gapIcon(photo) + '<b>' + esc(viewName(v) + ' · ' + (photo ? T.gapPhoto : T.gapLine)) + '</b>' +
    '<span class="gap-sub">' + esc(photo ? (other ? T.gapPhotoSub : T.gapOther) : T.gapLineSub) + '</span>' +
    (acts.length ? '<span class="gap-acts">' + acts.join('') + '</span>' : '');
}
// An overview tile is warmed with the tile's own srcset and sizes, so the browser fetches the same 300 or 600 px
// file it will pick when the tile shows.
const TILE_SIZES = '(max-width: 860px) 31vw, 260px';
const tileSet = (k: string, f: string) => src(k, 'w300', f) + ' 300w, ' + src(k, 'w600', f) + ' 600w';
// The overview: the aligned formats the set has in a 2×2 grid, then the photo column (on phones a row under the
// grid). A format missing at this angle keeps its place as a gap tile, so the grid never reshuffles between angles.
function overviewHtml(p: Pose, T: Strings): string {
  const v = LB.v;
  const tile = (k: Kind, f: string | null) => f
    ? '<button type="button" class="lb-tile ' + k + (LB.hl === k ? ' hl' : '') + '" data-lbopen="' + k + '"><img src="' + src(k, 'w600', f) + '" srcset="' + tileSet(k, f) + '" sizes="' + TILE_SIZES + '" fetchpriority="high" alt="' + esc(p.id + ' ' + nameOf(p) + ' · ' + viewName(v) + ' · ' + fmtName(k)) + '"><span>' + esc(fmtName(k)) + '</span></button>'
    : '<div class="lb-tile ' + k + ' gap"><span class="lb-tile-gap">' + gapIcon(k === 'photo' ? true : k === 'line' ? false : k) + '<b>' + esc(k === 'photo' ? T.gapPhoto : k === 'line' ? T.gapLine : T.gapMap(fmtName(k))) + '</b></span><span>' + esc(fmtName(k)) + '</span></div>';
  const kinds: Kind[] = ['line', ...(p.clay.some(Boolean) ? MAP_KINDS : [])];
  const hasPhoto = p.photo.some(Boolean);
  lb.classList.toggle('ov-one', kinds.length === 1);
  lb.classList.toggle('ov-photo', hasPhoto);
  return '<div class="lb-ov"><div class="lb-ov-grid">' + kinds.map((k) => tile(k, p[k][v])).join('') + '</div>' +
    (hasPhoto ? tile('photo', p.photo[v]) : '') + '</div>';
}
// The formats this set has, in the order of the format row and the vertical swipe: the overview first.
const fmtList = (p: Pose): Medium[] => [...(hasMedium(p, 'compare') ? ['compare', 'line'] as Medium[] : ['line'] as Medium[]),
  ...(p.clay.some(Boolean) ? MAP_KINDS : []), ...(p.photo.some(Boolean) ? ['photo'] as Medium[] : [])];
// The format row under an enlarged image (design X1): one tap to any other format, and its first item, the
// overview, is the way back. A format this angle lacks stays in place, disabled.
function fmtsHtml(p: Pose, T: Strings): string {
  const v = LB.v;
  return fmtList(p).map((k) => {
    const f = k === 'compare' ? 'all' : p[k][v];
    const ic = k === 'compare' ? '<span class="fmt-all" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'
      : f ? '<img src="' + src(k, 'w300', f) + '" alt="">' : '<span class="fmt-gap">' + iconFor(k) + '</span>';
    return '<button type="button" class="' + k + '" data-lbfmt="' + k + '" aria-pressed="' + (LB.medium === k) + '"' + (f ? '' : ' disabled') + '>' +
      ic + '<span>' + esc(k === 'compare' ? T.allShort : fmtName(k)) + '</span></button>';
  }).join('');
}
function renderLb(): void {
  const T = t();
  const p = pose(LB.id);
  const m = LB.medium;
  const photo = m === 'photo', compare = m === 'compare';
  const arr = lbFiles(p, m);
  const f = arr[LB.v];
  const kind: Kind = m === 'compare' ? 'line' : m;
  lb.style.setProperty('--tint', m === 'line' ? p.tint : 'var(--tile)');
  lb.classList.toggle('photo', photo);
  lb.classList.toggle('map', isMap(m));
  lb.classList.toggle('has-maps', p.clay.some(Boolean));
  lb.dataset.medium = m;
  lb.classList.toggle('compare', compare);
  // A veiled pose opens blurred, all five angles with it; downloads wait until it is shown.
  const veil = veiled(p);
  lb.classList.toggle('veiled', veil);
  $('lbVeil').hidden = !veil;
  $('lbVeilTitle').textContent = T.veilTitle;
  $('lbVeilOne').textContent = T.veilOne;
  $('lbVeilAll').textContent = T.veilAll;
  const img = $<HTMLImageElement>('lbImg');
  if (f && !compare) { img.fetchPriority = 'high'; swapSrc(img, src(kind, 'w900', f), ''); img.alt = p.id + ' ' + nameOf(p) + ' · ' + viewName(LB.v); }
  img.hidden = !f || compare;
  // Maps are drawn over the line art, so the line art can be wiped in over them to check the fit.
  const wipe = isMap(m) && !!f && !!p.line[LB.v];
  $('lbWipe').hidden = $('lbWipeBar').hidden = !wipe;
  if (wipe) {
    $<HTMLImageElement>('lbWipeImg').src = src('line', 'w900', p.line[LB.v]);
    $('lbWipeRange').setAttribute('aria-label', T.overlay);
    $('lbWipeLabel').textContent = T.overlay;
    setWipe();
  }
  const pair = $('lbPair');
  pair.hidden = !compare;
  morph(pair, compare ? overviewHtml(p, T) : '');
  // The format row replaces the back buttons; they stay in the markup, hidden.
  const fmts = hasMedium(p, 'compare') && !compare;
  $('lbBack').hidden = $('lbBack2').hidden = true;
  lb.classList.toggle('has-fmts', fmts);
  $('lbFmts').hidden = !fmts;
  $('lbFmts').setAttribute('aria-label', T.medium);
  morph($('lbFmts'), fmts ? fmtsHtml(p, T) : '');
  const miss = $('lbMissing');
  miss.hidden = !!f || compare;
  miss.innerHTML = f || compare ? '' : lbGapHtml(p, arr, m, T);
  $('lbCounter').textContent = viewName(LB.v) + ' ' + (LB.v + 1) + '/5';
  // With one view or none there is nowhere to step; a live-looking arrow that does nothing reads as broken.
  $<HTMLButtonElement>('lbPrev').disabled = $<HTMLButtonElement>('lbNext').disabled = arr.filter(Boolean).length < 2;
  const list = lbList();
  // Phones keep only the ID and category in this line (.lb-mx hides the rest) to give the image the height.
  $('lbMeta').innerHTML = esc(p.id) + '<span class="lb-mx"> · ' + esc(T.series[p.series]) + '</span> · ' + esc(catLabel(p)) +
    '<span class="lb-mx"> · ' + (list.indexOf(p) + 1) + '/' + list.length + '</span>';
  lb.classList.toggle('more', LB.more);
  $('lbMore').setAttribute('aria-expanded', String(LB.more));
  $('lbTitle').textContent = nameOf(p);
  $('lbNames').innerHTML = (['cn', 'jp', 'en', 'kr'] as const).filter((s) => s !== T.suffix)
    .map((s) => '<dt>' + NAME_LABEL[s] + '</dt><dd>' + esc(p[`name_${s}`]) + '</dd>').join('');
  $('lbChips').setAttribute('aria-label', T.angle);
  // Overview thumbnails show the line art when there is one.
  morph($('lbChips'), VIEWS.map((_, i) => {
    const tk: Kind = compare ? (p.line[i] ? 'line' : p.clay[i] ? 'clay' : 'photo') : kind;
    return '<button type="button" data-lbv="' + i + '" aria-pressed="' + (i === LB.v) + '"' + (arr[i] ? '' : ' disabled') + '>' +
      '<span class="' + tk + '">' + (arr[i] ? '<img src="' + src(tk, 'w300', arr[i]) + '" alt="">' : iconFor(kind)) + '</span>' + esc(viewName(i)) + '</button>';
  }).join(''));
  const hasPhoto = p.photo.some(Boolean), hasMaps = p.clay.some(Boolean);
  lb.classList.toggle('no-photo', !hasPhoto && !hasMaps);
  $('lbMedium').setAttribute('aria-label', T.medium);
  // A set without maps shows no map buttons at all; photo and compare stay, disabled, as before.
  $('lbMedium').innerHTML = MEDIA.filter((k) => !isMap(k) || hasMaps).map((k) => '<button type="button" data-lbm="' + k + '" aria-pressed="' + (m === k) + '"' +
    (hasMedium(p, k) ? '' : ' disabled') + (k === 'photo' && hasMaps ? ' class="gap-l"' : '') + '>' + esc(fmtName(k)) + '</button>').join('');
  $('lbMedium').hidden = true;
  $('lbNote').hidden = !isMap(m) && !compare;
  $('lbNote').textContent = compare ? T.overviewNote : isMap(m) ? T.fmtNote[m] : '';
  $('lbDesc').textContent = p.desc_en || '';
  $('lbDescBox').hidden = !p.desc_en;
  const dl = $<HTMLAnchorElement>('lbDl'), dl2 = $<HTMLAnchorElement>('lbDl2');
  dl2.hidden = true;
  // The overview downloads the line art of the angle; every other format downloads from its own enlarged view.
  // Phones: the overview saves every format of the angle at once (browsers that cannot share files get a hint
  // instead); an enlarged format saves that one image. Desktop downloads one file either way.
  SAVE_SET = ALBUM && compare && !veil ? angleFiles(p) : null;
  if (compare) setDl(dl, ALBUM ? (SHARE_FILES ? T.saveAngle : T.howSave) : T.download + ' · ' + T.line + ' 900×1200', p.line[LB.v], 'line', p);
  else setDl(dl, ALBUM ? T.saveFmt(fmtName(kind)) : T.download + ' · ' + (isMap(m) ? T[m] + ' ' : '') + (photo ? '900×1800' : '900×1200'), f, kind, p);
  if (veil) [dl, dl2].forEach((a) => { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); });

  $('lbPairText').textContent = tray.count() ? TC().pairItems(tray.count()) : TC().startPose;
  $<HTMLButtonElement>('lbPairBtn').disabled = veil || !p.line.some(Boolean);
  clearTimeout(tipTimer);
  $('lbTip').hidden = true;
  // Static pose pages exist only for general std poses (tools/site_pages.py).
  const page = $<HTMLAnchorElement>('lbPage');
  page.hidden = !hasPosePage(p);
  if (hasPosePage(p)) page.href = posePage(p.id);
  // No suffix is the overview (the default); the line art alone is -line.
  history.replaceState(null, '', location.pathname + location.search + '#' + p.id + '-' + VIEWS[LB.v] + (m === 'compare' ? '' : '-' + m));
  preloadAround(p, m);
}
/* Preloading: once the shown images are in, fetch what the next step needs, so ← → and the format row are instant.
   Overview: the other angles' tiles (w600). One format: its other angles (w900), and this angle in the set's other
   formats (w900, for the format row and the vertical swipe). Then the next pose's opening view. Skipped on
   Save-Data and 2G; the fetches are low priority, and the service worker's image cache keeps them. */
const WARM = new Set<string>();
const SLOW = (() => { const c = navigator.connection; return !!c && (!!c.saveData || /2g/.test(c.effectiveType || '')); })();
// One queue for everything fetched ahead: at most two at a time, and a new render (another angle, format or pose)
// drops whatever has not started, so stale preloads never compete with what is on screen now.
interface Job { gen: number; run: () => Promise<void> }
const Q = { gen: 0, jobs: [] as Job[], running: 0 };
function pump(): void {
  while (Q.running < 2 && Q.jobs.length) {
    const j = Q.jobs.shift();
    if (!j || j.gen !== Q.gen) continue;
    Q.running++;
    j.run().catch(() => {}).then(() => { Q.running--; pump(); });
  }
}
function warmImg(u: string, ss?: string): Promise<void> {
  const key = ss || u;
  if (WARM.has(key)) return Promise.resolve();
  WARM.add(key);
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    if ('fetchPriority' in im) im.fetchPriority = 'low';
    im.onload = im.onerror = () => res();
    if (ss) { im.sizes = TILE_SIZES; im.srcset = ss; }
    im.src = u;
  });
}
// Resolves when every image on the stage has loaded (or failed), or after 4 s at most.
function stageReady(): Promise<unknown> {
  const imgs = [...$('lbStage').querySelectorAll<HTMLImageElement>('#lbImg:not([hidden]), #lbPair img')].filter((im) => !im.complete || im.classList.contains('wait'));
  const one = (im: HTMLImageElement) => new Promise<void>((res) => {
    if (im.complete && !im.classList.contains('wait')) { res(); return; }
    im.addEventListener('load', () => res(), { once: true });
    im.addEventListener('error', () => res(), { once: true });
    im.addEventListener('swapped', () => res(), { once: true });
  });
  return Promise.race([Promise.all(imgs.map(one)), new Promise((res) => setTimeout(res, 4000))]);
}
function preloadAround(p: Pose, m: Medium): void {
  const gen = ++Q.gen;
  Q.jobs = [];
  if (veiled(p)) return;
  const first: (() => Promise<void>)[] = [];
  const dl = $<HTMLAnchorElement>('lbDl');
  // Phones: the save button's files first (the overview's whole angle, or the one image), so a tap can share them.
  if (SAVE_SET) SAVE_SET.forEach((x) => first.push(() => Album.prefetch(x.url, x.name)));
  else if (ALBUM && dl.href) first.push(() => Album.prefetch(dl.href, dl.getAttribute('download')));
  if (SLOW) { void stageReady().then(() => { if (gen === Q.gen) { first.forEach((run) => Q.jobs.push({ gen, run })); pump(); } }); return; }
  const v = LB.v, others = VIEWS.map((_, i) => i).filter((i) => i !== v);
  const kinds: Kind[] = ['line', ...(p.clay.some(Boolean) ? MAP_KINDS : []), ...(p.photo.some(Boolean) ? ['photo'] as Kind[] : [])];
  const urls: (string | [string, string])[] = [];
  if (m === 'compare') others.forEach((i) => kinds.forEach((k) => { const f = p[k][i]; if (f) urls.push([src(k, 'w600', f), tileSet(k, f)]); }));
  else {
    const arr = lbFiles(p, m);
    others.forEach((i) => { if (arr[i]) urls.push(src(m, 'w900', arr[i])); });
    kinds.forEach((k) => { if (k !== m && p[k][v]) urls.push(src(k, 'w900', p[k][v])); });
  }
  const list = lbList(), next = list[(list.indexOf(p) + 1) % list.length];
  if (next && next !== p && !veiled(next)) kinds.forEach((k) => { const f = next[k][v]; if (f) urls.push(m === 'compare' ? [src(k, 'w600', f), tileSet(k, f)] : src(k, 'w900', f)); });
  // Only once the images on screen are in.
  void stageReady().then(() => {
    if (gen !== Q.gen) return;
    first.forEach((run) => Q.jobs.push({ gen, run }));
    urls.forEach((u) => Q.jobs.push({ gen, run: () => (Array.isArray(u) ? warmImg(u[0], u[1]) : warmImg(u)) }));
    pump();
  });
}
/* Re-render without rebuilding: morph() keeps the existing nodes and only changes what differs, so switching angle
   no longer recreates every image (which flashed even from cache). Images change through swapSrc(): the new one is
   decoded off-screen and replaces the old in one step; until then the old one stays, dimmed (.wait). */
function morph(el: Element, html: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  syncKids(el, tpl.content);
}
function syncKids(a: Element, b: ParentNode): void {
  const A = [...a.childNodes], B = [...b.childNodes];
  if (A.length !== B.length || A.some((n, i) => n.nodeType !== B[i].nodeType || n.nodeName !== B[i].nodeName)) {
    a.replaceChildren(...B);
    a.querySelectorAll('img').forEach(watchImg);
    return;
  }
  A.forEach((n, i) => {
    const m = B[i];
    if (n instanceof Text && m instanceof Text) { if (n.data !== m.data) n.data = m.data; return; }
    if (!(n instanceof Element) || !(m instanceof Element)) return;
    const isImg = n instanceof HTMLImageElement;
    for (const at of [...n.attributes]) if (!m.hasAttribute(at.name) && !(isImg && /^(src|srcset|class|data-want)$/.test(at.name))) n.removeAttribute(at.name);
    for (const at of [...m.attributes]) if (!(isImg && /^(src|srcset)$/.test(at.name)) && n.getAttribute(at.name) !== at.value) n.setAttribute(at.name, at.value);
    if (isImg) swapSrc(n, m.getAttribute('src') || '', m.getAttribute('srcset') || '');
    else syncKids(n, m);
  });
}
function swapSrc(img: HTMLImageElement, s: string, ss: string): void {
  if ((img.dataset.want || img.getAttribute('src')) === s && (img.getAttribute('srcset') || '') === ss) return;
  img.dataset.want = s;
  if (!img.getAttribute('src')) { if (ss) img.srcset = ss; img.src = s; watchImg(img); return; }
  img.classList.add('wait');
  const im = new Image();
  if (ss) { im.sizes = img.sizes; im.srcset = ss; }
  im.src = s;
  im.decode().catch(() => {}).then(() => {
    if (img.dataset.want !== s) return;
    if (ss) img.srcset = ss; else img.removeAttribute('srcset');
    img.src = s;
    img.classList.remove('wait');
    img.dispatchEvent(new Event('swapped'));
  });
}
// A failed image gets a retry button instead of a blank box.
function watchImg(img: HTMLImageElement): void {
  img.addEventListener('error', () => {
    const box = img.closest('.lb-tile, .lb-stage');
    if (!box || box.querySelector(':scope > .lb-retry')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-retry';
    b.textContent = t().retry;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      b.remove();
      const u = (img.getAttribute('src') || '').split('?')[0] + '?r=' + Date.now();
      img.removeAttribute('srcset');
      img.src = u;
    });
    box.appendChild(b);
  }, { once: true });
}
const posePage = (id: string) => BASE + PREFIX[S.lang] + 'pose/' + id + '/';
// Same rule as tools/build_site.py: only general-rated std poses get a static page.
const hasPosePage = (p: Pose) => p.series === 'std' && !p.suggestive;
function stepAngle(d: number): void {
  LB.hl = null;
  const arr = lbFiles(pose(LB.id), LB.medium);
  for (let k = 1; k <= 5; k++) {
    const i = (LB.v + d * k + 25) % 5;
    if (arr[i]) { LB.v = i; break; }
  }
  renderLb();
}
function stepPose(d: number): void {
  LB.hl = null;
  const list = lbList();
  const i = list.findIndex((p) => p.id === LB.id);
  const next = list[(i + d + list.length) % list.length];
  openLb(next.id, LB.v, LB.medium);
}
// Back to the overview: through history when a tile pushed an entry, so back button, Esc and the browser's back
// all land on the same entry.
function toOverview(): void {
  if (LB.pushed) history.back();
  else openLb(LB.id, LB.v, 'compare', true);
}
// Switching from one enlarged format to another replaces the entry; the overview goes back through history.
function pickFormat(k: Medium): void {
  if (k === LB.medium) return;
  if (k === 'compare') { toOverview(); return; }
  // Leaving the overview pushes one entry, as a tile tap does, so back returns to it.
  if (LB.medium === 'compare') { history.pushState(null, '', location.href); LB.pushed = true; }
  openLb(LB.id, LB.v, k, true);
}
function flash(label: string): void {
  const el = $('lbFlash');
  el.textContent = label;
  el.classList.remove('on');
  void el.offsetWidth;  // restart the fade
  el.classList.add('on');
}
$('lbPairBtn').addEventListener('click', pairPose);
$('lbPrev').addEventListener('click', () => stepAngle(-1));
$('lbNext').addEventListener('click', () => stepAngle(1));
$('lbClose').addEventListener('click', () => lb.close());
$('lbPrevPose').addEventListener('click', () => stepPose(-1));
$('lbNextPose').addEventListener('click', () => stepPose(1));
$('lbMore').addEventListener('click', () => { LB.more = !LB.more; renderLb(); });
$('lbChips').addEventListener('click', (e) => {
  const b = closest<HTMLButtonElement>(e, '[data-lbv]');
  if (b && !b.disabled) { LB.v = +(b.dataset.lbv ?? 0); renderLb(); }
});
$('lbMissing').addEventListener('click', (e) => {
  const go = closest(e, '[data-lbgo]');
  const gm = closest(e, '[data-lbgm]');
  if (go) { LB.v = +(go.dataset.lbgo ?? 0); renderLb(); }
  else if (gm) openLb(LB.id, LB.v, gm.dataset.lbgm);
});
$('lbPair').addEventListener('click', (e) => {
  const b = closest(e, '[data-lbopen]');
  if (!b) return;
  LB.hl = null;
  history.pushState(null, '', location.href);
  LB.pushed = true;
  openLb(LB.id, LB.v, b.dataset.lbopen, true);
});
$('lbBack').addEventListener('click', toOverview);
$('lbBack2').addEventListener('click', toOverview);
$('lbFmts').addEventListener('click', (e) => {
  const b = closest<HTMLButtonElement>(e, '[data-lbfmt]');
  if (b && !b.disabled && isMedium(b.dataset.lbfmt)) pickFormat(b.dataset.lbfmt);
});
window.addEventListener('popstate', () => {
  if (!LB.pushed) return;
  LB.pushed = false;
  // Closed while enlarged: the step back only unwinds the entry; drop its hash so nothing reopens.
  if (!lb.open) history.replaceState(null, '', location.pathname + location.search);
  else openLb(LB.id, LB.v, 'compare', true);
});
// Esc on an enlarged format goes back to the overview first; a second Esc closes.
lb.addEventListener('cancel', (e) => {
  if (LB.medium !== 'compare' && hasMedium(pose(LB.id), 'compare')) { e.preventDefault(); toOverview(); }
});
$('lbMedium').addEventListener('click', (e) => {
  const b = closest<HTMLButtonElement>(e, '[data-lbm]');
  if (b && !b.disabled) openLb(LB.id, LB.v, b.dataset.lbm, true);
});
$('lbVeilOne').addEventListener('click', () => reveal(LB.id));
$('lbVeilAll').addEventListener('click', () => setAdult(true));
$('lbCopyDesc').addEventListener('click', () => void copy(pose(LB.id).desc_en || ''));
$('lbCopyId').addEventListener('click', () => void copy(LB.id));
$<HTMLAnchorElement>('lbDl').addEventListener('click', saveToAlbum);
$<HTMLAnchorElement>('lbDl2').addEventListener('click', saveToAlbum);
// Share the pose page, not this #hash: link previews never see a fragment, the pose page has its own card.
// Poses without a page fall back to the gallery deep link (generic card, but it opens the pose).
$('lbShare').addEventListener('click', () => {
  const p = pose(LB.id);
  const f = p.line[LB.v] || p.line[firstView(p.line)];
  openShare({
    url: hasPosePage(p) ? posePage(p.id) : BASE + PREFIX[S.lang] + '#' + p.id + '-' + VIEWS[LB.v],
    heading: t().shareTitle,
    text: t().shareText.replace('{name}', nameOf(p)),
    image: new URL(src('line', 'w900', f), location.href).href
  });
});
lb.addEventListener('close', () => {
  LB.hl = null;
  history.replaceState(null, '', location.pathname + location.search);
  if (LB.pushed) history.back();
});
// On document, not the dialog: re-rendering the chips or clicking the image drops focus to <body>,
// and a dialog-scoped listener would then miss every key until the reader tabbed back in.
document.addEventListener('keydown', (e) => {
  // The share sheet opens on top of the lightbox; its keys are its own.
  if (!lb.open || document.querySelector('dialog[open]:not(#lb)') || closest(e, 'textarea, input:not([type="range"])')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); stepAngle(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepAngle(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); stepPose(-1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepPose(1); }
  else if (e.key === 'l' || e.key === 'L') {
    const p = pose(LB.id), have = MEDIA.filter((k) => hasMedium(p, k));
    if (have.length > 1) openLb(LB.id, LB.v, have[(have.indexOf(LB.medium) + 1) % have.length]);
  }
});
// The wipe: line art over the map, cut at the slider. Its own pointer events must not reach the stage's swipe.
function setWipe(): void {
  const x = +$<HTMLInputElement>('lbWipeRange').value;
  // On the image itself: a clipped wrapper would be its own stacking context and the multiply would see white.
  $('lbWipeImg').style.clipPath = 'inset(0 ' + (100 - x) + '% 0 0)';
  $('lbWipeBar').style.setProperty('--x', x + '%');
}
$('lbWipeRange').addEventListener('input', setWipe);
$('lbWipeBar').addEventListener('pointerdown', (e) => e.stopPropagation());
watchImg($<HTMLImageElement>('lbImg'));
let swipeX: number | null = null, swipeY: number | null = null;
$('lbStage').addEventListener('pointerdown', (e) => { swipeX = e.clientX; swipeY = e.clientY; });
$('lbStage').addEventListener('pointerup', (e) => {
  if (swipeX === null || swipeY === null) return;
  const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
  swipeX = swipeY = null;
  // Phones: up / down steps through the formats in the row's order (not while the details panel scrolls).
  if (ALBUM && !LB.more && Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
    const p = pose(LB.id), list = fmtList(p).filter((k) => k === 'compare' || p[k][LB.v]);
    const i = list.indexOf(LB.medium), next = list[i + (dy < 0 ? 1 : -1)];
    if (next) { pickFormat(next); flash(next === 'compare' ? t().overview : fmtName(next)); }
  } else if (Math.abs(dx) > 50) stepAngle(dx < 0 ? 1 : -1);
});

// Deep links: #P001 and #P001-diag open the overview (as do the older #P001-diag-compare links);
// #P001-diag-line, -clay, -depth, -normal and -photo open one format.
function openFromHash(): void {
  const m = location.hash.match(/^#([PSUD]\d{3})(?:-(front|diag|side|above|below))?(?:-(line|clay|depth|normal|photo|compare))?$/);
  if (m && byId.has(m[1])) openLb(m[1], m[2] ? VIEWS.indexOf(m[2] as (typeof VIEWS)[number]) : 0, m[3]);
}
window.addEventListener('hashchange', openFromHash);

/* boot */
renderMarquee();
renderAll();
openFromHash();
