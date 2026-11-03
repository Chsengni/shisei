// Shapes of the data the build (tools/build_site.py) inlines into each page.
export type Loc = 'zh' | 'ja' | 'en' | 'ko';
export const LANGS: readonly Loc[] = ['zh', 'ja', 'en', 'ko'];
export const PREFIX: Record<Loc, string> = { zh: '', ja: 'ja/', en: 'en/', ko: 'ko/' };
export const isLoc = (x: unknown): x is Loc => typeof x === 'string' && (LANGS as readonly string[]).includes(x);

export type View = 'front' | 'diag' | 'side' | 'above' | 'below';
export const VIEWS: readonly View[] = ['front', 'diag', 'side', 'above', 'below'];
export type Series = 'std' | 'upper' | 'sexy' | 'duo';
export type NameSuffix = 'cn' | 'jp' | 'en' | 'kr';
export type Rating = 'general' | 'suggestive';
export type MapKind = 'clay' | 'depth' | 'normal';

/** One pose of data/catalog.json, as far as the gallery reads it. */
export interface CatalogPose {
  id: string;
  orig_id?: string | null;
  series: Series;
  rating: Rating;
  class_en: string;
  class_cn: string;
  class_jp: string;
  class_kr: string;
  name_cn: string;
  name_jp: string;
  name_en: string;
  name_kr: string;
  desc_en?: string;
  views: Partial<Record<View, string | null>>;
  photos?: Partial<Record<View, string | null>>;
  maps?: Partial<Record<View, string | null>>;
}

export interface NavLib {
  key: string;
  n: number;
  views: string[];
  dir: string;
  kind: 'grey' | 'photo' | 'line';
  group: 'wear' | 'near' | 'env';
  thumb: string | null;
  imgs: number;
}
/** window.SHISEI_NAV: menu and tray data, inlined into every page by the build. */
export interface NavData {
  poses: number;
  series: [Series, number][];
  libs: NavLib[];
  root: string;
  media: string;
}

export interface Pack { file: string; bytes: number; sets?: number }
export interface Packs { version: string; packs: Record<string, Pack> }

/** window.SHISEI: per-page settings on the gallery and library pages. */
export interface SiteConfig {
  repo: string;
  version: string;
  base: string;
  lang: string;
  packs?: Packs | null;
}

/** One library as its page reads it (build_site.library_data). */
export interface LibItem {
  id: string;
  cat: string;
  r: Rating;
  n: Record<Loc, string>;
  sub: Record<Loc, string> | null;
  desc: string;
  clause: string;
  v: (string | null)[];
  m: number;
  g?: 'F' | 'M' | 'U';
}
export interface LibData {
  lib: string;
  views: string[];
  dir: string;
  kind: 'grey' | 'photo' | 'line';
  cats: { key: string; name: Record<Loc, string> }[];
  items: LibItem[];
}

declare global {
  interface Window {
    SHISEI?: SiteConfig;
    SHISEI_NAV?: NavData;
  }
  interface Navigator {
    connection?: { saveData?: boolean; effectiveType?: string };
  }
}
