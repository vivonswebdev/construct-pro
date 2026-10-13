import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chat } from "./ai.server";

const LANGUES = ["fr", "nl", "en", "ro", "pl"] as const;

const NOMS = {
  fr: "French",
  nl: "Dutch (Belgian usage)",
  en: "English",
  ro: "Romanian",
  pl: "Polish",
} as const;

const inputSchema = z.object({
  texte: z.string().trim().min(1).max(5000),
  langueCible: z.enum(LANGUES),
});

async function sha256(texte: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Traduit un contenu saisi (notes, descriptions, journal de chantier…) vers la langue cible.
 * Cache par société dans la table traductions (clé : SHA-256 du texte + langue cible),
 * RLS appliquée via le client de l'utilisateur. L'IA ne fait que traduire : rien d'autre n'est écrit.
 */
export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const hash = await sha256(data.texte);

    const { data: cache } = await sb
      .from("traductions")
      .select("texte_traduit, langue_source")
      .eq("source_hash", hash)
      .eq("langue_cible", data.langueCible)
      .maybeSingle();
    if (cache) {
      return {
        ok: true as const,
        texte: cache.texte_traduit,
        langueSource: cache.langue_source,
        cache: true,
      };
    }

    const system = `You translate short texts written on Belgian construction sites (notes, site logs, quotes).
Translate the user's text into ${NOMS[data.langueCible]}. Keep construction terminology accurate, keep numbers, units, names and line breaks.
Reply ONLY with JSON: {"source": "<ISO 639-1 code of the original language>", "translation": "<translated text>"}.
If the text is already in the target language, return it unchanged.`;

    const res = await chat({ system, messages: [{ role: "user", content: data.texte }] });
    if (!res.ok) return { ok: false as const, error: res.error };

    let texte = res.content.trim();
    let langueSource: string | null = null;
    try {
      const json = JSON.parse(texte.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
        source?: string;
        translation?: string;
      };
      if (typeof json.translation === "string") texte = json.translation;
      if (typeof json.source === "string") langueSource = json.source.slice(0, 2).toLowerCase();
    } catch {
      // réponse non JSON : on garde le texte brut
    }

    const { data: profil } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profil?.company_id) {
      await sb.from("traductions").upsert(
        {
          company_id: profil.company_id,
          source_hash: hash,
          langue_cible: data.langueCible,
          langue_source: langueSource,
          texte_traduit: texte,
        },
        { onConflict: "company_id,source_hash,langue_cible" },
      );
    }

    return { ok: true as const, texte, langueSource, cache: false };
  });
