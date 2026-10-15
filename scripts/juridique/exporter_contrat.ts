// Exporte le texte du modèle de contrat de sous-traitance (version publiée) en Markdown, tel
// qu'il est présenté au sous-traitant : les champs vides apparaissent en pointillés.
// Lancer : bun scripts/juridique/exporter_contrat.ts [code du modèle, défaut : modèle courant]
//   > docs/juridique/contrat-sous-traitance-v1.md

import { MODELE_COURANT, modeleContrat } from "../../src/lib/contrats/modeles";
import type { DonneesContrat } from "../../src/lib/contrats/sous-traitance";

const modele = modeleContrat(process.argv[2] ?? MODELE_COURANT);

const vide = <T extends Record<string, string>>(o: T) =>
  Object.fromEntries(Object.keys(o).map((k) => [k, ""])) as T;

const d: DonneesContrat = {
  entreprise: vide({
    denomination: "",
    formeJuridique: "",
    bceTva: "",
    adresse: "",
    pays: "",
    representant: "",
    qualite: "",
  }),
  sousTraitant: vide({
    denomination: "",
    formeJuridique: "",
    bceTva: "",
    siege: "",
    representant: "",
    qualite: "",
    contact: "",
    iban: "",
  }),
  fiche: vide({
    reference: "",
    maitreOuvrage: "",
    adresseChantier: "",
    natureTravaux: "",
    documentsPlans: "",
    dates: "",
    prix: "",
    tva: "",
    etatsAvancement: "",
    delaiPaiementJours: "",
    penaliteJour: "",
    penalitePlafond: "",
    assurances: "",
    securite: "",
    dechets: "",
    reception: "",
    contacts: "",
  }),
  garantiesContractuelles: "",
};

const lignes: string[] = [
  `<!-- Modèle ${modele.code} — généré par scripts/juridique/exporter_contrat.ts -->`,
  "",
];
for (const b of modele.rendre(d)) {
  switch (b.k) {
    case "titre":
      lignes.push(`### ${b.t}`, "");
      break;
    case "soustitre":
      lignes.push(`*${b.t}*`, "");
      break;
    case "h":
      lignes.push(`#### ${b.t}`, "");
      break;
    case "p":
      lignes.push("", b.t, "");
      break;
    case "li":
      lignes.push(`- ${b.t}`);
      break;
    case "check":
      lignes.push(`- [ ] ${b.t}`);
      break;
    case "ligne":
      lignes.push(`- **${b.label}** : ${b.valeur}`);
      break;
  }
}
lignes.push("", "#### SIGNATURES", "", modele.faitA(null, null), "");
lignes.push(
  "Pour l'entrepreneur principal : nom, qualité, signature électronique manuscrite (image), date et heure.",
  "",
  "Pour le sous-traitant : nom, qualité, signature électronique manuscrite (image), date et heure.",
  "",
);
console.log(lignes.join("\n").replace(/\n{3,}/g, "\n\n"));
