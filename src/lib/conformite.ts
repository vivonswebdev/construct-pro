import type { Tables } from "@/integrations/supabase/types";

/**
 * Conformité des sous-traitants (phase 9, PR D). Les statuts sont calculés en base
 * (public.statut_document_conformite / conformite_sous_traitants) ; ce module reproduit le
 * calcul pour l'affichage d'un document (même règle, testée en parité).
 */

export type DocumentConformite = Tables<"documents_conformite">;
export type Derogation = Tables<"derogations_conformite">;

export const TYPES_DOCUMENTS = ["attestation_30bis", "attestation_tva"] as const;
export type TypeDocument = (typeof TYPES_DOCUMENTS)[number];

export const STATUTS_CONFORMITE = [
  "valide",
  "expire_bientot",
  "expire",
  "manquant",
  "invalide",
] as const;
export type StatutConformite = (typeof STATUTS_CONFORMITE)[number];

export const EXIGENCES = ["attestation_30bis", "attestation_tva", "iban", "contrat"] as const;
export type Exigence = (typeof EXIGENCES)[number];

export const ALERTE_JOURS = 30;
export const DEROGATION_JOURS_MAX = 30;

/** Ajoute n jours à une date AAAA-MM-JJ (calcul en UTC, sans effet d'heure d'été). */
export function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Même règle que public.statut_document_conformite. */
export function statutDocument(
  dateExpiration: string | null,
  invalideLe: string | null,
  jour: string,
): Exclude<StatutConformite, "manquant"> {
  if (invalideLe) return "invalide";
  if (!dateExpiration) return "valide";
  if (dateExpiration < jour) return "expire";
  if (dateExpiration <= ajouterJours(jour, ALERTE_JOURS)) return "expire_bientot";
  return "valide";
}

/** Gravité croissante, pour le « pire statut » d'un sous-traitant. */
const GRAVITE: Record<StatutConformite, number> = {
  valide: 0,
  expire_bientot: 1,
  manquant: 2,
  expire: 3,
  invalide: 4,
};
export const pireStatut = (statuts: StatutConformite[]) =>
  statuts.reduce<StatutConformite>((a, b) => (GRAVITE[b] > GRAVITE[a] ? b : a), "valide");

/** Feu tricolore. */
export const STYLES_CONFORMITE: Record<StatutConformite, string> = {
  valide: "bg-emerald-100 text-emerald-700",
  expire_bientot: "bg-amber-100 text-amber-700",
  manquant: "bg-red-100 text-red-700",
  expire: "bg-red-100 text-red-700",
  invalide: "bg-red-100 text-red-700",
};

export type LigneConformite = {
  sous_traitant_id: string;
  attestation_30bis: string;
  attestation_tva: string;
  iban: string;
  contrat: string;
  derogation_jusqua: string | null;
  bloque: boolean;
};

export const statutsDe = (l: LigneConformite) => EXIGENCES.map((e) => l[e] as StatutConformite);
