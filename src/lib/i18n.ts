import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

/**
 * Multilingue : fr (défaut et secours), nl, en, ro, pl.
 * Fichiers : src/locales/<langue>/<module>.json — un namespace i18next par module.
 *
 * Le serveur et le premier rendu client sont toujours en français (pas d'écart d'hydratation) ;
 * la langue réelle est appliquée après montage : profil utilisateur > choix mémorisé > navigateur.
 */

export const LANGUES = [
  { code: "fr", label: "Français", flag: "🇫🇷", intl: "fr-BE" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱", intl: "nl-BE" },
  { code: "en", label: "English", flag: "🇬🇧", intl: "en-GB" },
  { code: "ro", label: "Română", flag: "🇷🇴", intl: "ro-RO" },
  { code: "pl", label: "Polski", flag: "🇵🇱", intl: "pl-PL" },
] as const;

export type Langue = (typeof LANGUES)[number]["code"];

/** Langues des documents officiels (devis, contrats, CG, emails) et des clients. */
export const LANGUES_DOCUMENTS = ["fr", "nl", "en"] as const;
export type LangueDocument = (typeof LANGUES_DOCUMENTS)[number];

export const DEFAULT_LANGUE: Langue = "fr";
const STORAGE_KEY = "cf_lang";

export function isLangue(v: unknown): v is Langue {
  return typeof v === "string" && LANGUES.some((l) => l.code === v);
}

const modules = import.meta.glob<Record<string, unknown>>("../locales/*/*.json", {
  eager: true,
  import: "default",
});

function buildResources(): Resource {
  const res: Resource = {};
  for (const [path, content] of Object.entries(modules)) {
    const m = path.match(/locales\/([a-z]{2})\/([\w-]+)\.json$/);
    if (!m) continue;
    const [, lng, ns] = m;
    res[lng] ??= {};
    res[lng][ns] = content;
  }
  return res;
}

const resources = buildResources();

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUE,
    fallbackLng: DEFAULT_LANGUE,
    supportedLngs: LANGUES.map((l) => l.code),
    ns: Object.keys(resources[DEFAULT_LANGUE] ?? {}),
    defaultNS: "common",
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;

/** Langue mémorisée sur cet appareil, sinon première langue supportée du navigateur. */
export function detectLangue(): Langue {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLangue(stored)) return stored;
  } catch {
    // stockage indisponible (navigation privée…)
  }
  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const code = tag?.slice(0, 2).toLowerCase();
      if (isLangue(code)) return code;
    }
  }
  return DEFAULT_LANGUE;
}

/** Applique une langue à l'interface (et la mémorise sur l'appareil si demandé). */
export function applyLangue(l: Langue, remember = false) {
  if (i18n.language !== l) void i18n.changeLanguage(l);
  if (typeof document !== "undefined") document.documentElement.lang = l;
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignoré
    }
  }
}

/** Locale Intl de la langue courante (noms de mois, jours…). */
export function intlLocale(l: string = i18n.language): string {
  return LANGUES.find((x) => x.code === l)?.intl ?? "fr-BE";
}

/** Nom du mois (0 = janvier) avec majuscule, dans la langue courante. */
export function nomMois(month0: number): string {
  const s = new Intl.DateTimeFormat(intlLocale(), { month: "long" }).format(
    new Date(2026, month0, 1),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Noms courts des jours, du lundi au dimanche, dans la langue courante. */
export function joursSemaineCourts(): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale(), { weekday: "short" });
  // 5 janvier 2026 = un lundi
  return Array.from({ length: 7 }, (_, i) => {
    const s = fmt.format(new Date(2026, 0, 5 + i)).replace(".", "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
}
