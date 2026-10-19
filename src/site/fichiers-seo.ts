/**
 * Contenu de robots.txt, sitemap.xml et llms.txt, calculé depuis le registre des pages.
 * Écrits dans public/ par `bun scripts/site/generer-seo.ts` ; contrôlés par scripts/tests/site.check.ts.
 */
import { LANGUES_SITE, SITE_URL, urlPage } from "./config";
import { alternatives, PAGES } from "./registre";
import { NOM_MARQUE } from "../lib/marque";

/** Chemins de l'application (connexion requise) : jamais indexés. */
export const CHEMINS_APPLICATION = [
  "/dashboard",
  "/chantiers",
  "/clients",
  "/facturation",
  "/personnel",
  "/vehicules",
  "/stock",
  "/precompte",
  "/conformite-tva",
  "/assistant",
  "/profil",
  "/sous-traitants",
  "/admin",
  "/bientot-disponible",
  "/signer/",
];

export function robotsTxt() {
  return [
    "# ZidarPro — site vitrine public ; l'application (connexion requise) n'est pas indexée.",
    "User-agent: *",
    "Allow: /",
    ...CHEMINS_APPLICATION.map((c) => `Disallow: ${c}`),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sitemapXml() {
  const urls: string[] = [];
  for (const l of LANGUES_SITE) {
    for (const p of PAGES[l]) {
      if (p.noindex) continue;
      const alt = alternatives(p.cle);
      urls.push(
        [
          "  <url>",
          `    <loc>${echapper(SITE_URL + urlPage(l, p.chemin))}</loc>`,
          `    <lastmod>${p.majLe}</lastmod>`,
          ...Object.entries(alt).map(
            ([al, u]) =>
              `    <xhtml:link rel="alternate" hreflang="${al}-BE" href="${echapper(SITE_URL + u)}"/>`,
          ),
          alt.fr
            ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${echapper(SITE_URL + alt.fr)}"/>`
            : "",
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** llms.txt (format llmstxt.org) : présentation et liens utiles pour les assistants IA. */
export function llmsTxt() {
  const section = (l: "fr" | "nl", titre: string, types: string[]) =>
    [
      `## ${titre}`,
      "",
      ...PAGES[l]
        .filter((p) => !p.noindex && types.includes(p.type))
        .map((p) => `- [${p.h1}](${SITE_URL}${urlPage(l, p.chemin)}): ${p.description}`),
      "",
    ].join("\n");
  return [
    `# ${NOM_MARQUE}`,
    "",
    "> Logiciel belge de gestion pour les PME de la construction : vérification de l'obligation de retenue (30bis) avant chaque paiement, contrats de sous-traitance signés en ligne, journal des prestations, retenues ONSS et SPF Finances calculées et plafonnées, preuves de conformité, devis avec mentions légales (TVA 6 %, autoliquidation). Interface en français, néerlandais, anglais, roumain et polonais.",
    "",
    "Les guides citent leurs sources officielles (ONSS, SPF Finances, sécurité sociale) avec leur date de consultation. Ils ne remplacent pas l'avis d'un comptable. Tarifs sur demande ; démonstration sur demande.",
    "",
    section("fr", "Pages principales (français)", ["accueil", "fonction", "tarifs", "faq"]),
    section("fr", "Guides (français)", ["guide"]),
    section("nl", "Hoofdpagina's (Nederlands)", ["accueil", "fonction", "tarifs", "faq"]),
    section("nl", "Gidsen (Nederlands)", ["guide"]),
  ].join("\n");
}
