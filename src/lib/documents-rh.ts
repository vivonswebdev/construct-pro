import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "./utils";

/**
 * Scans RH (migration 20261020120000) : cartes d'identité et contrats papier dans le bucket
 * privé `rh`. Aucune lecture directe : chaque consultation passe par ouvrir_document_rh(), qui
 * journalise et délivre un ticket de 60 secondes ; l'URL signée dure aussi 60 secondes.
 * Le contenu n'est jamais lu automatiquement (pas d'OCR, pas d'IA) : finalité dossier RH.
 */
export const BUCKET_RH = "rh";
export const TAILLE_MAX_RH = 5 * 1024 * 1024;
export const ACCEPT_RH = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const FORMATS: Record<string, "jpg" | "png" | "pdf"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export const TYPES_RH = [
  "carte_identite",
  "contrat_travail",
  "contrat_sous_traitance",
  "autre_contractuel",
] as const;
export type TypeRh = (typeof TYPES_RH)[number];

export type CibleRh =
  | { personnel_id: string }
  | { sous_traitant_id: string }
  | { chantier_id: string }
  | { client_id: string };

/** Codes d'erreur levés par la migration (traduits dans rh:errors). */
export const ERREURS_RH = [
  "rh_acces_refuse",
  "rh_consentement_obligatoire",
  "rh_carte_deja_active",
  "rh_remplacement_impossible",
  "rh_format_refuse",
  "rh_fichier_absent",
  "rh_document_introuvable",
  "rh_motif_obligatoire",
  "documents_rh_type_chk",
] as const;
export type ErreurRh = (typeof ERREURS_RH)[number] | "taille" | "format";

export function codeErreurRh(err: unknown): ErreurRh | null {
  const m = errorMessage(err, "");
  return ERREURS_RH.find((c) => m.includes(c)) ?? null;
}

export function controlerFichierRh(f: File): "taille" | "format" | null {
  if (!FORMATS[f.type]) return "format";
  if (f.size > TAILLE_MAX_RH) return "taille";
  return null;
}

/** Préparer (ligne + chemin), téléverser, confirmer ; annule proprement en cas d'échec. */
export async function deposerDocumentRh(p: {
  type: TypeRh;
  titre: string;
  fichier: File;
  cible: CibleRh;
  consentement: boolean;
  noteConsentement: string;
  remplaceId: string | null;
}) {
  const c = p.cible as Partial<Record<string, string>>;
  const { data, error } = await supabase.rpc("preparer_depot_rh", {
    _type: p.type,
    _format: FORMATS[p.fichier.type] ?? "",
    _titre: p.titre || null,
    _personnel_id: c.personnel_id ?? null,
    _sous_traitant_id: c.sous_traitant_id ?? null,
    _chantier_id: c.chantier_id ?? null,
    _client_id: c.client_id ?? null,
    _consentement: p.consentement,
    _consentement_note: p.noteConsentement || null,
    _remplace_id: p.remplaceId,
  });
  if (error) throw error;
  const depot = data?.[0];
  if (!depot) throw new Error("rh_document_introuvable");
  const envoi = await supabase.storage
    .from(BUCKET_RH)
    .upload(depot.fichier, p.fichier, { contentType: p.fichier.type, upsert: false });
  if (envoi.error) {
    await abandonner(depot.id);
    throw envoi.error;
  }
  const conf = await supabase.rpc("confirmer_depot_rh", { _id: depot.id });
  if (conf.error) {
    await abandonner(depot.id);
    throw conf.error;
  }
}

async function abandonner(id: string) {
  const { data } = await supabase.rpc("annuler_depot_rh", { _id: id });
  if (data) await supabase.storage.from(BUCKET_RH).remove([data]);
}

/**
 * Ouvre un document (consultation journalisée). L'onglet est ouvert avant les requêtes,
 * sinon le navigateur le bloque comme fenêtre surgissante.
 */
export async function ouvrirDocumentRh(id: string) {
  const onglet = window.open("", "_blank");
  try {
    const { data: chemin, error } = await supabase.rpc("ouvrir_document_rh", { _id: id });
    if (error) throw error;
    const signe = await supabase.storage.from(BUCKET_RH).createSignedUrl(chemin, 60);
    if (signe.error) throw signe.error;
    if (onglet) {
      onglet.opener = null;
      onglet.location.href = signe.data.signedUrl;
    } else window.location.assign(signe.data.signedUrl);
  } catch (err) {
    onglet?.close();
    throw err;
  }
}

/** Suppression avec motif : la trace reste, le fichier est effacé du stockage. */
export async function supprimerDocumentRh(id: string, motif: string) {
  const { data: chemin, error } = await supabase.rpc("supprimer_document_rh", {
    _id: id,
    _motif: motif,
  });
  if (error) throw error;
  const eff = await supabase.storage.from(BUCKET_RH).remove([chemin]);
  if (eff.error) throw eff.error;
}
