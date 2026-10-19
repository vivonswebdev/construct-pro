import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { formatDuree, totalMinutes, totauxPar } from "@/lib/timesheet";

/**
 * Heures pointées par l'équipe interne, regroupées :
 *  - sur une fiche chantier : par travailleur (toutes dates) ;
 *  - sur une fiche travailleur : par chantier, pour la période donnée.
 * Les prestations des sous-traitants sont ailleurs (jamais mélangées).
 */
export function HeuresEquipe(
  props:
    | { chantierId: string; personnelId?: undefined; debut?: undefined; fin?: undefined }
    | { personnelId: string; chantierId?: undefined; debut: string; fin: string },
) {
  const { t } = useTranslation("timesheet");
  const parChantier = !!props.personnelId;
  const { data, isLoading } = useQuery({
    queryKey: ["pointages-resume", props.chantierId, props.personnelId, props.debut, props.fin],
    queryFn: async () => {
      let q = supabase
        .from("pointages")
        .select(
          "personnel_id, chantier_id, date, minutes_travaillees, personnel(full_name), chantiers(name)",
        );
      q = props.personnelId
        ? q.eq("personnel_id", props.personnelId).gte("date", props.debut).lte("date", props.fin)
        : q.eq("chantier_id", props.chantierId!);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const lignes = data ?? [];
  const noms = new Map(
    lignes.map((p) =>
      parChantier
        ? [p.chantier_id, p.chantiers?.name ?? "—"]
        : [p.personnel_id, p.personnel?.full_name ?? "—"],
    ),
  );
  const totaux = [...totauxPar(lignes, (p) => (parChantier ? p.chantier_id : p.personnel_id))]
    .map(([id, min]) => ({ id, nom: noms.get(id) ?? "—", min }))
    .sort((a, b) => b.min - a.min);
  const ns = parChantier ? "worker" : "site";

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            {t(parChantier ? "worker.month" : "site.title")}
          </h2>
          {!parChantier && <p className="text-xs text-muted-foreground">{t("site.subtitle")}</p>}
        </div>
        <Link
          to="/timesheet"
          search={
            parChantier
              ? { vue: "mois", date: props.debut, travailleur: props.personnelId }
              : { vue: "mois", chantier: props.chantierId }
          }
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          {t(`${ns}.open`)}
        </Link>
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : totaux.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${ns}.empty`)}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1">{t(parChantier ? "columns.site" : "columns.worker")}</th>
              <th className="py-1 text-right">{t("columns.hours")}</th>
            </tr>
          </thead>
          <tbody>
            {totaux.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-2">
                  {parChantier ? (
                    <Link to="/chantiers/$id" params={{ id: l.id }} className="hover:underline">
                      {l.nom}
                    </Link>
                  ) : (
                    <Link to="/personnel/$id" params={{ id: l.id }} className="hover:underline">
                      {l.nom}
                    </Link>
                  )}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatDuree(l.min)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className="py-2 font-semibold">{t("columns.total")}</td>
              <td className="py-2 text-right font-bold tabular-nums">
                {formatDuree(totalMinutes(lignes))}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
