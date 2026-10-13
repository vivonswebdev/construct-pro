import { errorMessage } from "@/lib/utils";

/** Codes d'erreur levés par les triggers des paiements / contrats (traduits côté interface). */
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
] as const;

/** Code d'erreur métier contenu dans une erreur Supabase, ou null. */
export function codeErreurPaiement(err: unknown): (typeof ERREURS_PAIEMENT)[number] | null {
  const m = errorMessage(err, "");
  return ERREURS_PAIEMENT.find((c) => m.includes(c)) ?? null;
}
