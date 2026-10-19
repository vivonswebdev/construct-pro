// Écrit public/robots.txt, public/sitemap.xml et public/llms.txt depuis le registre des pages.
// À relancer après toute modification du contenu du site (scripts/tests/site.check.ts le contrôle).
// Domaine : VITE_SITE_URL, sinon https://zidarpro.be.
// Lancer : bun scripts/site/generer-seo.ts

import { writeFileSync } from "node:fs";
import { llmsTxt, robotsTxt, sitemapXml } from "../../src/site/fichiers-seo";

for (const [chemin, contenu] of [
  ["public/robots.txt", robotsTxt()],
  ["public/sitemap.xml", sitemapXml()],
  ["public/llms.txt", llmsTxt()],
] as const) {
  writeFileSync(chemin, contenu);
  console.log(`✓ ${chemin}`);
}
