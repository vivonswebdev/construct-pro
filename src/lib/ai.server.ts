/**
 * Abstraction du fournisseur IA (serveur uniquement).
 *
 * Fournisseur choisi par la variable d'environnement AI_PROVIDER :
 *  - "lovable" (défaut) : gateway Lovable, clé LOVABLE_API_KEY
 *  - "anthropic"        : API Anthropic, clé ANTHROPIC_API_KEY
 * AI_MODEL permet de surcharger le modèle par défaut du fournisseur.
 *
 * Le reste du code n'appelle que chat() : changer de fournisseur ne touche que ce fichier.
 * chatWithTools() (function calling) sera ajouté en phase 4.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResult =
  | { ok: true; content: string }
  | { ok: false; error: string; status?: number };

type Provider = "lovable" | "anthropic";

const DEFAULT_MODELS: Record<Provider, string> = {
  lovable: "google/gemini-2.5-flash",
  anthropic: "claude-sonnet-5",
};

const TIMEOUT_MS = 60_000;

function provider(): Provider {
  return process.env["AI_PROVIDER"] === "anthropic" ? "anthropic" : "lovable";
}

function httpError(status: number): ChatResult {
  if (status === 429)
    return { ok: false, status, error: "Trop de requêtes, réessayez dans un instant." };
  if (status === 402) return { ok: false, status, error: "Crédits IA épuisés." };
  return { ok: false, status, error: `Erreur IA (${status}).` };
}

export async function chat(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<ChatResult> {
  const p = provider();
  const model = process.env["AI_MODEL"] || DEFAULT_MODELS[p];
  try {
    return p === "anthropic" ? await chatAnthropic(model, opts) : await chatLovable(model, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return { ok: false, error: `Assistant injoignable : ${msg}` };
  }
}

async function chatLovable(
  model: string,
  { system, messages, maxTokens }: { system: string; messages: ChatMessage[]; maxTokens?: number },
): Promise<ChatResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "Assistant indisponible (clé IA manquante)." };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return httpError(res.status);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true, content: json.choices?.[0]?.message?.content ?? "" };
}

async function chatAnthropic(
  model: string,
  { system, messages, maxTokens }: { system: string; messages: ChatMessage[]; maxTokens?: number },
): Promise<ChatResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return { ok: false, error: "Assistant indisponible (clé IA manquante)." };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens ?? 2048, system, messages }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return httpError(res.status);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const content = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return { ok: true, content };
}
