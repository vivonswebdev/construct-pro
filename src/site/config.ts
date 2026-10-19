/**
 * Configuration du site vitrine. Sans dépendance (utilisable par les scripts de génération).
 */
import type { LangueSite } from "./types";

/**
 * URL publique du site : sert aux URL canoniques, hreflang, sitemap, données structurées.
 * Domaine prévu : zidarpro.be (à réserver). Variable VITE_SITE_URL pour un autre domaine.
 */
export const SITE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
  "https://zidarpro.be"
).replace(/\/$/, "");

export const LANGUES_SITE: readonly LangueSite[] = ["fr", "nl"];
export const LANGUE_SITE_DEFAUT: LangueSite = "fr";

/**
 * Adresse de réception des demandes de démo (formulaire → e-mail du visiteur).
 * À RENSEIGNER par Youssef avant publication ; tant qu'elle est vide, le formulaire l'indique.
 */
export const ADRESSE_DEMO: string | null = null;

/** Éditeur (mentions légales, données structurées Organization). À compléter par Youssef. */
export const EDITEUR: {
  nom: string;
  adresse: string;
  bce: string;
  email: string;
} | null = null;

/** Date de consultation des sources officielles citées dans les guides. */
export const SOURCES_CONSULTEES_LE = "2026-10-19";

/** Chemin public d'une page : FR à la racine pour l'accueil, sinon /<langue>/<chemin>. */
export function urlPage(langue: LangueSite, chemin: string) {
  if (langue === "fr" && chemin === "") return "/";
  return `/${langue}${chemin ? `/${chemin}` : ""}`;
}
