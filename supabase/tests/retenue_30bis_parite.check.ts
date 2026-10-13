// Parité du calcul des retenues 30bis : src/lib/retenue-30bis.ts (navigateur) doit donner
// exactement le résultat du trigger SQL check_paiement_30bis (round(montant × taux, 2)).
// PostgreSQL en mémoire (PGlite), sans Supabase ni réseau.
// Prérequis (une fois) : bun add -d @electric-sql/pglite
// Lancer : bun supabase/tests/retenue_30bis_parite.check.ts

import { PGlite } from "@electric-sql/pglite";
import { calculerRetenues, produitArrondiCent, tauxEnVigueur } from "../../src/lib/retenue-30bis";

const db = new PGlite();
let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

// Montants « pièges » (demi-cents après multiplication) + montants aléatoires.
const montants = [0.01, 0.03, 1, 33.33, 99.99, 1234.5, 1234.55, 10000, 14000, 0.1, 12345.67];
for (let i = 0; i < 3000; i++) montants.push(Math.round(Math.random() * 10_000_000) / 100);
const taux = [0.35, 0.15, 0.0725, 0.333];

let ecarts = 0;
for (const t of taux) {
  const { rows } = await db.query<{ m: string; r: string }>(
    `SELECT m::text AS m, round(m * $1::numeric, 2)::text AS r FROM unnest($2::numeric[]) AS m`,
    [t, montants],
  );
  for (const row of rows) {
    const js = produitArrondiCent(Number(row.m), t);
    if (js !== Number(row.r)) {
      if (ecarts++ < 5) console.log(`  écart : ${row.m} × ${t} → SQL ${row.r}, JS ${js}`);
    }
  }
}
ok(ecarts === 0, `arrondi identique à PostgreSQL (${montants.length * taux.length} cas)`);

const p = { taux_retenue_onss: 0.35, taux_retenue_spf: 0.15 };
const r = calculerRetenues(14000, { sociale: true, fiscale: false }, p);
ok(r.onss === 4900 && r.spf === 0 && r.total === 4900, "dette sociale seule : 35 % ONSS");
const r2 = calculerRetenues(5000, { sociale: true, fiscale: true }, p);
ok(
  r2.onss === 1750 && r2.spf === 750 && r2.total === 2500,
  "dettes sociale + fiscale : 35 % + 15 %",
);
ok(calculerRetenues(5000, { sociale: false, fiscale: false }, p).total === 0, "sans dette : 0");

const lignes = [
  {
    date_debut: "2000-01-01",
    taux_retenue_onss: 0.35,
    taux_retenue_spf: 0.15,
    date_verification: null,
    source: "a",
  },
  {
    date_debut: "2027-01-01",
    taux_retenue_onss: 0.4,
    taux_retenue_spf: 0.2,
    date_verification: null,
    source: "b",
  },
];
ok(tauxEnVigueur(lignes, "2026-10-13")?.source === "a", "taux en vigueur avant changement");
ok(tauxEnVigueur(lignes, "2027-01-01")?.source === "b", "taux en vigueur le jour du changement");
ok(tauxEnVigueur(lignes, "1999-12-31") === null, "aucun taux avant la première date");

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
