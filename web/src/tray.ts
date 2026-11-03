/* The tray (docs/DESIGN.md, 素材库与搭配): a pose and what goes with it, picked across the gallery and the library
   pages, stays together in a bar at the bottom right (full width on phones). The pose is always the first slot: the
   site is a pose library, and costumes, props, furniture, animals, scenes and light attach to a pose. Each library
   gets a slot once something is picked from it; "+" lists the others. "Done" opens the set: every image, a combined
   prompt and the downloads. The set lives in localStorage so it survives moving between pages; × ends it. */
import { Album, copy } from './common';
import { I18N, I18N_LIB } from './i18n';
import { PREFIX, VIEWS, type CatalogPose, type Loc, type NavLib } from './types';
import { closest, esc, pageLoc } from './util';

export interface TrayPose { id: string; v: number; file: string | null; tint?: string; desc: string; names: Record<Loc, string> }
export interface TrayItem { id: string; files: (string | null)[]; names?: Record<Loc, string>; clause: string; v?: number; keep?: string }
export interface TrayState { pose?: TrayPose | null; items: Record<string, TrayItem>; costume?: TrayItem }
interface Member { lib: string; x: TrayPose | TrayItem; v: number; href: string; src: (tier: string) => string; file: string; tint?: string }

const KEY = 'shisei.combo';
const loc = pageLoc();
const T = I18N[loc], TC = I18N_LIB[loc];
const NAV = window.SHISEI_NAV ?? { root: '', media: '', libs: [] as NavLib[], poses: 0, series: [] };
const ROOT = NAV.root, MEDIA = NAV.media;
const LIBS = new Map(NAV.libs.map((l) => [l.key, l]));
const ORDER = NAV.libs.map((l) => l.key);
const lib = (k: string): NavLib => {
  const l = LIBS.get(k);
  if (!l) throw new Error('unknown library ' + k);
  return l;
};
const home = ROOT + PREFIX[loc];
const libPage = (k: string) => home + k + '/';
const poseImg = (tier: string, f: string | null) => ROOT + 'images/line/' + tier + '/' + (f ?? '');
const libImg = (k: string, tier: string, f: string | null) => MEDIA + 'images/' + lib(k).dir + '/' + tier + '/' + (f ?? '');
const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const ICON_DL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>';
const libName = (k: string): string => (T.libs as Record<string, { name: string }>)[k]?.name ?? k;
const viewName = (v: string): string => (TC.views as Record<string, string>)[v] ?? v;

const store = {
  get(): TrayState {
    let s: TrayState;
    try { s = (JSON.parse(localStorage.getItem(KEY) || 'null') as TrayState | null) || { items: {} }; } catch { s = { items: {} }; }
    // The first tray (2026-11-01) held one costume beside the pose.
    if (s.costume) { s.items = { costume: { ...s.costume, clause: 'wearing ' + (s.costume.keep || '') }, ...s.items }; delete s.costume; }
    s.items = s.items || {};
    for (const k of Object.keys(s.items)) if (!LIBS.has(k)) delete s.items[k];
    return s;
  },
  set(v: TrayState): void { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: this page only */ } }
};
let state = store.get();
let open = false, adding = false;
let page = 'pose';  // the slot this page fills: 'pose' or a library key
// Saving the set to the photo album goes through common.ts (Album), the same cache the lightboxes use.
const SHARE = Album.canShare;

// A library's view for the pose's angle: the same angle when the library has it; scenes put the three level angles
// at eye level; anything else falls back to the front, then to the first view that exists.
function viewFor(k: string, fs: (string | null)[]): number {
  const views = lib(k).views;
  const pv = VIEWS[state.pose ? state.pose.v : 0];
  let want = views.indexOf(pv);
  if (want < 0) want = views.indexOf(views.includes('eye') && ['front', 'diag', 'side'].includes(pv) ? 'eye' : 'front');
  return want >= 0 && fs[want] ? want : fs.findIndex(Boolean);
}
const picked = () => ORDER.filter((k) => state.items[k]);
const poseHref = (p: TrayPose) => home + '#' + p.id + '-' + VIEWS[p.v];
const itemHref = (k: string, x: TrayItem, v: number) => libPage(k) + '#' + x.id + '-' + lib(k).views[v];
const nameOf = (x: TrayPose | TrayItem) => x.names?.[loc] || x.id;
function prompt(): string {
  const p = state.pose;
  return [p ? p.desc : ''].concat(picked().map((k) => state.items[k].clause)).filter(Boolean).join(', ');
}
// Every image of the set at the pose's angle.
function members(): Member[] {
  const out: Member[] = [];
  const p = state.pose;
  if (p) out.push({ lib: 'pose', x: p, v: p.v, tint: p.tint, href: poseHref(p), src: (t) => poseImg(t, p.file), file: 'shisei_' + p.id + '_' + VIEWS[p.v] + '.webp' });
  for (const k of picked()) {
    const x = state.items[k], v = viewFor(k, x.files);
    if (v < 0) continue;
    out.push({ lib: k, x, v, href: itemHref(k, x, v), src: (t) => libImg(k, t, x.files[v]), file: 'shisei_' + x.id + '_' + lib(k).views[v] + '.webp' });
  }
  return out;
}

const el = document.createElement('div');
el.className = 'tray';
el.id = 'tray';
el.setAttribute('role', 'region');
el.setAttribute('aria-label', TC.tray);
el.hidden = true;
document.body.appendChild(el);

const isLine = (k: string) => k === 'pose' || lib(k).kind === 'line';
const tintStyle = (m: Member) => (m.lib === 'pose' ? ' style="--tint:' + esc(m.tint || 'var(--tile)') + '"' : '');
function thumb(m: Member): string {
  return '<span class="tray-th' + (isLine(m.lib) ? ' line' : '') + '"' + tintStyle(m) + '><img src="' + esc(m.src('w300')) + '" alt=""></span>';
}
function slotHtml(m: Member): string {
  const label = m.lib === 'pose' ? TC.slotPose : libName(m.lib);
  const cur = page === m.lib ? ' cur' : '';
  return '<a class="tray-slot' + cur + '" href="' + esc(m.href) + '" data-slot="' + m.lib + '" aria-label="' + esc(label + ' ' + m.x.id + ' ' + nameOf(m.x)) + '">' + thumb(m) +
    '<span class="tray-st"><small>' + esc(label) + (cur ? '<span class="tray-pk"> · ' + esc(TC.picking) + '</span>' : '') + '</small><b class="mono">' + esc(m.x.id) + '</b></span></a>';
}
function emptySlot(kind: string): string {
  const isPose = kind === 'pose';
  return '<a class="tray-slot empty' + (page === kind ? ' cur' : '') + '" href="' + esc(isPose ? home + '#all' : libPage(kind)) + '" data-slot="' + kind + '">' +
    '<span class="tray-plus" aria-hidden="true">+</span><span class="tray-st"><small>' + esc(isPose ? TC.slotPose : libName(kind)) + '</small><b>' + esc(isPose ? TC.pickPose : libName(kind)) + '</b></span></a>';
}
function cardHtml(m: Member): string {
  const lab = m.lib === 'pose' ? TC.slotPose : libName(m.lib);
  const views = m.lib === 'pose' ? VIEWS : lib(m.lib).views;
  return '<div class="tp-card' + (m.lib === 'pose' ? ' pose' : '') + '"><a class="tp-img' + (isLine(m.lib) ? ' line' : '') + '" href="' + esc(m.href) + '" data-slot="' + m.lib + '"' +
    tintStyle(m) + '><img src="' + esc(m.src('w600')) + '" alt="' + esc(m.x.id + ' ' + nameOf(m.x)) + '" loading="lazy"></a>' +
    '<span class="tp-meta"><small>' + esc(lab + ' · ' + viewName(views[m.v])) + '</small><b>' + esc(nameOf(m.x)) + '</b><span class="mono">' + esc(m.x.id) + '</span></span>' +
    '<span class="tp-acts">' + (SHARE ? '' : '<a class="tp-ic" href="' + esc(m.src('w900')) + '" download="' + m.file + '" aria-label="' + esc(TC.dl + ' ' + m.x.id) + '">' + ICON_DL + '</a>') +
    '<a class="tp-ic tp-change" href="' + esc(m.lib === 'pose' ? home + '#all' : libPage(m.lib)) + '">' + esc(TC.change) + '</a>' +
    (m.lib === 'pose' ? '' : '<button type="button" class="tp-ic" data-tray="remove:' + m.lib + '" aria-label="' + esc(TC.remove(lab)) + '">' + ICON_X + '</button>') + '</span></div>';
}

function render(): void {
  const ms = members();
  const p = state.pose, items = ms.filter((m) => m.lib !== 'pose');
  const on = !!(p || items.length);
  el.hidden = !on;
  document.body.classList.toggle('has-tray', on);
  if (!on) { el.innerHTML = ''; open = adding = false; return; }
  const ready = !!p && items.length > 0;
  if (!ready) open = false;
  const rest = ORDER.filter((k) => !state.items[k]);
  const chev = '<svg class="tray-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  let html = '';
  if (open) {
    html += '<section class="tray-panel" id="trayPanel" aria-label="' + esc(TC.group(ms.length)) + '">' +
      '<div class="tp-h"><b>' + esc(TC.group(ms.length)) + '</b><span class="mono">' + esc(ms.map((m) => m.x.id).join(' + ')) + '</span></div>' +
      '<div class="tp-cards">' + ms.map(cardHtml).join('') + '</div>' +
      (rest.length ? '<div class="tp-more"><span>' + esc(TC.add) + '</span>' + rest.map((k) => '<a href="' + esc(libPage(k)) + '">+ ' + esc(libName(k)) + '</a>').join('') + '</div>' : '') +
      '<div class="tp-prompt"><div class="tp-ph"><span>' + esc(TC.prompt) + '</span><button type="button" class="pill light tiny" data-tray="copy">' + esc(T.copy) + '</button></div><p class="mono">' + esc(prompt()) + '</p></div>' +
      (SHARE ? '<button type="button" class="pill dark tp-save" data-tray="save">' + esc(TC.saveGroup(ms.length)) + '</button>' : '') +
      '<p class="tp-tip" id="trayTip" role="status" hidden></p></section>';
    // share() must run inside the tap, so the files are fetched as soon as the panel shows them.
    if (SHARE) ms.forEach((m) => void Album.prefetch(m.src('w900'), m.file));
  }
  if (adding && rest.length) {
    html += '<div class="tray-add" id="trayAdd"><span class="tray-add-h">' + esc(p ? TC.addFor(p.id) : TC.add) + '</span>' +
      rest.map((k) => { const L = lib(k); return '<a href="' + esc(libPage(k)) + '"><span class="tray-th' + (L.kind === 'line' ? ' line' : '') + '">' + (L.thumb ? '<img src="' + esc(libImg(k, 'w300', L.thumb)) + '" alt="">' : '') + '</span><span class="tray-add-n">' + esc(libName(k)) + '</span><span class="mono">' + L.n + '</span></a>'; }).join('') + '</div>';
  }
  // The current library gets an empty slot to fill even before anything is picked from it.
  const here = page !== 'pose' && !state.items[page] ? emptySlot(page) : '';
  const curItem = items.find((m) => m.lib === page);
  const stack = items.slice(0, 3).map((m) => '<span class="tray-th' + (isLine(m.lib) ? ' line' : '') + '"><img src="' + esc(m.src('w300')) + '" alt=""></span>').join('');
  html += '<div class="tray-bar' + (items.length ? '' : ' solo') + '"><span class="tray-l">' + esc(TC.tray) + '</span>' + (p ? slotHtml(ms[0]) : emptySlot('pose')) + chev +
    '<span class="tray-items">' + items.map(slotHtml).join('') + here + '</span>' +
    // Phones: the picked items fold into one slot of stacked thumbnails that opens the set.
    (items.length ? '<button type="button" class="tray-stack' + (curItem ? ' cur' : '') + '" data-tray="' + (ready ? 'toggle' : 'add') + '" aria-label="' + esc(items.map((m) => libName(m.lib) + ' ' + m.x.id).join(', ')) + '"><span class="tray-stack-th">' + stack + '</span><span class="tray-st"><small>' + esc(curItem ? libName(curItem.lib) : TC.tray) + '</small><b class="mono">' + (curItem ? esc(curItem.x.id) : '+' + items.length) + '</b></span></button>' : '<span class="tray-here">' + here + '</span>') +
    (rest.length ? '<button type="button" class="tray-soon" data-tray="add" aria-expanded="' + adding + '" aria-controls="trayAdd" aria-label="' + esc(TC.add) + '">+</button>' : '') +
    (ready ? '<button type="button" class="tray-done" data-tray="toggle" aria-expanded="' + open + '" aria-controls="trayPanel">' + esc(open ? TC.hide : TC.done + ' · ' + ms.length) + '</button>' : '') +
    '<button type="button" class="tray-x" data-tray="end" aria-label="' + esc(TC.end) + '">' + ICON_X + '</button></div>';
  el.innerHTML = html;
}

function tip(msg: string): void {
  const t = document.getElementById('trayTip');
  if (t) { t.textContent = msg; t.hidden = false; }
}
function changed(): void { window.dispatchEvent(new CustomEvent<TrayState>('shisei:combo', { detail: state })); }
function save(): void { store.set(state); render(); changed(); }

el.addEventListener('click', (e) => {
  const slot = closest(e, '[data-slot]');
  if (slot && api.onSlot && api.onSlot(slot.dataset.slot ?? '', state) === true) { e.preventDefault(); return; }
  const b = closest(e, '[data-tray]');
  if (!b) return;
  const [a, arg] = (b.dataset.tray ?? '').split(':');
  if (a === 'toggle') { open = !open; adding = false; render(); }
  else if (a === 'add') { adding = !adding; open = false; render(); }
  else if (a === 'remove') { delete state.items[arg]; save(); }
  else if (a === 'end') { state = { items: {} }; open = adding = false; save(); }
  else if (a === 'copy') void copy(prompt());
  else if (a === 'save') {
    Album.save(members().map((m) => ({ url: m.src('w900'), name: m.file })),
      (why) => tip(why === 'preparing' ? (T.preparing || TC.holdGroup) : TC.holdGroup));
  }
});
// Escape folds the panel or the add list; a click outside the tray folds the add list.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]') || !(open || adding)) return;
  open = adding = false;
  render();
});
document.addEventListener('click', (e) => { if (adding && !closest(e, '#tray')) { adding = false; render(); } });
window.addEventListener('storage', (e) => { if (e.key === KEY) { state = store.get(); render(); changed(); } });

export const tray = {
  get: (): TrayState => state,
  pose: (): TrayPose | null => state.pose || null,
  count: (): number => picked().length,
  // The gallery sets the pose, a library page an item; the panel opens once there is a pose and an item.
  setPose(value: TrayPose): void { state.pose = value; this.afterSet(); },
  setItem(kind: string, value: TrayItem): void { state.items[kind] = value; this.afterSet(); },
  afterSet(): void {
    open = !!state.pose && picked().length > 0;
    adding = false;
    save();
  },
  // After setting a pose with nothing picked yet: show where to go next.
  // Deferred: the tap that called this would otherwise reach the outside-click handler and fold it again.
  showAdd(): void { setTimeout(() => { adding = true; open = false; render(); }, 0); },
  setPage(k: string): void { page = k; render(); },
  viewFor,
  names: (o: CatalogPose): Record<Loc, string> => ({ zh: o.name_cn, ja: o.name_jp, en: o.name_en, ko: o.name_kr }),
  onSlot: null as null | ((kind: string, st: TrayState) => boolean)
};
const api = tray;
render();
