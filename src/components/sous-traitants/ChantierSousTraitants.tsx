import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { useTranslation } from "react-i18next";

const nbOuvriers = (j: Json) => (Array.isArray(j) ? j.length : 0);

/** Fiche chantier : contrats de sous-traitance rattachés et journal des prestations. */
export function ChantierSousTraitants({ chantierId }: { chantierId: string }) {
  const { t } = useTranslation(["sousTraitants", "common"]);
  const { data } = useQuery({
    queryKey: ["chantier-sous-traitants", chantierId],
    queryFn: async () => {
      const [ct, ps] = await Promise.all([
        supabase
          .from("sous_traitant_contrats")
          .select("*")
          .eq("chantier_id", chantierId)
          .order("date_debut", { ascending: false }),
        supabase
          .from("sous_traitant_prestations")
          .select("*")
          .eq("chantier_id", chantierId)
          .order("date_prestation", { ascending: false })
          .limit(100),
      ]);
      const contrats = ct.data ?? [];
      const prestations = ps.data ?? [];
      const ids = [
        ...new Set([
          ...contrats.map((c) => c.sous_traitant_id),
          ...prestations.map((p) => contrats.find((c) => c.id === p.contrat_id)?.sous_traitant_id),
        ]),
      ].filter((x): x is string => !!x);
      const st = ids.length
        ? (await supabase.from("sous_traitants").select("id, raison_sociale").in("id", ids)).data
        : [];
      return {
        contrats,
        prestations,
        noms: new Map((st ?? []).map((s) => [s.id, s.raison_sociale])),
      };
    },
  });
  if (!data) return null;
  const stDuContrat = new Map(data.contrats.map((c) => [c.id, c.sous_traitant_id]));
  const totalHeures = data.prestations.reduce((s, p) => s + Number(p.heures ?? 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Handshake className="h-5 w-5 text-primary" /> {t("site.title")}
        </h3>
        {data.prestations.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("site.totalHours", { count: totalHeures })}
          </span>
        )}
      </div>
      {data.contrats.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("site.noContracts")}</p>
      ) : (
        <div className="mb-4 divide-y divide-border rounded-lg border border-border">
          {data.contrats.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <div>
                <Link
                  to="/sous-traitants/$id"
                  params={{ id: c.sous_traitant_id }}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {data.noms.get(c.sous_traitant_id) ?? "—"}
                </Link>
                <p className="text-xs text-muted-foreground">{c.descriptif_prestations}</p>
              </div>
              <span className="text-sm font-semibold">
                {c.type_prix === "forfait"
                  ? formatEURBE(c.montant_forfait_ht)
                  : `${formatEURBE(c.prix_unitaire_ht)} / ${c.unite ?? ""}`}
              </span>
            </div>
          ))}
        </div>
      )}
      {data.prestations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left font-semibold">{t("payments.date")}</th>
                <th className="py-2 text-left font-semibold">{t("site.subcontractor")}</th>
                <th className="py-2 text-left font-semibold">{t("prestations.description")}</th>
                <th className="py-2 text-right font-semibold">{t("prestations.totalHours")}</th>
                <th className="py-2 text-right font-semibold">{t("prestations.workers")}</th>
                <th className="py-2 text-right font-semibold">{t("site.validated")}</th>
              </tr>
            </thead>
            <tbody>
              {data.prestations.map((p) => {
                const st = stDuContrat.get(p.contrat_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2">{formatDateBE(p.date_prestation)}</td>
                    <td className="py-2">{st ? data.noms.get(st) : "—"}</td>
                    <td className="max-w-[260px] truncate py-2 text-muted-foreground">
                      {p.description ?? "—"}
                    </td>
                    <td className="py-2 text-right">{p.heures ?? "—"}</td>
                    <td className="py-2 text-right">{nbOuvriers(p.ouvriers)}</td>
                    <td className="py-2 text-right">
                      {p.valide_le ? (
                        <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
