import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, Building2, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErreurChargement, GardeAdmin, TableUtilisateurs } from "@/components/admin/AdminCommun";
import { dateHeure, useUtilisateurs } from "@/lib/admin";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { backdropClose } from "@/lib/modal";
import { errorMessage } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * Back-office de l'administrateur de la plateforme (hors menu). Lecture seule ; contrôle en base
 * (est_admin_plateforme, fonctions admin_*, RLS). Aucune donnée métier des clients réels.
 */
export const Route = createFileRoute("/_app/admin/")({
  head: () => pageHead("admin"),
  component: AdminPage,
});

type Onglet = "apercu" | "clients" | "utilisateurs" | "activite";
const ONGLETS: [Onglet, typeof Users][] = [
  ["apercu", BarChart3],
  ["clients", Building2],
  ["utilisateurs", Users],
  ["activite", Activity],
];

function AdminPage() {
  const { t } = useTranslation("admin");
  const [onglet, setOnglet] = useState<Onglet>("apercu");
  return (
    <GardeAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" /> {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ONGLETS.map(([id, Icone]) => (
            <button
              key={id}
              onClick={() => setOnglet(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                onglet === id ? "bg-primary text-white" : "border border-border hover:bg-muted"
              }`}
            >
              <Icone className="h-4 w-4" /> {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        {onglet === "apercu" && <Apercu />}
        {onglet === "clients" && <Clients />}
        {onglet === "utilisateurs" && <Utilisateurs />}
        {onglet === "activite" && <JournalActivite />}
        <p className="text-xs text-muted-foreground">{t("readOnlyNotice")}</p>
      </div>
    </GardeAdmin>
  );
}

// ---------------------------------------------------------------- Vue d'ensemble
const INDICATEURS = [
  "societes",
  "utilisateurs",
  "chantiers",
  "sous_traitants",
  "contrats",
  "prestations",
  "verifications_30bis",
] as const;

function Apercu() {
  const { t } = useTranslation("admin");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-statistiques"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_statistiques");
      if (error) throw error;
      return new Map(data.map((l) => [l.indicateur, l]));
    },
  });
  if (error) return <ErreurChargement erreur={error} />;
  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INDICATEURS.map((k) => {
          const l = data.get(k);
          return (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`stats.${k}`)}
              </p>
              <p className="mt-1 text-2xl font-bold">{Number(l?.reel ?? 0)}</p>
              <p className="text-xs text-muted-foreground">
                {t("stats.real")} · {t("stats.demoCount", { count: Number(l?.demo ?? 0) })}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("stats.hint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Clients
function Clients() {
  const { t } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [bascule, setBascule] = useState<{ id: string; nom: string; demo: boolean } | null>(null);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-comptes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_comptes");
      if (error) throw error;
      return data;
    },
  });
  if (error) return <ErreurChargement erreur={error} />;
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
              <th className="px-3 py-2 text-right font-semibold">{t("accounts.sites")}</th>
              <th className="px-5 py-2 text-right font-semibold">{t("accounts.demo")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-5 py-2">
                  <Link
                    to="/admin/clients/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {c.nom}
                  </Link>
                  {c.demo_seeded && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {t("accounts.seeded")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{formatDateBE(c.cree_le)}</td>
                <td className="px-3 py-2 text-right">{c.nb_utilisateurs}</td>
                <td className="px-3 py-2 text-right">{c.nb_chantiers ?? "—"}</td>
                <td className="px-5 py-2 text-right">
                  <button
                    onClick={() => setBascule({ id: c.id, nom: c.nom, demo: !c.est_demo })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
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
      {bascule && (
        <ConfirmationDemo
          {...bascule}
          onClose={() => setBascule(null)}
          onDone={() => {
            setBascule(null);
            void qc.invalidateQueries({ queryKey: ["admin-comptes"] });
            void qc.invalidateQueries({ queryKey: ["admin-statistiques"] });
          }}
        />
      )}
    </div>
  );
}

/** Validation explicite : saisir le nom de la société avant de changer son statut démo. */
function ConfirmationDemo({
  id,
  nom,
  demo,
  onClose,
  onDone,
}: {
  id: string;
  nom: string;
  demo: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation(["admin", "common"]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const valide = saisie.trim() === nom.trim();
  const confirmer = async () => {
    if (!valide) return;
    setEnCours(true);
    const { error } = await supabase.rpc("admin_definir_demo", { _company_id: id, _demo: demo });
    setEnCours(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(t(demo ? "accounts.marked" : "accounts.unmarked"));
    onDone();
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {t(demo ? "confirm.titleMark" : "confirm.titleUnmark")}
          </h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(demo ? "accounts.confirmMark" : "accounts.confirmUnmark", { company: nom })}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">
            {t("confirm.typeName", { company: nom })}
          </span>
          <input
            autoFocus
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={!valide || enCours}
            onClick={confirmer}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {t("confirm.button")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Utilisateurs
function Utilisateurs() {
  const { data = [], isLoading, error } = useUtilisateurs();
  if (error) return <ErreurChargement erreur={error} />;
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  return <TableUtilisateurs lignes={data} avecSociete />;
}

// ---------------------------------------------------------------- Journal d'activité
const CATEGORIES = ["connexion", "creation_compte", "changement", "erreur"] as const;

function JournalActivite() {
  const { t } = useTranslation("admin");
  const [categorie, setCategorie] = useState<(typeof CATEGORIES)[number] | null>(null);
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-activite", categorie],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_activite", {
        _categorie: categorie,
        _limite: 200,
      });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[null, ...CATEGORIES].map((c) => (
          <button
            key={c ?? "toutes"}
            onClick={() => setCategorie(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              categorie === c ? "bg-primary text-white" : "border border-border hover:bg-muted"
            }`}
          >
            {t(`activity.categories.${c ?? "all"}`)}
          </button>
        ))}
      </div>
      {error ? (
        <ErreurChargement erreur={error} />
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {t("activity.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">{t("activity.when")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("activity.event")}</th>
                <th className="px-3 py-2 text-left font-semibold">{t("users.company")}</th>
                <th className="px-5 py-2 text-left font-semibold">{t("activity.details")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => {
                const d = (a.details ?? null) as Record<string, unknown> | null;
                return (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-5 py-2">{dateHeure(a.quand)}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        {t(`activity.categories.${a.categorie as (typeof CATEGORIES)[number]}`)}
                      </span>
                      <span className="block font-medium">
                        {t(`activity.types.${a.type}`, { defaultValue: a.type })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {a.societe_id ? (
                        <Link
                          to="/admin/clients/$id"
                          params={{ id: a.societe_id }}
                          className="hover:text-primary hover:underline"
                        >
                          {a.societe}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {a.email && (
                        <span className="block text-xs text-muted-foreground">{a.email}</span>
                      )}
                    </td>
                    <td className="max-w-[360px] px-5 py-2 text-xs text-muted-foreground">
                      {d
                        ? Object.entries(d)
                            .map(([k, v]) => `${k} : ${String(v)}`)
                            .join(" · ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("activity.hint")}</p>
    </div>
  );
}
