import { gameStorage } from "./storage";

// Shared by the game (src/i18n.ts) and the landing page (src/site/landing.ts), so
// both follow one saved choice. Keep this module free of game code and catalogs.
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];
const STORAGE_KEY = "junk-magnet-language";

export function resolveLanguage(
  saved: string | null,
  browser: string | readonly string[] = "en",
): Language {
  const match = (value: string | null) =>
    LANGUAGES.find(
      ({ code }) =>
        code === value?.toLowerCase().replace("_", "-").split("-")[0],
    )?.code;
  const preferences = typeof browser === "string" ? [browser] : browser;
  return match(saved) ?? preferences.map(match).find(Boolean) ?? "en";
}

/** The saved choice, else the device's first supported language, else English. */
export function preferredLanguage(): Language {
  let saved: string | null = null;
  try {
    saved = gameStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    /* Storage is optional. */
  }
  return resolveLanguage(
    saved,
    typeof navigator === "undefined"
      ? []
      : [...(navigator.languages ?? []), navigator.language],
  );
}

export function saveLanguage(next: Language) {
  try {
    gameStorage()?.setItem(STORAGE_KEY, next);
  } catch {
    /* Private browsing can disable storage. */
  }
}

// Country flags are original SVG artwork, never emoji glyphs. Native names remain
// the accessible language labels; these flags are decorative visual shortcuts.
export function languageFlag(code: Language): string {
  const art: Record<Language, string> = {
    en: '<path fill="#24466c" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="5" d="m0 0 30 20M30 0 0 20"/><path stroke="#c5433a" stroke-width="2" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" stroke-width="7" d="M15 0v20M0 10h30"/><path stroke="#c5433a" stroke-width="4" d="M15 0v20M0 10h30"/>',
    tr: '<path fill="#e30a17" d="M0 0h30v20H0z"/><circle cx="10" cy="10" r="5" fill="#fff"/><circle cx="11.25" cy="10" r="4" fill="#e30a17"/><polygon fill="#fff" points="15.000,10.000 16.727,9.439 16.727,7.622 17.795,9.092 19.523,8.531 18.455,10.000 19.523,11.469 17.795,10.908 16.727,12.378 16.727,10.561"/>',
    de: '<path fill="#262b2f" d="M0 0h30v7H0z"/><path fill="#c74237" d="M0 7h30v6H0z"/><path fill="#edc049" d="M0 13h30v7H0z"/>',
    fr: '<path fill="#265694" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#d44943" d="M20 0h10v20H20z"/>',
    es: '<path fill="#bb3933" d="M0 0h30v20H0z"/><path fill="#efc449" d="M0 5h30v10H0z"/><path fill="#bd4339" stroke="#fff2ce" stroke-width=".6" d="M8 7h5v5q-2.5 3-5 0z"/><path stroke="#efc449" d="M10.5 7v6M8 10h5"/>',
    pt: '<path fill="#257552" d="M0 0h12v20H0z"/><path fill="#c7433d" d="M12 0h18v20H12z"/><circle cx="12" cy="10" r="4.5" fill="none" stroke="#efc449" stroke-width="1.3"/><path fill="#fff" stroke="#c7433d" stroke-width="1" d="M9.5 7h5v5q-2.5 3-5 0z"/><path stroke="#31587d" stroke-width="1.5" d="M12 8v4M10.5 10h3"/>',
  };
  return `<svg class="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">${art[code]}</svg>`;
}
