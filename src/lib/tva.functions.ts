import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  vat_number: z.string().min(12).max(14),
});

/** Codes d'erreur renvoyés au client (traduits à l'affichage : tva:errors.*). */
export type CheckTvaErreur = "format_invalide" | "site_indisponible" | "site_injoignable";

/**
 * Interroge le service officiel de vérification de l'obligation de retenue.
 * https://www.checkobligationderetenue.be/
 * eligible = true : aucune retenue (vert) ; false : retenue obligatoire (rouge) ;
 * null : résultat ambigu, à confirmer manuellement.
 */
export const checkTva = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const vat = data.vat_number.replace(/[\s.-]/g, "").toUpperCase();
    if (!/^BE\d{10}$/.test(vat)) {
      return { ok: false as const, error: "format_invalide" as CheckTvaErreur };
    }
    const url = `https://www.checkobligationderetenue.be/result/?vat=${encodeURIComponent(vat)}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ConstructFlow/1.0)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr-BE,fr;q=0.9",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return {
          ok: false as const,
          error: "site_indisponible" as CheckTvaErreur,
          status: res.status,
          source_url: url,
        };
      }

      const html = await res.text();

      // Heuristiques sur la page (en français, cf. Accept-Language)
      const hasRed =
        /retenue.*obligatoire/i.test(html) ||
        /dette.*fiscal/i.test(html) ||
        /class="[^"]*(red|danger|rouge|alert-danger)/i.test(html);
      const hasGreen =
        /aucune.*retenue/i.test(html) ||
        /pas.*de.*retenue/i.test(html) ||
        /class="[^"]*(green|success|vert|alert-success)/i.test(html);

      let eligible: boolean | null = null;
      if (hasGreen && !hasRed) eligible = true;
      else if (hasRed && !hasGreen) eligible = false;

      return { ok: true as const, eligible, raw_html: html.slice(0, 5000), source_url: url };
    } catch {
      return { ok: false as const, error: "site_injoignable" as CheckTvaErreur, source_url: url };
    }
  });
