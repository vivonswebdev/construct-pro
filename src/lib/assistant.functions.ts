import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

function eur(n: number) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-BE")} €`;
}

/**
 * Assistant IA métier : répond aux questions du gérant à partir des
 * données réelles de sa société (RLS appliquée via le token utilisateur).
 */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "Assistant indisponible (clé IA manquante)." };
    }

    const sb = context.supabase;
    const [chRes, prRes, veRes, faRes, maRes] = await Promise.all([
      sb.from("chantiers").select("*").limit(100),
      sb.from("personnel").select("*").limit(100),
      sb.from("vehicules" as any).select("*").limit(100),
      sb.from("factures" as any).select("*").eq("type", "devis").limit(200),
      sb.from("materiaux" as any).select("*").limit(200),
    ]);

    const chantiers = (chRes.data ?? []) as any[];
    const personnel = (prRes.data ?? []) as any[];
    const vehicules = (veRes.data ?? []) as any[];
    const factures = (faRes.data ?? []) as any[];
    const materiaux = (maRes.data ?? []) as any[];

    const devis = factures.filter((f) => f.type === "devis");
    const devisAttente = devis.filter((f) => f.status === "Envoyé" || f.status === "Brouillon");
    const devisAcc = devis.filter((f) => f.status === "Accepté").length;
    const devisDec = devis.filter((f) => ["Accepté", "Refusé", "Expiré"].includes(f.status)).length;
    const lowStock = materiaux.filter(
      (m) => Number(m.stock_quantity) <= Number(m.min_stock) && Number(m.min_stock) > 0,
    );

    const ctx = [
      `SOCIÉTÉ — ${chantiers.length} chantiers, ${personnel.length} employés, ${vehicules.length} véhicules.`,
      `DEVIS — ${devisAttente.length} en attente (${eur(devisAttente.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0))}), taux d'acceptation ${devisDec ? Math.round((devisAcc / devisDec) * 100) : 0} %. La facturation n'est pas encore gérée dans l'application (module Peppol à venir).`,
      "",
      "CHANTIERS:",
      ...chantiers.map(
        (c) =>
          `- ${c.name} | client: ${c.client_name ?? "?"} | statut: ${c.status} | avancement: ${c.progress ?? 0}% | budget: ${eur(c.budget ?? 0)} | dépenses: ${eur(c.spent ?? 0)} | fin prévue: ${c.end_date ?? "?"}`,
      ),
      "",
      "PERSONNEL:",
      ...personnel.map(
        (p) =>
          `- ${p.full_name} | ${p.role ?? "?"} | taux horaire: ${eur(p.hourly_rate ?? 0)} | contrat: ${p.contract_type ?? "?"} | statut: ${p.status ?? "?"}`,
      ),
      "",
      "VÉHICULES:",
      ...vehicules.map(
        (v) =>
          `- ${v.name ?? v.brand} ${v.model ?? ""} (${v.plate ?? "?"}) | CT: ${v.ct_expiry ?? "?"} | assurance: ${v.insurance_expiry ?? "?"} | statut: ${v.status ?? "?"}`,
      ),
      "",
      `STOCK BAS (${lowStock.length}): ${lowStock.map((m) => `${m.name} (${m.stock_quantity} ${m.unit})`).join(", ") || "aucun"}`,
    ].join("\n");

    const system = `Tu es l'assistant IA de ConstructFlow, un logiciel de gestion pour entreprises de construction belges.
Tu réponds TOUJOURS en français, de façon concise et opérationnelle (listes à puces, chiffres précis).
Formats belges : montants "245 000 €", dates JJ/MM/AAAA.
Tu connais la réglementation belge du secteur : TVA 21/12/6/0 %, autoliquidation entre assujettis, obligation de retenue 15 % (checkobligationderetenue.be), précompte professionnel, ONSS trimestriel, commission paritaire 124.
Base tes réponses UNIQUEMENT sur les données ci-dessous. Si une information manque, dis-le clairement.
Rappelle que les calculs fiscaux sont indicatifs et à valider avec le comptable.

=== DONNÉES DE LA SOCIÉTÉ ===
${ctx}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: system }, ...data.messages],
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Trop de requêtes, réessayez dans un instant." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "Crédits IA épuisés. Rechargez votre espace Lovable AI." };
      }
      if (!res.ok) {
        return { ok: false as const, error: `Erreur IA (${res.status}).` };
      }

      const json = (await res.json()) as any;
      const content = json?.choices?.[0]?.message?.content ?? "";
      return { ok: true as const, content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      return { ok: false as const, error: `Assistant injoignable : ${msg}` };
    }
  });
