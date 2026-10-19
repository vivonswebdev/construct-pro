// Données FICTIVES d'un contrat de sous-traitance (aucune donnée réelle), pour les tests de modèles.
import type { DonneesContrat } from "../../../src/lib/contrats/sous-traitance";
export const fictif: DonneesContrat = {
  entreprise: {
    denomination: "Bâtir Exemple SRL",
    formeJuridique: "SRL",
    bceTva: "BE0123 456 789",
    adresse: "Rue Fictive 1, 1000 Bruxelles",
    pays: "Belgique",
    representant: "A. Exemple",
    qualite: "Gérant",
  },
  sousTraitant: {
    denomination: "Łukasz Budowa Sp. z o.o.",
    formeJuridique: "Sp. z o.o.",
    bceTva: "BE0987 654 321",
    siege: "Ul. Testowa 2, Kraków",
    representant: "",
    qualite: "",
    contact: "test@example.invalid",
    iban: "BE68 5390 0754 7034",
  },
  fiche: {
    reference: "ST-TEST-001",
    maitreOuvrage: "Client Fictif",
    adresseChantier: "Rue du Test 3, 4000 Liège",
    natureTravaux: "Électricité",
    documentsPlans: "Plans v3",
    dates: "01/11/2026 – 15/12/2026",
    prix: "18 500,00 € HTVA (forfait)",
    tva: "Autoliquidation",
    etatsAvancement: "Mensuels",
    delaiPaiementJours: "30",
    penaliteJour: "",
    penalitePlafond: "",
    assurances: "RC",
    securite: "PSS",
    dechets: "Tri",
    reception: "Provisoire",
    contacts: "—",
  },
  garantiesContractuelles: "",
};
export const champs = { representant: "Ł. Kowalski", qualite: "Prezes", contact: "", iban: "" };
export const lieu = "Liège";
export const date = "2026-10-15T10:00:00Z";
