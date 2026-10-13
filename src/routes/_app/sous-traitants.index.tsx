import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Handshake, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SousTraitantFormModal } from "@/components/SousTraitantFormModal";
import { useAuth } from "@/lib/auth";
import { formatVATDisplay } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { seedSousTraitants } from "@/lib/seed";
import {
  ETAT_CONFORMITE_STYLES,
  METIERS,
  etatConformite,
  type Verification30bis,
} from "@/lib/sous-traitants";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/sous-traitants/")({
  head: () => pageHead("sousTraitants"),
  component: SousTraitantsPage,
});

function useSousTraitants() {
  return useQuery({
    queryKey: ["sous_traitants"],
    queryFn: async () => {
      const [st, vf] = await Promise.all([
        supabase.from("sous_traitants").select("*").order("raison_sociale"),
        supabase.from("verifications_30bis").select("*").order("verifie_le", { ascending: false }),
      ]);
      if (st.error) throw st.error;
      // Dernière vérification par sous-traitant (liste triée par date décroissante).
      const derniere = new Map<string, Verification30bis>();
      for (const v of vf.data ?? []) {
        if (!derniere.has(v.sous_traitant_id)) derniere.set(v.sous_traitant_id, v);
      }
      return (st.data ?? []).map((s) => ({ ...s, derniere: derniere.get(s.id) ?? null }));
    },
  });
}

function SousTraitantsPage() {
  const { t } = useTranslation(["sousTraitants", "common", "statuts"]);
  const { profile } = useAuth();
  const { data, isLoading } = useSousTraitants();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [metier, setMetier] = useState("");
  const [statut, setStatut] = useState("");
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const filtered = useMemo(
    () =>
      (data ?? []).filter((s) => {
        if (metier && !s.metiers.includes(metier)) return false;
        if (statut && s.statut !== statut) return false;
        if (search) {
          const txt =
            `${s.raison_sociale} ${s.ville ?? ""} ${s.numero_tva ?? ""} ${s.numero_bce ?? ""} ${s.contact_nom ?? ""}`.toLowerCase();
          if (!txt.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [data, search, metier, statut],
  );

  const aVerifier = (data ?? []).filter(
    (s) => s.statut === "actif" && etatConformite(s.derniere) !== "a_jour",
  ).length;

  const chargerDemo = async () => {
    if (!profile?.company_id) return;
    setSeeding(true);
    try {
      await seedSousTraitants(profile.company_id);
      toast.success(t("toasts.demoLoaded"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSeeding(false);
      qc.invalidateQueries({ queryKey: ["sous_traitants"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: data?.length ?? 0 })}
            {aVerifier > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {t("toCheck", { count: aVerifier })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t("new")}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={metier}
          onChange={(e) => setMetier(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">{t("allTrades")}</option>
          {METIERS.map((m) => (
            <option key={m} value={m}>
              {t(`statuts:metier.${m}`)}
            </option>
          ))}
        </select>
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="actif">{t("statuts:sousTraitant.actif")}</option>
          <option value="bloque">{t("statuts:sousTraitant.bloque")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Handshake className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
          {(data?.length ?? 0) === 0 && (
            <button
              onClick={chargerDemo}
              disabled={seeding}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <Database className="h-4 w-4" /> {seeding ? "…" : t("loadDemo")}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.name")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.trades")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.vat")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.contact")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.check30bis")}</th>
                <th className="px-4 py-3 text-left font-semibold">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const etat = etatConformite(s.derniere);
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate({ to: "/sous-traitants/$id", params: { id: s.id } })}
                    className="cursor-pointer border-t border-border hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{s.raison_sociale}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          s.forme_juridique &&
                            t(`statuts:formeJuridique.${s.forme_juridique}`, {
                              defaultValue: s.forme_juridique,
                            }),
                          s.ville,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.metiers.length
                        ? s.metiers
                            .map((m) => t(`statuts:metier.${m}`, { defaultValue: m }))
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {s.numero_tva ? formatVATDisplay(s.numero_tva) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.contact_nom || s.email || s.telephone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ETAT_CONFORMITE_STYLES[etat]}`}
                      >
                        {t(`conformity.${etat}`)}
                      </span>
                      {s.derniere && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDateBE(s.derniere.verifie_le)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.statut === "bloque"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {t(`statuts:sousTraitant.${s.statut}`, { defaultValue: s.statut })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <SousTraitantFormModal
          onClose={() => setOpen(false)}
          onSaved={(s) => {
            qc.invalidateQueries({ queryKey: ["sous_traitants"] });
            setOpen(false);
            navigate({ to: "/sous-traitants/$id", params: { id: s.id } });
          }}
        />
      )}
    </div>
  );
}
