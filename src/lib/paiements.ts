import { errorMessage } from "@/lib/utils";

/** Codes d'erreur métier levés par les triggers (paiements, contrats, conformité), traduits. */
export const ERREURS_PAIEMENT = [
  "verification_30bis_requise",
  "verification_30bis_autre_sous_traitant",
  "verification_30bis_pas_du_jour",
  "parametres_30bis_absents",
  "retenue_30bis_incorrecte",
  "suppression_paiement_jour_meme",
  "modification_paiement_interdite",
  "paiement_annule_fige",
  "annulation_seulement",
  "motif_annulation_requis",
  "contrat_signe_non_modifiable",
  "validation_reservee_gestionnaire",
  // Conformité (PR D)
  "conformite_30bis_bloquante",
  "action_reservee_gestionnaire",
  "document_fige",
  "document_non_modifiable",
  "motif_invalidation_requis",
  "derogation_duree_invalide",
  "derogation_figee",
  "derogation_revocation_seulement",
  "iban_absent",
] as const;

/** Code d'erreur métier contenu dans une erreur Supabase, ou null. */
export function codeErreurPaiement(err: unknown): (typeof ERREURS_PAIEMENT)[number] | null {
  const m = errorMessage(err, "");
  return ERREURS_PAIEMENT.find((c) => m.includes(c)) ?? null;
}
