import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileLock2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateBE } from "@/lib/format";

/**
 * Tableau de bord (administrateurs et gérants) : copies de carte d'identité arrivées à
 * échéance (sortie + 1 an, ou copie remplacée) et fichiers supprimés encore présents dans le
 * stockage. La suppression se fait depuis la fiche du travailleur, avec un motif.
 */
export function DocumentsRhAlertes() {
  const { t } = useTranslation("rh");
  const { profile } = useAuth();
  const gestionnaire = profile?.role === "admin" || profile?.role === "gerant";
  const { data } = useQuery({
    queryKey: ["documents-rh-a-traiter"],
    enabled: gestionnaire,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("documents_rh_a_traiter");
      if (error) throw error;
      const ids = [...new Set(data.map((d) => d.personnel_id).filter(Boolean))];
      const noms = ids.length
        ? ((await supabase.from("personnel").select("id, full_name").in("id", ids)).data ?? [])
        : [];
      return { lignes: data, noms: new Map(noms.map((n) => [n.id, n.full_name])) };
    },
  });
  if (!gestionnaire || !data?.lignes.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900">
        <FileLock2 className="h-5 w-5" /> {t("alerts.title", { count: data.lignes.length })}
      </h3>
      <p className="mt-1 text-xs text-amber-900/80">{t("alerts.text")}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {data.lignes.slice(0, 6).map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {data.noms.get(l.personnel_id) ?? "—"} ·{" "}
              {l.statut === "supprime"
                ? t("alerts.fileLeft")
                : t("alerts.expired", { date: formatDateBE(l.conserver_jusqu_au) })}
            </span>
            {l.personnel_id && (
              <Link
                to="/personnel/$id"
                params={{ id: l.personnel_id }}
                className="text-xs font-semibold text-amber-900 underline"
              >
                {t("alerts.open")}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
