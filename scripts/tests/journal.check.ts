// Tests du journal de chantier (totaux par sous-traitant, lignes du journal).
// Lancer : bun scripts/tests/journal.check.ts

import {
  lignesJournal,
  ouvriersDe,
  totalChantier,
  totauxParSousTraitant,
} from "../../src/lib/exports/journal";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

const noms = new Map([
  ["s1", "Électricité Lambert SRL"],
  ["s2", "Dakwerken Peeters BV"],
]);
const contrats = [
  {
    id: "c1",
    sous_traitant_id: "s1",
    type_prix: "forfait",
    montant_forfait_ht: 18500,
    prix_unitaire_ht: null,
    unite: null,
  },
  {
    id: "c2",
    sous_traitant_id: "s2",
    type_prix: "horaire",
    montant_forfait_ht: null,
    prix_unitaire_ht: 48,
    unite: "heure",
  },
  {
    id: "c3",
    sous_traitant_id: "s1",
    type_prix: "forfait",
    montant_forfait_ht: 1500,
    prix_unitaire_ht: null,
    unite: null,
  },
];
const P = (id: string, c: string, d: string, h: number | null, valide = false) => ({
  id,
  contrat_id: c,
  date_prestation: d,
  description: `Travaux ${id}`,
  heures: h,
  ouvriers: [{ nom: "J. Lambert", fonction: "Électricien", heures: 8 }, { pas: "un ouvrier" }],
  presence_enregistree: true,
  valide_le: valide ? "2026-10-10T08:00:00Z" : null,
});
const prestations = [
  P("p1", "c1", "2026-10-02", 16, true),
  P("p2", "c2", "2026-10-01", 24.5),
  P("p3", "c2", "2026-10-03", 8),
  P("p4", "c3", "2026-10-02", null),
];
const paiements = [
  {
    contrat_id: "c1",
    montant_ht: 5500,
    retenue_onss: 0,
    retenue_spf: 0,
    montant_verse: 5500,
    annule_le: null,
  },
  {
    contrat_id: "c1",
    montant_ht: 1000,
    retenue_onss: 350,
    retenue_spf: 0,
    montant_verse: 650,
    annule_le: "2026-10-05T00:00:00Z",
  },
  {
    contrat_id: "c2",
    montant_ht: 1152,
    retenue_onss: 0,
    retenue_spf: 172.8,
    montant_verse: 979.2,
    annule_le: null,
  },
];

const t = totauxParSousTraitant(contrats, prestations, paiements, noms);
const lambert = t.find((l) => l.sousTraitantId === "s1")!;
const peeters = t.find((l) => l.sousTraitantId === "s2")!;
ok(
  t.length === 2 && t[0].sousTraitant.startsWith("Dakwerken"),
  "une ligne par sous-traitant, triée par nom",
);
ok(
  lambert.prestations === 2 && lambert.prestationsValidees === 1 && lambert.heures === 16,
  "Lambert : 2 prestations (1 validée), 16 h (heures vides ignorées)",
);
ok(
  lambert.forfait === 20000 &&
    lambert.payeHt === 5500 &&
    lambert.resteForfait === 14500 &&
    lambert.valeurHoraire === null,
  "Lambert : forfaits cumulés 20 000 €, payé 5 500 € (annulé exclu), reste 14 500 €",
);
ok(
  peeters.heures === 32.5 &&
    peeters.valeurHoraire === 1560 &&
    peeters.forfait === null &&
    peeters.resteForfait === null,
  "Peeters : 32,5 h × 48 € = 1 560 € (estimation), sans forfait",
);
ok(peeters.retenues === 172.8 && peeters.verse === 979.2, "Peeters : retenues et versé");
const tc = totalChantier(t);
ok(
  tc.prestations === 4 && tc.heures === 48.5 && tc.payeHt === 6652 && tc.verse === 6479.2,
  "totaux du chantier",
);

const j = lignesJournal(contrats, prestations, noms);
ok(
  j.length === 4 && j[0].date === "2026-10-01" && j[0].sousTraitant.startsWith("Dakwerken"),
  "journal trié par date",
);
ok(
  j[1].sousTraitant.startsWith("Électricité") &&
    j[1].ouvriers.length === 1 &&
    j[1].ouvriers[0].nom === "J. Lambert",
  "ouvriers valides uniquement (entrée malformée ignorée)",
);
ok(
  ouvriersDe(null).length === 0 && ouvriersDe("x").length === 0,
  "ouvriers : valeur non tableau ignorée",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
