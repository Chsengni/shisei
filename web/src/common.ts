// Behaviour shared by the gallery and the generated pages: share sheet, copy buttons, language links, site menu,
// changelog filter and the phone photo-album saver. Strings come from i18n.ts; the page language is <html data-loc>.
import { I18N, I18N_LIB } from './i18n';
import { LANGS, PREFIX, type Series } from './types';
import { closest, esc, pageLoc, toast, toggleTheme } from './util';

const loc = pageLoc();
const T = I18N[loc];
const enc = encodeURIComponent;

// Plain share links: no SDKs, nothing loads until the reader picks one. Which ones show depends on the language
// (T.nets): Weibo for zh, LINE for ja / ko, Reddit for en; Pinterest everywhere, it is where pose references live.
type Net = (u: string, t: string, img?: string) => string;
const NETS: Record<string, Net> = {
  x: (u, t) => 'https://x.com/intent/tweet?text=' + enc(t) + '&url=' + enc(u),
  facebook: (u) => 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u),
  line: (u, t) => 'https://social-plugins.line.me/lineit/share?url=' + enc(u) + '&text=' + enc(t),
  weibo: (u, t, img) => 'https://service.weibo.com/share/share.php?url=' + enc(u) + '&title=' + enc(t) + (img ? '&pic=' + enc(img) : ''),
  pinterest: (u, t, img) => 'https://www.pinterest.com/pin/create/button/?url=' + enc(u) + '&description=' + enc(t) + (img ? '&media=' + enc(img) : ''),
  reddit: (u, t) => 'https://www.reddit.com/submit?url=' + enc(u) + '&title=' + enc(t)
};
const CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export async function copy(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    ta.remove();
  }
  toast(T.copied);
}

let dlg: HTMLDialogElement | null = null;
function sheet(): HTMLDialogElement {
  if (dlg) return dlg;
  const d = document.createElement('dialog');
  d.className = 'info share-sheet';
  d.setAttribute('aria-labelledby', 'shareH');
  d.innerHTML = '<div class="info-h"><h2 id="shareH"></h2><button type="button" class="circle" data-share-close aria-label="' + esc(T.close || '×') + '">' + CLOSE_SVG + '</button></div>' +
    '<div class="share-url"><input type="text" readonly aria-label="URL"><button type="button" class="pill dark small" data-share-copy>' + esc(T.copyLink) + '</button></div>' +
    '<div class="share-nets"></div>';
  d.addEventListener('click', (e) => {
    if (e.target === d || closest(e, '[data-share-close]')) d.close();
    if (closest(e, '[data-share-copy]')) void copy(d.querySelector('input')?.value ?? '');
  });
  document.body.appendChild(d);
  dlg = d;
  return d;
}

export interface ShareOpts { url?: string; heading?: string; text?: string; image?: string }
/** The system share sheet on phones, our own sheet elsewhere. */
export function openShare(o: ShareOpts): void {
  const url = new URL(o.url || location.href, location.href).href;
  const text = o.text || document.title;
  if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    navigator.share({ title: text, text, url }).catch(() => { /* dismissed */ });
    return;
  }
  const d = sheet();
  const h = d.querySelector('h2'), input = d.querySelector('input'), nets = d.querySelector('.share-nets');
  if (h) h.textContent = o.heading || T.share;
  if (input) input.value = url;
  if (nets) nets.innerHTML = Object.keys(T.nets).filter((k) => NETS[k]).map((k) =>
    '<a class="pill light" target="_blank" rel="noopener noreferrer" href="' + esc(NETS[k](url, text, o.image)) + '">' + esc(T.nets[k]) + '</a>').join('');
  d.showModal();
}

/* Phones save to the photo album: <a download> lands in Files on iOS and in Downloads on Android, while the
   system share sheet with the file attached offers "Save Image", which goes to Photos. share() has to run inside
   the tap and an awaited fetch first loses the gesture on iOS, so files are fetched ahead of the tap. Browsers
   without file sharing (WeChat, older ones) get a long-press hint instead. One cache for the gallery lightbox, the
   library lightbox and the tray, so a file one of them fetched is ready for the others. */
const ALBUM = matchMedia('(pointer: coarse)').matches;
const CAN_SHARE = ALBUM && typeof navigator.canShare === 'function' && (() => {
  try { return navigator.canShare({ files: [new File([''], 'a.webp', { type: 'image/webp' })] }); } catch { return false; }
})();
interface FileEntry { file: File | null; done: Promise<void> }
const FILES = new Map<string, FileEntry>();
export type SaveWhy = 'preparing' | 'unsupported' | 'failed';
export interface SaveFile { url: string; name: string }

/** Fetch an image as a File for a later save(); resolves when done (or failed). */
function prefetch(url: string | null | undefined, name: string | null): Promise<void> {
  if (!CAN_SHARE || !url) return Promise.resolve();
  const have = FILES.get(url);
  if (have) return have.done;
  const entry: FileEntry = { file: null, done: Promise.resolve() };
  FILES.set(url, entry);
  // About 60 KB each; keep the recent ones so stepping back and forth needs no refetch.
  if (FILES.size > 40) { const oldest = FILES.keys().next().value; if (oldest !== undefined) FILES.delete(oldest); }
  entry.done = fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => { entry.file = new File([b], name || 'shisei.webp', { type: 'image/webp' }); })
    .catch(() => { FILES.delete(url); });
  return entry.done;
}
/** Open the share sheet with the files if they are all fetched, else start fetching and tell the reader why not. */
function save(list: SaveFile[], hint: (why: SaveWhy) => void): void {
  if (!CAN_SHARE) { hint('unsupported'); return; }
  const got = list.map((x) => FILES.get(x.url)?.file ?? null);
  if (got.every((f): f is File => f !== null)) {
    // Resolving only means the sheet closed, not that the image was saved, so success says nothing.
    navigator.share({ files: got }).catch((err: unknown) => { if (!(err instanceof DOMException && err.name === 'AbortError')) hint('failed'); });
  } else { list.forEach((x) => void prefetch(x.url, x.name)); hint('preparing'); }
}
export const Album = { on: ALBUM, canShare: CAN_SHARE, prefetch, save };

document.addEventListener('click', (e) => {
  const s = closest(e, '[data-share]');
  if (s) {
    const site = s.hasAttribute('data-share-site');
    const cfg = window.SHISEI;
    const home = cfg ? cfg.base + (loc === 'zh' ? '' : loc + '/') : null;
    openShare({
      url: s.dataset.shareUrl || (site && home !== null ? home : location.href),
      heading: site ? T.shareSite : (s.dataset.shareHeading || T.shareTitle),
      text: s.dataset.shareText || document.title,
      image: s.dataset.shareImage
    });
  }
  const c = closest(e, '[data-copy]');
  if (c?.dataset.copy) void copy(c.dataset.copy);
  // Picking a language by hand is remembered, so the zh / x-default pages send the reader there next time.
  const l = closest(e, '[data-lang-link]');
  if (l?.dataset.langLink) { try { localStorage.setItem('shisei.lang', l.dataset.langLink); } catch { /* private mode */ } }
});

/* Site menu (docs/DESIGN.md, 素材库与搭配): a "Library" dropdown in the desktop nav and, below 1100 px where the nav
   links are hidden, a menu button that opens the whole site on one screen. Built here so the gallery, the library
   pages and the generated pages share one menu; the data is window.SHISEI_NAV (tools/build_site.py). */
const LOGO = '<svg class="logo" width="36" height="36" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="24" fill="#18181B"/><circle cx="60" cy="23" r="8" fill="none" stroke="#F5F2ED" stroke-width="6"/><path d="M57 37C38 52 42 68 64 82" fill="none" stroke="#E07A52" stroke-width="11" stroke-linecap="round"/></svg>';
const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
function siteMenu(): void {
  const NAV = window.SHISEI_NAV;
  const TL = I18N_LIB[loc];
  if (!NAV || !NAV.libs.length) return;
  const home = NAV.root + PREFIX[loc];
  const here = (location.pathname.match(/\/(costume|prop|furniture|animal|scene|light)\/$/) || [])[1];
  const libName = (key: string): string => (T.libs as Record<string, { name: string }>)[key]?.name ?? key;
  const thumb = (l: (typeof NAV.libs)[number]) => (l.thumb ? '<img src="' + esc(NAV.media + 'images/' + l.dir + '/w300/' + l.thumb) + '" alt="" loading="lazy">' : '');
  const libLink = (l: (typeof NAV.libs)[number], cls: string) => '<a class="' + cls + ' ' + l.kind + '" href="' + esc(home + l.key + '/') + '"' + (l.key === here ? ' aria-current="page"' : '') + '>' +
    '<span class="lk-img">' + thumb(l) + '</span><span class="lk-t"><b>' + esc(libName(l.key)) + '</b><span class="mono">' + l.n + '</span></span></a>';
  const groups = (['wear', 'near', 'env'] as const).map((g) => [g, NAV.libs.filter((l) => l.group === g)] as const).filter((x) => x[1].length);
  const links = document.querySelector('.nav-links');
  if (links) {
    const box = document.createElement('div');
    box.className = 'libnav';
    box.innerHTML = '<button type="button" class="libnav-btn" aria-expanded="false" aria-controls="libnavPop"' + (here ? ' aria-current="page"' : '') + '>' + esc(T.navLibrary) +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div class="libnav-pop" id="libnavPop" hidden>' + groups.map(([g, ls]) => '<span class="libnav-g">' + esc(TL.groups[g]) + '</span><div class="libnav-row">' + ls.map((l) => libLink(l, 'lk')).join('') + '</div>').join('') + '</div>';
    const first = links.querySelector('a');
    links.insertBefore(box, first ? first.nextSibling : links.firstChild);
    const btn = box.querySelector('button') as HTMLButtonElement, pop = box.querySelector('.libnav-pop') as HTMLElement;
    const setOpen = (o: boolean) => { btn.setAttribute('aria-expanded', String(o)); pop.hidden = !o; };
    btn.addEventListener('click', () => setOpen(pop.hidden));
    document.addEventListener('click', (e) => { if (!closest(e, '.libnav')) setOpen(false); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setOpen(false); btn.focus(); } });
  }
  const tools = document.querySelector('.nav-tools');
  if (!tools) return;
  const mb = document.createElement('button');
  mb.type = 'button';
  mb.className = 'circle menu-btn';
  mb.setAttribute('aria-label', TL.menu);
  mb.setAttribute('aria-haspopup', 'dialog');
  mb.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  tools.appendChild(mb);
  let menu: HTMLDialogElement | null = null;
  mb.addEventListener('click', () => {
    if (!menu) {
      // The same page in each language: the path after the language prefix, plus query and hash.
      const root = new URL(NAV.root || './', location.href).pathname;
      const key = location.pathname.slice(root.length).replace(/^(ja|en|ko)\//, '');
      const langs = LANGS.map((l) => '<a href="' + esc(NAV.root + PREFIX[l] + key + location.search) + '" data-lang-link="' + l + '" lang="' + I18N[l].htmlLang + '"' + (l === loc ? ' aria-current="true"' : '') + '>' + esc(I18N[l].langName) + '</a>').join('');
      const ser = T.series as Record<string, string>;
      const tint: Record<Series, string> = { std: '#AFC3E0', upper: '#D3D1E6', sexy: '#EBC0BC', duo: '#BCD3C6' };
      const repo = (document.querySelector('a.gh') as HTMLAnchorElement | null)?.href || 'https://github.com/wquguru/shisei';
      const m = document.createElement('dialog');
      m.className = 'site-menu';
      m.setAttribute('aria-label', TL.menu);
      m.innerHTML = '<div class="sm-h"><a class="brand" href="' + esc(home || './') + '">' + LOGO + '<span>Shisei</span></a>' +
        '<button type="button" class="circle" data-menu-close aria-label="' + esc(T.close || '×') + '">' + CLOSE_SVG.replace(/16/g, '18') + '</button></div>' +
        '<nav class="sm-body" aria-label="' + esc(TL.menu) + '">' +
        '<a class="sm-poses" href="' + esc(home + '#all') + '"><span>' + esc(T.navPoses) + '</span><span class="mono">' + esc(TL.poseSets(NAV.poses)) + ' →</span></a>' +
        '<div class="sm-series">' + NAV.series.map(([k, n]) => '<a href="' + esc(home + '?series=' + k + '#all') + '"><i style="background:' + tint[k] + '"></i><span>' + esc(ser[k] || k) + '</span><span class="mono">' + n + '</span></a>').join('') + '</div>' +
        '<span class="sm-label">' + esc(TL.libsLabel) + '</span><div class="sm-libs">' + NAV.libs.map((l) => libLink(l, 'sm-lib')).join('') + '</div>' +
        '<div class="sm-links"><a href="' + esc(home + 'changelog/') + '">' + esc(T.navChangelog) + '</a><a href="' + esc(repo) + '">GitHub</a></div></nav>' +
        '<div class="sm-foot"><div class="sm-langs">' + langs + '</div><button type="button" class="circle" data-menu-theme aria-label="' + esc(T.theme || '') + '">' + SUN + '</button></div>';
      m.addEventListener('click', (e) => {
        if (e.target === m || closest(e, '[data-menu-close]')) m.close();
        else if (closest(e, '[data-menu-theme]')) toggleTheme();
        else if (closest(e, 'a')) setTimeout(() => m.close(), 0);  // same-page links (#all) still land
      });
      document.body.appendChild(m);
      menu = m;
    }
    menu.showModal();
  });
}
siteMenu();

// Changelog: filter by tag. Without JS the buttons stay hidden and every entry shows.
const g = document.querySelector<HTMLElement>('[data-filter-group]');
if (g) {
  g.hidden = false;
  g.addEventListener('click', (e) => {
    const b = closest(e, '[data-filter]');
    if (!b) return;
    const f = b.dataset.filter;
    let n = 0;
    g.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    document.querySelectorAll<HTMLElement>('article[data-tag]').forEach((a) => { a.hidden = !(f === 'all' || a.dataset.tag === f); if (!a.hidden) n++; });
    document.querySelectorAll<HTMLElement>('.cl-list section').forEach((s) => { s.hidden = !s.querySelector('article:not([hidden])'); });
    const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
    if (empty) empty.hidden = n > 0;
  });
}
