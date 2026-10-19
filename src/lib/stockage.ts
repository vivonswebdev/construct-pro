import { supabase } from "@/integrations/supabase/client";

/**
 * Bucket privé « documents » (migration 20261014120000) : chemins `<company_id>/…`,
 * 5 Mo maximum, JPG / PNG / PDF. Les limites sont aussi imposées par Supabase (bucket).
 */
export const BUCKET_DOCUMENTS = "documents";
export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
const TYPES: Record<string, "jpg" | "png" | "pdf"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
export const ACCEPT_CAPTURE = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

export type ErreurFichier = "taille" | "format";

/** Contrôle côté navigateur (le bucket refuse aussi au-delà de 5 Mo ou hors format). */
export function controlerFichier(f: File): ErreurFichier | null {
  if (!TYPES[f.type]) return "format";
  if (f.size > TAILLE_MAX_OCTETS) return "taille";
  return null;
}

/** Dépose un fichier dans `<company_id>/<dossier>/<uuid>.<ext>`. Renvoie le chemin. */
async function deposer(companyId: string, dossier: "30bis" | "conformite", f: File) {
  const chemin = `${companyId}/${dossier}/${crypto.randomUUID()}.${TYPES[f.type]}`;
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTS)
    .upload(chemin, f, { contentType: f.type, upsert: false });
  if (error) throw error;
  return chemin;
}

/** Capture d'une vérification 30bis. */
export const deposerCapture30bis = (companyId: string, f: File) => deposer(companyId, "30bis", f);

/** Document de conformité (attestation 30bis, attestation TVA). */
export const deposerDocumentConformite = (companyId: string, f: File) =>
  deposer(companyId, "conformite", f);

/** Supprime un fichier déposé mais jamais rattaché (permis tant qu'aucune vérification ne le cite). */
export async function supprimerOrphelin(chemin: string) {
  await supabase.storage.from(BUCKET_DOCUMENTS).remove([chemin]);
}

/**
 * Ouvre un fichier privé via une URL signée valable 5 minutes. L'onglet est ouvert avant la
 * requête (sinon le navigateur le bloque comme fenêtre surgissante).
 */
export async function ouvrirDocument(chemin: string) {
  const onglet = window.open("", "_blank");
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTS)
      .createSignedUrl(chemin, 300);
    if (error) throw error;
    if (onglet) {
      onglet.opener = null;
      onglet.location.href = data.signedUrl;
    } else window.location.assign(data.signedUrl);
  } catch (err) {
    onglet?.close();
    throw err;
  }
}
