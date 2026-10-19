/**
 * Balises <head> des pages du site vitrine : titre, description, URL canonique, hreflang,
 * Open Graph, robots et données structurées JSON-LD (Schema.org).
 */
import { EDITEUR, LANGUE_SITE_DEFAUT, SITE_URL, urlPage } from "./config";
import { alternatives, pageParCle } from "./registre";
import { NOM_MARQUE } from "../lib/marque";
import type { LangueSite, PageSite } from "./types";

const abs = (chemin: string) => `${SITE_URL}${chemin === "/" ? "/" : chemin}`;
const sansLiens = (t: string) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

export function donneesStructurees(page: PageSite, langue: LangueSite): object[] {
  const url = abs(urlPage(langue, page.chemin));
  const org = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organisation`,
    name: EDITEUR?.nom ?? NOM_MARQUE,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    ...(EDITEUR ? { email: EDITEUR.email, address: EDITEUR.adresse, vatID: EDITEUR.bce } : {}),
  };
  const graph: object[] = [];

  if (page.type === "accueil") {
    graph.push(org, {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      url: `${SITE_URL}/`,
      name: NOM_MARQUE,
      inLanguage: ["fr-BE", "nl-BE"],
      publisher: { "@id": `${SITE_URL}/#organisation` },
    });
  }
  if (page.type === "accueil" || page.type === "fonction" || page.type === "tarifs") {
    graph.push({
      "@type": "SoftwareApplication",
      name: NOM_MARQUE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: abs(urlPage(langue, "")),
      description: page.description,
      inLanguage: `${langue}-BE`,
      publisher: { "@id": `${SITE_URL}/#organisation` },
    });
  }
  const faq = page.blocs.flatMap((b) => (b.type === "faq" ? b.items : []));
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      inLanguage: `${langue}-BE`,
      mainEntity: faq.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: sansLiens(i.r) },
      })),
    });
  }
  if (page.type === "guide") {
    const etapes = page.blocs.flatMap((b) => (b.type === "etapes" ? b.items : []));
    graph.push({
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      inLanguage: `${langue}-BE`,
      dateModified: page.majLe,
      datePublished: page.majLe,
      mainEntityOfPage: url,
      author: { "@id": `${SITE_URL}/#organisation` },
      publisher: { "@id": `${SITE_URL}/#organisation` },
      image: `${SITE_URL}/icon-512.png`,
    });
    if (etapes.length) {
      graph.push({
        "@type": "HowTo",
        name: page.h1,
        inLanguage: `${langue}-BE`,
        step: etapes.map((e, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: e.titre,
          text: sansLiens(e.texte),
        })),
      });
    }
  }
  if (page.parents?.length) {
    const chaine = [...page.parents.map((c) => pageParCle(langue, c)), page].filter(
      (p): p is PageSite => !!p,
    );
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: chaine.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.type === "accueil" ? NOM_MARQUE : p.h1,
        item: abs(urlPage(langue, p.chemin)),
      })),
    });
  }
  return graph;
}

/** Objet `head` d'une route TanStack (meta, links, scripts). */
export function headPage(page: PageSite, langue: LangueSite) {
  const canonique = abs(urlPage(langue, page.chemin));
  const alt = alternatives(page.cle);
  const links: { rel: string; href: string; hrefLang?: string }[] = [
    { rel: "canonical", href: canonique },
    ...Object.entries(alt).map(([l, u]) => ({
      rel: "alternate",
      hrefLang: `${l}-BE`,
      href: abs(u as string),
    })),
  ];
  const defaut = alt[LANGUE_SITE_DEFAUT];
  if (defaut) links.push({ rel: "alternate", hrefLang: "x-default", href: abs(defaut) });
  return {
    meta: [
      { title: page.titre },
      { name: "description", content: page.description },
      { name: "robots", content: page.noindex ? "noindex, follow" : "index, follow" },
      { property: "og:type", content: page.type === "guide" ? "article" : "website" },
      { property: "og:title", content: page.titre },
      { property: "og:description", content: page.description },
      { property: "og:url", content: canonique },
      { property: "og:image", content: `${SITE_URL}/icon-512.png` },
      { property: "og:locale", content: langue === "nl" ? "nl_BE" : "fr_BE" },
      { property: "og:site_name", content: NOM_MARQUE },
      { name: "twitter:card", content: "summary" },
    ],
    links,
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": donneesStructurees(page, langue),
        }),
      },
    ],
  };
}
