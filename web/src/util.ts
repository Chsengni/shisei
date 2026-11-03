// Small DOM helpers shared by every page script.
import { isLoc, type Loc } from './types';

/** An element the page template guarantees; a missing one is a template bug, so it throws. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('#' + id + ' is missing from the page');
  return el as T;
}
/** The element an event started on, as an Element (text nodes and the document fall back to null). */
export function target(e: Event): Element | null {
  const t = e.target;
  return t instanceof Element ? t : null;
}
/** closest() from an event target, typed. */
export function closest<T extends Element = HTMLElement>(e: Event, sel: string): T | null {
  const t = target(e);
  return t ? (t.closest(sel) as T | null) : null;
}

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ENT[c] ?? c);

/** localStorage under the shisei. prefix; private mode keeps it to this page. */
export const store = {
  get(k: string): string | null {
    try { return localStorage.getItem('shisei.' + k); } catch { return null; }
  },
  set(k: string, v: string): void {
    try { localStorage.setItem('shisei.' + k, v); } catch { /* private mode */ }
  }
};

export const pageLoc = (): Loc => {
  const l = document.documentElement.dataset.loc;
  return isLoc(l) ? l : 'zh';
};

/** Flip the colour scheme and remember it (the head script applies it before first paint next time). */
export function toggleTheme(): void {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  store.set('theme', r.dataset.theme);
}

let toastTimer = 0;
export function toast(msg: string, ms = 1600): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}
