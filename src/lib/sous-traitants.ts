import type { Tables } from "@/integrations/supabase/types";

/**
 * Sous-traitants (phase 9). Codes neutres stockés en base, libellés via le namespace
 * i18n "statuts" : t(`statuts:formeJuridique.${code}`), t(`statuts:metier.${code}`)…
 */

export type SousTraitant = Tables<"sous_traitants">;
export type Verification30bis = Tables<"verifications_30bis">;
export type ContratSousTraitance = Tables<"sous_traitant_contrats">;
export type PaiementSousTraitance = Tables<"achat_paiements">;

// Jamais « SPRL » : forme supprimée par le Code des sociétés et des associations (2019).
export const FORMES_JURIDIQUES = ["srl", "sa", "sc", "scomm", "independant", "autre"] as const;
export type FormeJuridique = (typeof FORMES_JURIDIQUES)[number];

export const SOUS_TRAITANT_STATUTS = ["actif", "bloque"] as const;
export type SousTraitantStatut = (typeof SOUS_TRAITANT_STATUTS)[number];

export const METIERS = [
  "gros_oeuvre",
  "terrassement",
  "charpente",
  "toiture",
  "menuiserie",
  "electricite",
  "plomberie",
  "chauffage",
  "isolation",
  "platrerie",
  "carrelage",
  "peinture",
  "facade",
  "autre",
] as const;
export type Metier = (typeof METIERS)[number];

export const TYPES_PRIX = ["forfait", "horaire", "unitaire"] as const;
export const UNITES = ["heure", "jour", "m2", "m3", "m", "piece", "forfait"] as const;
export const FREQUENCES_PAIEMENT = [
  "a_la_facture",
  "hebdomadaire",
  "mensuelle",
  "avancement",
] as const;
export const MODES_PAIEMENT = ["virement", "especes", "domiciliation", "carte"] as const;

/** Service officiel de vérification des dettes sociales et fiscales (art. 30bis / 402 CIR). */
export function urlVerification30bis(st: Pick<SousTraitant, "numero_tva" | "numero_bce">): string {
  const num = (st.numero_tva ?? st.numero_bce ?? "").replace(/[^0-9]/g, "");
  return num
    ? `https://www.checkobligationderetenue.be/result/?vat=${encodeURIComponent(`BE${num.padStart(10, "0")}`)}`
    : "https://www.checkobligationderetenue.be/";
}

/** Numéro d'entreprise BCE : 10 chiffres, commence par 0 ou 1, contrôle modulo 97. */
export function isValidBCE(input: string): boolean {
  const d = input.replace(/[^0-9]/g, "");
  if (!/^[01]\d{9}$/.test(d)) return false;
  return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8));
}

/** 0123456789 -> 0123.456.789 */
export function formatBCE(input: string | null | undefined): string {
  const d = (input ?? "").replace(/[^0-9]/g, "");
  if (d.length !== 10) return input ?? "";
  return `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`;
}

/** Date du jour à Bruxelles (AAAA-MM-JJ), comme le contrôle SQL check_paiement_30bis. */
export function aujourdhuiBruxelles(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
}

export function dateBruxelles(ts: string): string {
  return aujourdhuiBruxelles(new Date(ts));
}

/**
 * État de conformité 30bis (feu tricolore) d'après la dernière vérification :
 *  - "dette"      : dette sociale ou fiscale constatée → retenue obligatoire sur chaque paiement ;
 *  - "a_jour"     : vérifié aujourd'hui, sans dette → un paiement peut être enregistré aujourd'hui ;
 *  - "a_verifier" : jamais vérifié ou pas aujourd'hui → vérifier avant tout paiement.
 */
export type EtatConformite = "dette" | "a_jour" | "a_verifier";

export function etatConformite(derniere: Verification30bis | null | undefined): EtatConformite {
  if (!derniere) return "a_verifier";
  if (derniere.dette_sociale || derniere.dette_fiscale) return "dette";
  return dateBruxelles(derniere.verifie_le) === aujourdhuiBruxelles() ? "a_jour" : "a_verifier";
}

export const ETAT_CONFORMITE_STYLES: Record<EtatConformite, string> = {
  a_jour: "bg-emerald-100 text-emerald-700",
  a_verifier: "bg-amber-100 text-amber-700",
  dette: "bg-red-100 text-red-700",
};
