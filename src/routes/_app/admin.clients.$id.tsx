import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ErreurChargement, GardeAdmin, TableUtilisateurs } from "@/components/admin/AdminCommun";
import { useUtilisateurs } from "@/lib/admin";
import { formatEURBE } from "@/lib/belgian";
import { STYLES_CONFORMITE, type StatutConformite } from "@/lib/conformite";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { toCode } from "@/lib/statuts";
import { useTranslation } from "react-i18next";

/**
 * Fiche d'un client dans le back-office. Société démo : chantiers, sous-traitants (conformité),
 * contrats, prestations, en lecture seule (RLS « admin_plateforme_demo_select »). Client réel :
 * fiche de compte uniquement — aucune donnée métier n'est demandée à la base.
 */
export const Route = createFileRoute("/_app/admin/clients/$id")({
  head: () => pageHead("admin"),
  component: FicheClient,
});

function FicheClient() {
  const { t } = useTranslation(["admin", "common"]);
  const { id } = Route.useParams();
  const { data: comptes, error: erreurComptes } = useQuery({
    queryKey: ["admin-comptes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_comptes");
      if (error) throw error;
      return data;
    },
  });
  const { data: utilisateurs = [] } = useUtilisateurs();
  const compte = comptes?.find((c) => c.id === id);

  return (
    <GardeAdmin>
      <div className="space-y-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t("client.back")}
        </Link>
        {erreurComptes ? (
          <ErreurChargement erreur={erreurComptes} />
        ) : !compte ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{compte.nom}</h1>
                {compte.est_demo && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                    {t("demoBadge")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("client.createdOn", { date: formatDateBE(compte.cree_le) })} ·{" "}
                {t("client.usersCount", { count: compte.nb_utilisateurs })}
              </p>
            </div>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("tabs.utilisateurs")}
              </h2>
              <TableUtilisateurs
                lignes={utilisateurs.filter((u) => u.societe_id === id)}
                avecSociete={false}
              />
            </section>
            {compte.est_demo ? (
              <DonneesDemo companyId={id} />
            ) : (
              <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">{t("client.realNotice")}</p>
              </div>
            )}
          </>
        )}
      </div>
    </GardeAdmin>
  );
}

function DonneesDemo({ companyId }: { companyId: string }) {
  const { t } = useTranslation(["admin", "sousTraitants", "statuts"]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-demo", companyId],
    queryFn: async () => {
      const [ch, st, ct, pr, cf] = await Promise.all([
        supabase
          .from("chantiers")
          .select("id, name, client_name, status, progress")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("sous_traitants")
          .select("id, raison_sociale")
          .eq("company_id", companyId)
          .order("raison_sociale"),
        supabase
          .from("sous_traitant_contrats")
          .select("id, sous_traitant_id, descriptif_prestations, type_prix, montant_forfait_ht")
          .eq("company_id", companyId),
        supabase
          .from("sous_traitant_prestations")
          .select("id, contrat_id, date_prestation, description, heures, valide_le")
          .eq("company_id", companyId)
          .order("date_prestation", { ascending: false })
          .limit(50),
        supabase.rpc("admin_conformite", { _company_id: companyId }),
      ]);
      for (const r of [ch, st, ct, pr, cf]) if (r.error) throw r.error;
      return {
        chantiers: ch.data ?? [],
        sousTraitants: st.data ?? [],
        contrats: ct.data ?? [],
        prestations: pr.data ?? [],
        conformite: new Map((cf.data ?? []).map((l) => [l.sous_traitant_id, l])),
      };
    },
  });
  if (error) return <ErreurChargement erreur={error} />;
  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const nomST = new Map(data.sousTraitants.map((s) => [s.id, s.raison_sociale]));
  const stDuContrat = new Map(data.contrats.map((c) => [c.id, c.sous_traitant_id]));

  const bloc = (titre: string, n: number, contenu: React.ReactNode) => (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
        {titre} <span className="text-muted-foreground">({n})</span>
      </h2>
      {n === 0 ? <p className="px-5 py-3 text-sm text-muted-foreground">—</p> : contenu}
    </section>
  );
  const ligne =
    "flex flex-wrap justify-between gap-2 border-t border-border px-5 py-2 text-sm first:border-t-0";

  return (
    <div className="space-y-4">
      {bloc(
        t("client.sites"),
        data.chantiers.length,
        data.chantiers.map((c) => (
          <div key={c.id} className={ligne}>
            <span>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-muted-foreground">{c.client_name ?? ""}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {t(`statuts:chantier.${toCode(c.status)}`, { defaultValue: c.status })} · {c.progress}{" "}
              %
            </span>
          </div>
        )),
      )}
      {bloc(
        t("client.subcontractors"),
        data.sousTraitants.length,
        data.sousTraitants.map((s) => {
          const l = data.conformite.get(s.id);
          const statut = (l?.attestation_30bis ?? "manquant") as StatutConformite;
          return (
            <div key={s.id} className={ligne}>
              <span className="font-medium">{s.raison_sociale}</span>
              <span className="flex items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${STYLES_CONFORMITE[statut]}`}
                >
                  {t("client.label30bis", {
                    status: t(`sousTraitants:compliance.status.${statut}`),
                  })}
                </span>
                {l?.bloque && (
                  <span className="font-semibold text-red-700">
                    {t("sousTraitants:compliance.blockedShort")}
                  </span>
                )}
              </span>
            </div>
          );
        }),
      )}
      {bloc(
        t("client.contracts"),
        data.contrats.length,
        data.contrats.map((c) => (
          <div key={c.id} className={ligne}>
            <span>
              <span className="font-medium">{nomST.get(c.sous_traitant_id) ?? "—"}</span>{" "}
              <span className="text-muted-foreground">{c.descriptif_prestations}</span>
            </span>
            <span className="text-xs">
              {c.type_prix === "forfait" ? formatEURBE(c.montant_forfait_ht) : c.type_prix}
            </span>
          </div>
        )),
      )}
      {bloc(
        t("client.prestations"),
        data.prestations.length,
        data.prestations.map((p) => (
          <div key={p.id} className={ligne}>
            <span>
              <span className="font-medium">{formatDateBE(p.date_prestation)}</span>{" "}
              <span className="text-muted-foreground">
                {nomST.get(stDuContrat.get(p.contrat_id) ?? "") ?? ""} — {p.description ?? ""}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {p.heures != null ? `${p.heures} h` : ""}
              {p.valide_le ? ` · ${t("client.validated")}` : ""}
            </span>
          </div>
        )),
      )}
    </div>
  );
}
