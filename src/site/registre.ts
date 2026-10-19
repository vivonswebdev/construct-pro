/**
 * Registre des pages du site vitrine : recherche par langue et chemin, pages équivalentes dans
 * l'autre langue, liens internes. Sans dépendance à React (utilisé aussi par les scripts).
 */
import { LANGUES_SITE, urlPage } from "./config";
import { interfaceFr, pagesFr } from "./contenu/fr";
import { interfaceNl, pagesNl } from "./contenu/nl";
import type { Bloc, InterfaceSite, LangueSite, PageSite } from "./types";

export const PAGES: Record<LangueSite, PageSite[]> = { fr: pagesFr, nl: pagesNl };
export const INTERFACE: Record<LangueSite, InterfaceSite> = { fr: interfaceFr, nl: interfaceNl };

export const estLangueSite = (v: unknown): v is LangueSite =>
  typeof v === "string" && (LANGUES_SITE as readonly string[]).includes(v);

export function trouverPage(langue: LangueSite, chemin: string): PageSite | undefined {
  const c = chemin.replace(/^\/+|\/+$/g, "");
  return PAGES[langue].find((p) => p.chemin === c);
}

export function pageParCle(langue: LangueSite, cle: string): PageSite | undefined {
  return PAGES[langue].find((p) => p.cle === cle);
}

/** URL de la page équivalente dans chaque langue (hreflang, sélecteur de langue). */
export function alternatives(cle: string): Partial<Record<LangueSite, string>> {
  const r: Partial<Record<LangueSite, string>> = {};
  for (const l of LANGUES_SITE) {
    const p = pageParCle(l, cle);
    if (p) r[l] = urlPage(l, p.chemin);
  }
  return r;
}

export const urlDe = (langue: LangueSite, cle: string) => {
  const p = pageParCle(langue, cle);
  return p ? urlPage(langue, p.chemin) : urlPage(langue, "");
};

/** Liens `[texte](url)` d'un texte. */
export const LIEN = /\[([^\]]+)\]\(([^)\s]+)\)/g;
export function liensDuTexte(t: string): string[] {
  return [...t.matchAll(LIEN)].map((m) => m[2]);
}

/** Tous les liens (internes et externes) d'une page. */
export function liensDePage(p: PageSite): string[] {
  const out: string[] = [];
  const textes = (b: Bloc): string[] => {
    switch (b.type) {
      case "p":
      case "avertissement":
        return [b.texte];
      case "reponse":
        return [b.texte];
      case "liste":
        return b.items;
      case "etapes":
        return b.items.map((i) => i.texte);
      case "faq":
        return b.items.map((i) => i.r);
      case "cartes":
        b.items.forEach((i) => i.lien && out.push(i.lien));
        return b.items.map((i) => i.texte);
      case "tableau":
        return b.lignes.flat();
      case "modele":
        out.push(b.fichier);
        return [];
      case "sources":
        b.items.forEach((s) => out.push(s.url));
        return [];
      default:
        return [];
    }
  };
  for (const b of p.blocs) for (const t of textes(b)) out.push(...liensDuTexte(t));
  return out;
}

/** Page interne existante pour un chemin public (/, /fr/..., /nl/..., /login). */
export function cheminInterneExiste(url: string): boolean {
  if (url === "/" || url === "/login") return true;
  const m = url.match(/^\/(fr|nl)(?:\/(.*))?$/);
  if (!m) return false;
  const [, l, reste = ""] = m;
  if (l === "fr" && reste === "") return false; // l'accueil FR est « / »
  return !!trouverPage(l as LangueSite, reste);
}
