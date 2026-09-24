import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  vat_number: z.string().min(12).max(14),
});

/**
 * Proxies the Belgian government withholding-obligation checker.
 * https://www.checkobligationderetenue.be/
 * Returns { eligible, message, raw_html } where eligible=true means
 * NO withholding required (green), false means withholding required (red).
 */
export const checkTva = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const vat = data.vat_number.replace(/[\s.-]/g, "").toUpperCase();
    if (!/^BE\d{10}$/.test(vat)) {
      return { ok: false as const, error: "Format de TVA invalide (attendu BE + 10 chiffres)" };
    }

    try {
      const url = `https://www.checkobligationderetenue.be/result/?vat=${encodeURIComponent(vat)}`;
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
          error: `Site officiel indisponible (HTTP ${res.status}). Utilisez la saisie manuelle.`,
        };
      }

      const html = await res.text();
      const lower = html.toLowerCase();

      // Heuristics: look for indicators in the HTML
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
      // ambiguous -> null, user logs manually

      return {
        ok: true as const,
        eligible,
        message:
          eligible === true
            ? "Aucune retenue obligatoire — sous-traitant en règle."
            : eligible === false
              ? "Retenue obligatoire de 15% — dettes fiscales/sociales détectées."
              : "Résultat ambigu. Vérifiez manuellement sur le site officiel.",
        raw_html: html.slice(0, 5000),
        source_url: url,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      return { ok: false as const, error: `Impossible de contacter le site officiel: ${msg}` };
    }
  });
