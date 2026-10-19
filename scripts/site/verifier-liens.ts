// Contrôle des liens EXTERNES du site vitrine (sources officielles…) : statut HTTP de chaque URL.
// Équivalent ciblé de Screaming Frog pour les liens cassés ; à lancer avant chaque publication.
// Lancer : bun scripts/site/verifier-liens.ts

import { liensDePage, PAGES } from "../../src/site/registre";

const urls = new Set<string>();
for (const l of ["fr", "nl"] as const)
  for (const p of PAGES[l]) for (const u of liensDePage(p)) if (/^https?:/.test(u)) urls.add(u);

const UA = "Mozilla/5.0 (compatible; ZidarPro-verificateur-liens/1.0)";
let ko = 0;
for (const u of [...urls].sort()) {
  let statut = "erreur";
  try {
    const r = await fetch(u, { method: "GET", redirect: "follow", headers: { "User-Agent": UA } });
    statut = String(r.status);
    if (r.status >= 400) ko++;
  } catch (e) {
    ko++;
    statut = `erreur (${(e as Error).message})`;
  }
  console.log(`${statut.startsWith("2") || statut.startsWith("3") ? "✓" : "✗"} ${statut} ${u}`);
}
console.log(
  ko ? `\n✖ ${ko} lien(s) en erreur sur ${urls.size}` : `\n✓ ${urls.size} liens externes valides`,
);
process.exit(ko ? 1 : 0);
