import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPlateforme } from "@/hooks/useAdminPlateforme";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { toCode } from "@/lib/statuts";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * Administration de la plateforme (hors menu). Réservée à l'administrateur de la plateforme :
 * contrôle en base (est_admin_plateforme, admin_comptes, policies de lecture des sociétés démo).
 */
export const Route = createFileRoute("/_app/admin")({
  head: () => pageHead("admin"),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useTranslation(["admin", "common"]);
  const { data: admin, isLoading } = useAdminPlateforme();
  const [onglet, setOnglet] = useState<"comptes" | "demo">("comptes");

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (!admin)
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">{t("denied")}</p>
      </div>
    );

  const tab = (id: typeof onglet, label: string, Icone: typeof Users) => (
    <button
      onClick={() => setOnglet(id)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
        onglet === id ? "bg-primary text-white" : "border border-border hover:bg-muted"
      }`}
    >
      <Icone className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" /> {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="flex gap-2">
        {tab("comptes", t("tabs.accounts"), Users)}
        {tab("demo", t("tabs.demo"), FlaskConical)}
      </div>
      {onglet === "comptes" ? <Comptes /> : <Demonstration />}
    </div>
  );
}

function Comptes() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-comptes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_comptes");
      if (error) throw error;
      return data;
    },
  });

  const basculer = async (id: string, nom: string, demo: boolean) => {
    if (!confirm(t(demo ? "accounts.confirmMark" : "accounts.confirmUnmark", { company: nom })))
      return;
    setEnCours(id);
    const { error } = await supabase.rpc("admin_definir_demo", { _company_id: id, _demo: demo });
    setEnCours(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(t(demo ? "accounts.marked" : "accounts.unmarked"));
    void qc.invalidateQueries({ queryKey: ["admin-comptes"] });
    void qc.invalidateQueries({ queryKey: ["admin-demo"] });
  };

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  return (
    <div className="rounded-xl border border-border bg-card">
      <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
        {t("accounts.hint")}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">{t("accounts.company")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("accounts.created")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("accounts.users")}</th>
              <th className="px-3 py-2 text-left font-semibold">{t("accounts.emails")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("accounts.sites")}</th>
              <th className="px-5 py-2 text-right font-semibold">{t("accounts.demo")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-5 py-2">
                  <span className="font-medium">{c.nom}</span>
                  {c.demo_seeded && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {t("accounts.seeded")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{formatDateBE(c.cree_le)}</td>
                <td className="px-3 py-2 text-right">{c.nb_utilisateurs}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {c.emails?.join(", ") ?? t("accounts.hidden")}
                </td>
                <td className="px-3 py-2 text-right">{c.nb_chantiers ?? "—"}</td>
                <td className="px-5 py-2 text-right">
                  <button
                    disabled={enCours === c.id}
                    onClick={() => basculer(c.id, c.nom, !c.est_demo)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                      c.est_demo
                        ? "bg-violet-100 text-violet-800 hover:bg-violet-200"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {c.est_demo ? t("accounts.isDemo") : t("accounts.markDemo")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Demonstration() {
  const { t } = useTranslation(["admin", "common", "statuts"]);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-demo"],
    queryFn: async () => {
      // RLS : l'administrateur ne lit que les sociétés « démo » (et la sienne, filtrée ici).
      const soc = await supabase.from("companies").select("id, name").eq("est_demo", true);
      if (soc.error) throw soc.error;
      const ids = soc.data.map((s) => s.id);
      const ch = ids.length
        ? await supabase
            .from("chantiers")
            .select("id, company_id, name, client_name, status, progress")
            .in("company_id", ids)
            .order("name")
        : { data: [], error: null };
      if (ch.error) throw ch.error;
      return { societes: soc.data, chantiers: ch.data ?? [] };
    },
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (data.societes.length === 0)
    return (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        {t("demo.empty")}
      </p>
    );
  return (
    <div className="space-y-4">
      {data.societes.map((s) => {
        const liste = data.chantiers.filter((c) => c.company_id === s.id);
        return (
          <div key={s.id} className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="font-semibold">{s.name}</h3>
              <span className="text-xs text-muted-foreground">
                {t("demo.sites", { count: liste.length })}
              </span>
            </div>
            {liste.length === 0 ? (
              <p className="px-5 py-3 text-sm text-muted-foreground">{t("demo.noSites")}</p>
            ) : (
              liste.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-2 text-sm first:border-t-0"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.client_name ?? "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t(`statuts:chantier.${toCode(c.status)}`, { defaultValue: c.status })} ·{" "}
                    {c.progress} %
                  </span>
                </div>
              ))
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("demo.readOnly")}</p>
    </div>
  );
}
