// Tests des fonctions pures d'export (registre des retenues, synthèse, export comptable, CSV).
// Lancer : bun scripts/tests/exports.check.ts

import { dateCsv, nombreCsv, versCsv } from "../../src/lib/exports/csv";
import {
  construireComptable,
  construireRegistre,
  exigencesManquantes,
  statutVerification,
  syntheseConformite,
  totauxRegistre,
} from "../../src/lib/exports/registre";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};

// --- Données fictives -------------------------------------------------------------------------
const sousTraitants = [
  {
    id: "s1",
    raison_sociale: "Électricité Lambert SRL",
    numero_bce: "0456781215",
    statut: "actif",
  },
  { id: "s2", raison_sociale: "Gros Œuvre Nowak SRL", numero_bce: "0654321913", statut: "actif" },
  { id: "s3", raison_sociale: "Carrelages Costa", numero_bce: null, statut: "actif" },
];
const contrats = [
  { id: "c1", sous_traitant_id: "s1", chantier_id: "ch1" },
  { id: "c2", sous_traitant_id: "s2", chantier_id: "ch2" },
  { id: "c3", sous_traitant_id: "s2", chantier_id: null },
];
const chantiers = [
  { id: "ch1", name: "Villa Dumont", client_name: "Immobilière Dumont SA" },
  { id: "ch2", name: "Extension Leuven", client_name: null },
];
const verifications = [
  { id: "v1", verifie_le: "2026-09-05T08:00:00Z", dette_sociale: false, dette_fiscale: false },
  { id: "v2", verifie_le: "2026-09-20T08:00:00Z", dette_sociale: true, dette_fiscale: false },
  { id: "v3", verifie_le: "2026-10-02T08:00:00Z", dette_sociale: true, dette_fiscale: true },
];
const p = (
  id: string,
  contrat_id: string,
  date: string,
  ht: number,
  onss: number,
  spf: number,
  v: string | null,
  annule: string | null = null,
) => ({
  id,
  contrat_id,
  date_paiement: date,
  montant_ht: ht,
  montant_tva: 0,
  retenue_onss: onss,
  retenue_spf: spf,
  montant_verse: ht - onss - spf,
  reference: id === "p1" ? "FA-2026-0412" : null,
  verification_30bis_id: v,
  annule_le: annule,
});
const paiements = [
  p("p1", "c1", "2026-09-05", 5500, 0, 0, "v1"),
  p("p2", "c2", "2026-09-20", 14000, 3000, 0, "v2"),
  p("p3", "c3", "2026-09-20", 1000, 350, 0, "v2", "2026-09-21T10:00:00Z"),
  p("p4", "c2", "2026-10-02", 1000, 350, 150, "v3"),
];
const src = { paiements, contrats, sousTraitants, chantiers, verifications };

// --- Registre -------------------------------------------------------------------------------
const sept = construireRegistre(src, { du: "2026-09-01", au: "2026-09-30" });
ok(sept.length === 2, "septembre : 2 paiements (annulé exclu par défaut)");
ok(
  sept[0].paiementId === "p1" &&
    sept[0].facture === "FA-2026-0412" &&
    sept[0].bce === "0456781215" &&
    sept[0].chantier === "Villa Dumont" &&
    sept[0].client === "Immobilière Dumont SA" &&
    sept[0].statutVerification === "aucune_dette",
  "ligne complète : BCE, facture, chantier, client final, statut de vérification",
);
ok(
  sept[1].totalRetenu === 3000 &&
    sept[1].verse === 11000 &&
    sept[1].statutVerification === "dette_sociale",
  "retenue plafonnée reprise telle quelle (3 000 €), versé 11 000 €",
);
const avecAnnules = construireRegistre(src, {
  du: "2026-09-01",
  au: "2026-09-30",
  inclureAnnules: true,
});
const t = totauxRegistre(avecAnnules);
ok(
  avecAnnules.length === 3 && avecAnnules.some((l) => l.annule) && t.nombre === 2 && t.ht === 19500,
  "annulés inclus sur demande, mais hors totaux",
);
ok(
  t.onss === 3000 && t.spf === 0 && t.totalRetenu === 3000 && t.verse === 16500,
  "totaux ONSS / SPF / retenu / versé",
);
ok(
  construireRegistre(src, { du: "2026-09-01", au: "2026-10-31", sousTraitantId: "s2" }).length ===
    2,
  "filtre sous-traitant",
);
ok(
  construireRegistre(src, { du: "2026-09-01", au: "2026-10-31", chantierId: "ch1" }).length === 1,
  "filtre chantier",
);
ok(
  construireRegistre(src, { du: "2026-09-01", au: "2026-10-31", statut30bis: "dette" }).length ===
    2 &&
    construireRegistre(src, { du: "2026-09-01", au: "2026-10-31", statut30bis: "sans_dette" })
      .length === 1,
  "filtre statut 30bis (avec / sans dette)",
);
ok(
  construireRegistre(src, { du: "2026-10-02", au: "2026-10-02" })[0]?.statutVerification ===
    "dettes",
  "bornes de période incluses ; dettes sociale et fiscale",
);
ok(statutVerification(null) === "absente", "vérification absente");

// --- Synthèse -----------------------------------------------------------------------------------
const ok4 = {
  attestation_30bis: "valide",
  attestation_tva: "valide",
  iban: "valide",
  contrat: "valide",
  bloque: false,
};
ok(syntheseConformite(ok4) === "conforme", "synthèse : conforme");
ok(
  syntheseConformite({ ...ok4, attestation_30bis: "expire_bientot" }) === "conforme",
  "synthèse : expire bientôt reste conforme",
);
ok(syntheseConformite({ ...ok4, iban: "manquant" }) === "a_verifier", "synthèse : à vérifier");
ok(
  syntheseConformite({ ...ok4, attestation_30bis: "expire", bloque: true }) === "bloque",
  "synthèse : bloqué",
);
ok(
  exigencesManquantes({ ...ok4, iban: "manquant", contrat: "manquant" }).join(",") ===
    "iban,contrat",
  "documents manquants listés",
);

// --- Comptable ----------------------------------------------------------------------------------
const conformite = new Map([
  ["s1", ok4],
  ["s2", { ...ok4, attestation_tva: "manquant" }],
]);
const prestations = [
  { contrat_id: "c1", date_prestation: "2026-09-04", heures: 16 },
  { contrat_id: "c2", date_prestation: "2026-09-10", heures: 24.5 },
  { contrat_id: "c2", date_prestation: "2026-10-10", heures: 8 },
];
const compta = construireComptable(
  { paiements, prestations, contrats, sousTraitants, conformite },
  { du: "2026-09-01", au: "2026-09-30" },
);
const nowak = compta.find((l) => l.sousTraitantId === "s2");
ok(compta.length === 2, "comptable : sous-traitants actifs sur la période uniquement");
ok(
  !!nowak &&
    nowak.prestations === 1 &&
    nowak.heures === 24.5 &&
    nowak.ht === 14000 &&
    nowak.onss === 3000 &&
    nowak.paiements === 1 &&
    nowak.synthese === "a_verifier" &&
    nowak.manquants.join(",") === "attestation_tva",
  "comptable : prestations, heures, HTVA, retenues (annulé exclu), synthèse, manquants",
);
ok(
  construireComptable(
    { paiements, prestations, contrats, sousTraitants, conformite },
    { du: "2026-09-01", au: "2026-09-30" },
    true,
  ).length === 3,
  "comptable : tous les sous-traitants sur demande",
);

// --- CSV ----------------------------------------------------------------------------------------
ok(nombreCsv(1234.5) === "1234,50" && nombreCsv(null) === "", "nombres à virgule");
ok(
  dateCsv("2026-09-05") === "05/09/2026" && dateCsv("2026-09-05T08:00:00Z") === "05/09/2026",
  "dates JJ/MM/AAAA",
);
const csv = versCsv(
  ["A", "B"],
  [
    ["x;y", 'dit "oui"'],
    [null, 3],
  ],
);
ok(
  csv.startsWith("﻿") &&
    csv.includes('"x;y";"dit ""oui"""') &&
    csv.includes('"";"3"') &&
    csv.includes("\r\n"),
  "CSV : BOM, « ; » protégé, guillemets échappés, CRLF",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
