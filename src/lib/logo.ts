/**
 * Logo d'entreprise : bucket privé `logos`, un fichier `<company_id>/logo-<uuid>.<ext>` par logo,
 * chemin courant dans companies.logo_chemin. Limites aussi appliquées par Supabase (bucket) :
 * 2 Mo, JPG / PNG / WebP.
 */
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { LogoPdf } from "./logo-pdf";

export const LOGO_TAILLE_MAX = 2 * 1024 * 1024;
export const LOGO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const LOGO_ACCEPT = Object.keys(LOGO_TYPES).join(",");

export type ErreurLogo = "type" | "taille";

const schemaLogo = z.object({
  type: z.enum(Object.keys(LOGO_TYPES) as [keyof typeof LOGO_TYPES], { message: "type" }),
  size: z.number().max(LOGO_TAILLE_MAX, { message: "taille" }),
});

/** Type et taille du fichier ; null si le fichier est accepté. */
export function erreurLogo(f: Pick<File, "type" | "size">): ErreurLogo | null {
  const r = schemaLogo.safeParse({ type: f.type, size: f.size });
  return r.success ? null : (r.error.issues[0].message as ErreurLogo);
}

/** Dépose un nouveau logo, l'enregistre sur la société, puis supprime l'ancien fichier. */
export async function deposerLogo(companyId: string, f: File, ancien: string | null) {
  const ext = LOGO_TYPES[f.type as keyof typeof LOGO_TYPES];
  const chemin = `${companyId}/logo-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage
    .from("logos")
    .upload(chemin, f, { contentType: f.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from("companies")
    .update({ logo_chemin: chemin })
    .eq("id", companyId);
  if (error) {
    await supabase.storage.from("logos").remove([chemin]);
    throw error;
  }
  if (ancien) await supabase.storage.from("logos").remove([ancien]);
  return chemin;
}

/** Retire le logo de la société (logo par défaut ensuite) et supprime le fichier. */
export async function supprimerLogo(companyId: string, chemin: string) {
  const { error } = await supabase
    .from("companies")
    .update({ logo_chemin: null })
    .eq("id", companyId);
  if (error) throw error;
  await supabase.storage.from("logos").remove([chemin]);
}

/** URL temporaire (bucket privé). */
export async function urlLogo(chemin: string) {
  const { data, error } = await supabase.storage.from("logos").createSignedUrl(chemin, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Image prête pour jsPDF (PNG ; jsPDF ne lit pas le WebP), réduite à 600 px de côté au plus.
 */
export async function chargerLogoPdf(url: string): Promise<LogoPdf | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const img = await createImageBitmap(blob);
    const k = Math.min(1, 600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL("image/png"), largeur: c.width, hauteur: c.height };
  } catch {
    return null;
  }
}
