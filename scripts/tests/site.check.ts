// Contrôles du site vitrine (sans réseau) : pages FR / NL appariées, titres et descriptions,
// liens internes, modèles téléchargeables, fichiers SEO à jour, données structurées.
// Lancer : bun scripts/tests/site.check.ts   (liens externes : bun scripts/site/verifier-liens.ts)

import { existsSync, readFileSync } from "node:fs";
import { llmsTxt, robotsTxt, sitemapXml } from "../../src/site/fichiers-seo";
import { cheminInterneExiste, liensDePage, PAGES } from "../../src/site/registre";
import { donneesStructurees } from "../../src/site/seo";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

const cles = (l: "fr" | "nl") =>
  PAGES[l]
    .map((p) => p.cle)
    .sort()
    .join(",");
ok(cles("fr") === cles("nl"), `mêmes pages en FR et NL (${PAGES.fr.length} pages)`);

for (const l of ["fr", "nl"] as const) {
  const titres = PAGES[l].map((p) => p.titre);
  ok(new Set(titres).size === titres.length, `${l} : titres uniques`);
  ok(new Set(PAGES[l].map((p) => p.chemin)).size === PAGES[l].length, `${l} : chemins uniques`);
  for (const p of PAGES[l]) {
    const pb: string[] = [];
    if (p.titre.length > 60) pb.push(`titre ${p.titre.length} car.`);
    if (p.description.length > 155 || p.description.length < 70)
      pb.push(`description ${p.description.length} car.`);
    if (!p.h1) pb.push("h1 manquant");
    const liens = liensDePage(p);
    for (const u of liens) {
      if (/^https?:/.test(u)) continue;
      if (u.startsWith("/modeles/")) {
        if (!existsSync(`public${u}`)) pb.push(`modèle absent ${u}`);
      } else if (!cheminInterneExiste(u.split("#")[0])) pb.push(`lien interne cassé ${u}`);
    }
    if (p.type === "guide") {
      if (!p.blocs.some((b) => b.type === "reponse")) pb.push("pas de réponse directe");
      if (!p.blocs.some((b) => b.type === "etapes")) pb.push("pas d'étapes");
      if (!p.blocs.some((b) => b.type === "modele")) pb.push("pas de modèle");
      const src = p.blocs.flatMap((b) => (b.type === "sources" ? b.items : []));
      if (!src.length || src.some((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s.consulteLe)))
        pb.push("sources absentes ou non datées");
    }
    try {
      const g = donneesStructurees(p, l);
      JSON.parse(JSON.stringify(g));
      if (g.some((x) => !("@type" in x))) pb.push("JSON-LD sans @type");
    } catch {
      pb.push("JSON-LD invalide");
    }
    ok(pb.length === 0, `${l} ${p.chemin || "(accueil)"} ${pb.length ? `→ ${pb.join(", ")}` : ""}`);
  }
}

for (const [f, attendu] of [
  ["public/robots.txt", robotsTxt()],
  ["public/sitemap.xml", sitemapXml()],
  ["public/llms.txt", llmsTxt()],
] as const) {
  ok(
    existsSync(f) && readFileSync(f, "utf8") === attendu,
    `${f} à jour (sinon : bun scripts/site/generer-seo.ts)`,
  );
}
ok(
  robotsTxt().includes("Disallow: /dashboard") && robotsTxt().includes("Disallow: /signer/"),
  "robots.txt : application exclue",
);
ok(!sitemapXml().includes("mentions-legales"), "sitemap : pages noindex exclues");

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
