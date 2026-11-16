/**
 * Devanagari fonts the studio can show letters in, and that the Trace Trainer can use as the
 * reference shape for authoring stroke data.
 *
 * - `local`: shipped with the app (packages/web/public/fonts). The Durga Lal Shrestha font is a
 *   legacy, Preeti-layout font: its Devanagari glyphs sit on Latin keys, so text has to be mapped
 *   (see PREETI_KEYS) before it can be drawn in it.
 * - `google`: loaded at runtime from Google Fonts — nothing is added to the repository.
 */

export type FontEncoding = 'unicode' | 'preeti';

export interface DevanagariFont {
  id: string;
  /** Name shown in pickers. */
  name: string;
  /** Short description of the style (handwritten, school print, …). */
  style: string;
  /** CSS font-family the font is registered under once loaded. */
  family: string;
  source: 'local' | 'google' | 'system';
  /** Google Fonts family name (for `google`), or the file path under public/ (for `local`). */
  ref?: string;
  encoding: FontEncoding;
}

export const DEVANAGARI_FONTS: DevanagariFont[] = [
  {
    id: 'dls',
    name: 'Durga Lal Shrestha',
    style: 'Handwritten (project font, fonts/dls-font.otf)',
    family: 'Akshara DLS',
    source: 'local',
    ref: 'fonts/dls-font.otf',
    encoding: 'preeti',
  },
  {
    id: 'kalam',
    name: 'Kalam',
    style: 'Handwritten, felt pen',
    family: 'Kalam',
    source: 'google',
    ref: 'Kalam',
    encoding: 'unicode',
  },
  {
    id: 'amita',
    name: 'Amita',
    style: 'Calligraphic, brush',
    family: 'Amita',
    source: 'google',
    ref: 'Amita',
    encoding: 'unicode',
  },
  {
    id: 'yatra-one',
    name: 'Yatra One',
    style: 'Hand-lettered, rounded',
    family: 'Yatra One',
    source: 'google',
    ref: 'Yatra One',
    encoding: 'unicode',
  },
  {
    id: 'baloo-2',
    name: 'Baloo 2',
    style: 'Friendly rounded print',
    family: 'Baloo 2',
    source: 'google',
    ref: 'Baloo 2',
    encoding: 'unicode',
  },
  {
    id: 'mukta',
    name: 'Mukta',
    style: 'Clean school print',
    family: 'Mukta',
    source: 'google',
    ref: 'Mukta',
    encoding: 'unicode',
  },
  {
    id: 'noto-sans',
    name: 'Noto Sans Devanagari',
    style: 'Standard print (sans)',
    family: 'Noto Sans Devanagari',
    source: 'google',
    ref: 'Noto Sans Devanagari',
    encoding: 'unicode',
  },
  {
    id: 'noto-serif',
    name: 'Noto Serif Devanagari',
    style: 'Book print (serif)',
    family: 'Noto Serif Devanagari',
    source: 'google',
    ref: 'Noto Serif Devanagari',
    encoding: 'unicode',
  },
  {
    id: 'tiro',
    name: 'Tiro Devanagari Hindi',
    style: 'Traditional book print',
    family: 'Tiro Devanagari Hindi',
    source: 'google',
    ref: 'Tiro Devanagari Hindi',
    encoding: 'unicode',
  },
  {
    id: 'system',
    name: 'Device default',
    style: 'Whatever Devanagari font the device has',
    family: 'sans-serif',
    source: 'system',
    encoding: 'unicode',
  },
];

export const DEFAULT_DISPLAY_FONT = 'system';

export function getFont(id: string | null | undefined): DevanagariFont {
  return (
    DEVANAGARI_FONTS.find((f) => f.id === id) ?? DEVANAGARI_FONTS[DEVANAGARI_FONTS.length - 1]!
  );
}

/** Fonts that can render ordinary Unicode text (the Preeti-layout font cannot). */
export const UNICODE_FONTS = DEVANAGARI_FONTS.filter((f) => f.encoding === 'unicode');

/**
 * Preeti keyboard layout: the keys that produce each glyph in a Preeti-layout font
 * (checked against a rendered sheet of the Durga Lal Shrestha font).
 */
export const PREETI_KEYS: Record<string, string> = {
  ka: 's',
  kha: 'v',
  ga: 'u',
  gha: '3',
  nga: 'ª',
  cha: 'r',
  chha: '5',
  ja: 'h',
  jha: '´',
  nya: '`',
  tta: '6',
  ttha: '7',
  dda: '8',
  ddha: '9',
  nna: '0f',
  ta: 't',
  tha: 'y',
  da: 'b',
  dha: 'w',
  na: 'g',
  pa: 'k',
  pha: 'ˆ',
  ba: 'a',
  bha: 'e',
  ma: 'd',
  ya: 'o',
  ra: '/',
  la: 'n',
  wa: 'j',
  sha: 'z',
  ssha: 'if',
  sa: ';',
  ha: 'x',
  ksha: 'If',
  tra: 'q',
  gya: '1',
  a: 'c',
  aa: 'cf',
  i: 'O',
  ii: 'O{',
  u: 'p',
  uu: 'pm',
  ri: 'C',
  e: 'P',
  ai: 'P]',
  o: 'cf]',
  au: 'cf}',
  am: 'c+',
  aha: 'cM',
  'num-0': ')',
  'num-1': '!',
  'num-2': '@',
  'num-3': '#',
  'num-4': '$',
  'num-5': '%',
  'num-6': '^',
  'num-7': '&',
  'num-8': '*',
  'num-9': '(',
};

/** The text to draw for a glyph in `font` (null if the font has no mapping for it). */
export function glyphText(font: DevanagariFont, glyphId: string, character: string): string | null {
  if (font.encoding === 'preeti') return PREETI_KEYS[glyphId] ?? null;
  return character;
}

// ---------------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------------

/** Devanagari code points only, so a display font never restyles the Latin UI text. */
const DEVANAGARI_RANGE =
  'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+25CC, U+A830-A839, U+A8E0-A8FF';
/** Family the chosen *display* font is registered under (Devanagari range only). */
export const DISPLAY_FAMILY = 'Akshara Display Devanagari';

const loaded = new Map<string, Promise<boolean>>();

function withBase(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${base}/${path.replace(/^\//, '')}`;
}

function googleCssUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
}

/** Make `font` available under its `family` (for canvases and previews). Resolves false on failure. */
export function loadFont(font: DevanagariFont): Promise<boolean> {
  if (font.source === 'system' || typeof document === 'undefined') return Promise.resolve(true);
  const cached = loaded.get(font.id);
  if (cached) return cached;
  const promise = (async () => {
    try {
      if (font.source === 'local') {
        const face = new FontFace(font.family, `url(${withBase(font.ref!)})`);
        document.fonts.add(await face.load());
        return true;
      }
      const id = `gf-${font.id}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = googleCssUrl(font.ref!);
        document.head.appendChild(link);
        await new Promise<void>((resolve, reject) => {
          link.onload = () => resolve();
          link.onerror = () => reject(new Error(`could not load ${font.name}`));
        });
      }
      await document.fonts.load(`48px "${font.family}"`, 'क');
      return document.fonts.check(`48px "${font.family}"`, 'क');
    } catch {
      return false;
    }
  })();
  loaded.set(font.id, promise);
  return promise;
}

/**
 * Use `font` for Devanagari text across the app (Latin text keeps the UI font). Registers the
 * font's Devanagari subset under DISPLAY_FAMILY, which the Tailwind `font-sans` stack lists first.
 */
export async function applyDisplayFont(font: DevanagariFont): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') {
    return false;
  }
  for (const face of [...document.fonts]) {
    if (face.family.replace(/"/g, '') === DISPLAY_FAMILY) document.fonts.delete(face);
  }
  if (font.source === 'system' || font.encoding !== 'unicode') return true;
  try {
    const css = await fetch(googleCssUrl(font.ref!)).then((r) => r.text());
    // Google serves one @font-face per subset; take the Devanagari one(s)
    const blocks = css.split('@font-face').filter((b) => /U\+0900|devanagari/i.test(b));
    for (const block of blocks) {
      const url = /url\(([^)]+)\)/.exec(block)?.[1];
      if (!url) continue;
      const weight = /font-weight:\s*([\d ]+);/.exec(block)?.[1]?.trim() ?? '400';
      const face = new FontFace(DISPLAY_FAMILY, `url(${url})`, {
        unicodeRange: DEVANAGARI_RANGE,
        weight,
      });
      document.fonts.add(await face.load());
    }
    return blocks.length > 0;
  } catch {
    return false;
  }
}

const DISPLAY_KEY = 'akshara.display-font';

export function readDisplayFont(): string {
  try {
    return window.localStorage.getItem(DISPLAY_KEY) ?? DEFAULT_DISPLAY_FONT;
  } catch {
    return DEFAULT_DISPLAY_FONT;
  }
}

export function saveDisplayFont(id: string): void {
  try {
    window.localStorage.setItem(DISPLAY_KEY, id);
  } catch {
    /* storage unavailable */
  }
}
