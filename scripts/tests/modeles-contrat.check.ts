// Tests du rendu par modèle de contrat : chaque demande est rendue, vérifiée et imprimée dans le
// modèle de son envoi. Données FICTIVES uniquement ; aucune base, aucune signature réelle.
// Lancer : bun scripts/tests/modeles-contrat.check.ts

import { readFileSync } from "node:fs";
import {
  MODELES,
  MODELE_COURANT,
  ModeleInconnuError,
  documentDemande,
  empreinteEnvoi,
  empreinteSignee,
  modeleConnu,
  modeleContrat,
  type RegistreModeles,
} from "../../src/lib/contrats/modeles";
import * as v1 from "../../src/lib/contrats/sous-traitance";
import { champs, date, fictif, lieu } from "./fixtures/contrat-fictif";

let fails = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) fails++;
};
const leve = (f: () => unknown) => {
  try {
    f();
    return null;
  } catch (e) {
    return e;
  }
};

const V1 = v1.MODELE_SOUS_TRAITANCE_V1;
const V2 = "sous_traitance_cadre_v2";
const texte = (b: v1.Bloc[]) => v1.texteContrat(b);

// Valeurs calculées sur main (22b5b5c), AVANT la refonte, avec les mêmes données fictives.
const REF = {
  envoi: "b454987c17240374e3f88ac2822736dc624721677816c40ade23c0cb8968064a",
  signee: "2f31e6e940816a4dbb421290284d33ec5d5673fcc9d3138f6a4b0c3874a9e318",
  vide: "311852d44859fb2a5ea7f22d214f184d9c94c2ca9ef93bf389f3784c2202cc21",
  faitA: "Fait à Liège, le 15/10/2026, par signature électronique.",
};
const instantane = readFileSync(
  new URL("./fixtures/contrat-v1-fictif.txt", import.meta.url),
  "utf8",
);

// 1. Texte v1 inchangé
const texteV1 = texte(modeleContrat(V1).rendre(fictif));
ok(texteV1 === instantane, "texte v1 identique à l'instantané capturé avant la refonte");
ok((await empreinteEnvoi(V1, fictif)) === REF.envoi, "empreinte d'envoi v1 inchangée");
ok(
  (await empreinteSignee(V1, fictif, champs, lieu, date)) === REF.signee,
  "empreinte signée v1 inchangée (corrections, lieu et date compris)",
);
const vide = JSON.parse(JSON.stringify(fictif), (_k, v) => (typeof v === "string" ? "" : v));
ok((await empreinteEnvoi(V1, vide)) === REF.vide, "empreinte v1 sur données vides inchangée");

// 2. Registre = ancien code
ok(
  (await empreinteEnvoi(V1, fictif)) === (await v1.empreinteEnvoi(fictif)) &&
    (await empreinteSignee(V1, fictif, champs, lieu, date)) ===
      (await v1.empreinteSignee(fictif, champs, lieu, date)),
  "registre v1 = anciennes fonctions d'empreinte",
);
ok(
  MODELE_COURANT === V1 && Object.keys(MODELES).join() === V1,
  "aujourd'hui : un seul modèle (v1), modèle courant v1",
);

// Registre de test : une fausse v2 publiée et devenue le modèle courant.
const rendreV2 = (d: v1.DonneesContrat): v1.Bloc[] => [
  { k: "titre", t: "CONTRAT-CADRE V2 (TEXTE FICTIF DE TEST)" },
  { k: "p", t: `Entre ${d.entreprise.denomination} et ${d.sousTraitant.denomination}.` },
  { k: "ligne", label: "Représentant", valeur: d.sousTraitant.representant || "—" },
];
const avecV2: RegistreModeles = {
  ...MODELES,
  [V2]: { code: V2, rendre: rendreV2, faitA: (l, dt) => `V2 — ${l ?? "?"} — ${dt ?? "?"}` },
};

// 3. Lien v1 encore ouvert après l'arrivée de la v2
const demandeV1 = {
  modele: V1,
  donnees: fictif,
  document_hash: REF.envoi, // enregistré à l'envoi
  signataire_champs: null,
  signe_lieu: null,
  signe_le: null,
};
const affiche = documentDemande(demandeV1, avecV2);
ok(texte(affiche.blocs) === instantane, "lien v1 ouvert : le texte affiché est le texte v1");
ok(
  (await empreinteEnvoi(demandeV1.modele, fictif, avecV2)) === demandeV1.document_hash,
  "lien v1 ouvert : empreinte recalculée = empreinte d'envoi (signature possible)",
);
ok(
  (await empreinteEnvoi(V2, fictif, avecV2)) !== demandeV1.document_hash,
  "contre-épreuve : rendre ce lien en v2 aurait cassé la signature",
);

// 4. Contrat v2
const demandeV2 = { ...demandeV1, modele: V2 };
const doc2 = documentDemande(demandeV2, avecV2);
ok(
  texte(doc2.blocs).startsWith("CONTRAT-CADRE V2") && !texte(doc2.blocs).includes(instantane),
  "contrat v2 : le texte affiché est le texte v2",
);

// 5. PDF d'un contrat v1 signé (même source que la page « signé » et le PDF des deux côtés)
const signeV1 = {
  ...demandeV1,
  signataire_champs: champs,
  signe_lieu: lieu,
  signe_le: date,
};
const pdf = documentDemande(signeV1, avecV2);
ok(
  texte(pdf.blocs) === texte(v1.rendreContrat(v1.appliquerChamps(fictif, champs))) &&
    texte(pdf.blocs).includes("Ł. Kowalski"),
  "PDF v1 signé : texte v1 avec les corrections du sous-traitant",
);
ok(pdf.faitA === REF.faitA, "PDF v1 signé : mention « Fait à … » du v1");
ok(
  (await v1.sha256Hex(`${texte(pdf.blocs)}\n${pdf.faitA}`)) === REF.signee,
  "PDF v1 signé : son texte redonne exactement l'empreinte signée de référence",
);

// 6. Modèle inconnu ou absent : erreur explicite, aucun repli
for (const code of ["sous_traitance_cadre_v9", "", null, undefined, "toString", "__proto__"]) {
  const e = leve(() => documentDemande({ ...demandeV1, modele: code as string }));
  ok(
    e instanceof ModeleInconnuError && e.message === "modele_inconnu" && !modeleConnu(code),
    `modèle ${JSON.stringify(code)} : erreur modele_inconnu`,
  );
}
ok(
  leve(() => modeleContrat(V2)) instanceof ModeleInconnuError,
  "la v2 n'existe pas encore dans le registre réel",
);

console.log(fails ? `\n✖ ${fails} échec(s)` : "\n✓ tous les tests passent");
process.exit(fails ? 1 : 0);
