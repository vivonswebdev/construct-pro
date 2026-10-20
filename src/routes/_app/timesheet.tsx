import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileDown,
  FileSpreadsheet,
  History,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatDateBE } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { intlLocale, joursSemaineCourts } from "@/lib/i18n";
import { toCode } from "@/lib/statuts";
import { errorMessage } from "@/lib/utils";
import {
  VUES_TIMESHEET,
  codeErreurPointage,
  formatDuree,
  grille,
  heureCourte,
  isoJour,
  joursEntre,
  periode,
  periodeVoisine,
  semaineIso,
  totalMinutes,
  totauxPar,
  type VueTimesheet,
} from "@/lib/timesheet";
import {
  exporterTimesheetCsv,
  exporterTimesheetPdf,
  type PointageExport,
} from "@/lib/timesheet-export";
import {
  HistoriquePointageModal,
  PointageModal,
  SuppressionPointageModal,
} from "@/components/timesheet/PointageModals";

const recherche = z.object({
  vue: z.enum(VUES_TIMESHEET).catch("semaine"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  travailleur: z.string().uuid().optional().catch(undefined),
  chantier: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/timesheet")({
  head: () => pageHead("timesheet"),
  validateSearch: (s) => recherche.parse(s),
  component: TimesheetPage,
});

type Pointage = Tables<"pointages">;
type Ligne = Pointage & PointageExport;

function TimesheetPage() {
  const { t } = useTranslation(["timesheet", "common"]);
  const { profile, company } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/timesheet" });
  const s = Route.useSearch();
  const vue: VueTimesheet = s.vue;
  const ref = s.date ?? isoJour(new Date());
  const { debut, fin } = periode(vue, ref);
  const companyId = profile?.company_id;
  const gestionnaire = profile?.role === "admin" || profile?.role === "gerant";

  const [modal, setModal] = useState<
    | { type: "saisie"; pointage: Pointage | null }
    | { type: "suppression"; pointage: Ligne }
    | { type: "historique"; pointageId: string }
    | null
  >(null);

  const aller = (patch: Partial<z.infer<typeof recherche>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const ref_ = useQuery({
    queryKey: ["timesheet-ref", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [w, c, moi] = await Promise.all([
        supabase
          .from("personnel")
          .select("id, full_name, fonction, status")
          .eq("company_id", companyId!)
          .order("full_name"),
        supabase.from("chantiers").select("id, name").eq("company_id", companyId!).order("name"),
        supabase.from("personnel").select("id").eq("profile_id", profile!.id).maybeSingle(),
      ]);
      if (w.error) throw w.error;
      if (c.error) throw c.error;
      return { travailleurs: w.data, chantiers: c.data, maFiche: moi.data?.id ?? null };
    },
  });

  const pts = useQuery({
    queryKey: ["pointages", companyId, debut, fin, s.travailleur, s.chantier],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("pointages")
        .select("*")
        .eq("company_id", companyId!)
        .gte("date", debut)
        .lte("date", fin)
        .order("date")
        .order("arrivee");
      if (s.travailleur) q = q.eq("personnel_id", s.travailleur);
      if (s.chantier) q = q.eq("chantier_id", s.chantier);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const noms = useMemo(() => {
    const w = new Map((ref_.data?.travailleurs ?? []).map((p) => [p.id, p]));
    const c = new Map((ref_.data?.chantiers ?? []).map((p) => [p.id, p.name]));
    return { w, c };
  }, [ref_.data]);

  const lignes: Ligne[] = useMemo(
    () =>
      (pts.data ?? []).map((p) => ({
        ...p,
        travailleur: noms.w.get(p.personnel_id)?.full_name ?? "—",
        fonction: noms.w.get(p.personnel_id)?.fonction ?? null,
        chantier: noms.c.get(p.chantier_id) ?? "—",
      })),
    [pts.data, noms],
  );

  const echec = ref_.error ?? pts.error;
  if (echec)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">{t("common:errors.generic")}</p>
        <p className="mt-1">{errorMessage(echec)}</p>
      </div>
    );
  if (!ref_.data || pts.isLoading)
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const { travailleurs, chantiers, maFiche } = ref_.data;
  const actifs = travailleurs.filter((w) => toCode(w.status) !== "inactif");
  const rafraichir = () => {
    setModal(null);
    void qc.invalidateQueries({ queryKey: ["pointages"] });
    void qc.invalidateQueries({ queryKey: ["pointage-historique"] });
  };

  const pointerDepart = async (p: Pointage) => {
    const maintenant = new Date().toTimeString().slice(0, 5);
    const { error } = await supabase
      .from("pointages")
      .update({ depart: maintenant })
      .eq("id", p.id);
    if (error) {
      const code = codeErreurPointage(error);
      return toast.error(code ? t(`errors.${code}`) : errorMessage(error));
    }
    toast.success(t("toasts.clockedOut"));
    rafraichir();
  };

  const libelle = (() => {
    const d = new Date(`${ref}T12:00:00`);
    if (vue === "jour")
      return d.toLocaleDateString(intlLocale(), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    if (vue === "semaine")
      return `${t("nav.week", { n: semaineIso(debut) })} · ${formatDateBE(debut)} – ${formatDateBE(fin)}`;
    const m = d.toLocaleDateString(intlLocale(), { month: "long", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  })();

  const filtres = [
    s.travailleur ? noms.w.get(s.travailleur)?.full_name : null,
    s.chantier ? noms.c.get(s.chantier) : null,
  ].filter((x): x is string => !!x);
  const ctx = { debut, fin, filtres, societe: company?.name };
  const enCours = lignes.filter((p) => p.depart == null).length;
  // Clés = identifiants (deux homonymes ne sont pas fusionnés) ; libellés à l'affichage.
  const parTravailleur = totauxPar(lignes, (p) => p.personnel_id);
  const parChantier = totauxPar(lignes, (p) => p.chantier_id);
  const libelles = (m: Map<string, number>, nom: (id: string) => string) =>
    [...m.entries()].map(([id, min]) => ({ id, nom: nom(id), min }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exporterTimesheetCsv(lignes, ctx)}
            disabled={!lignes.length}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> {t("actions.exportCsv")}
          </button>
          <button
            onClick={() => exporterTimesheetPdf(lignes, ctx)}
            disabled={!lignes.length}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" /> {t("actions.exportPdf")}
          </button>
          {gestionnaire && (
            <button
              onClick={() => setModal({ type: "saisie", pointage: null })}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> {t("actions.new")}
            </button>
          )}
        </div>
      </div>

      {!gestionnaire && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          {maFiche ? t("readOnly") : t("notLinked")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {VUES_TIMESHEET.map((v) => (
            <button
              key={v}
              onClick={() => aller({ vue: v })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${v === vue ? "bg-primary text-white" : "hover:bg-muted"}`}
            >
              {t(`views.${v}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label={t("nav.previous")}
            title={t("nav.previous")}
            onClick={() => aller({ date: periodeVoisine(vue, ref, -1) })}
            className="rounded-md p-2 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => aller({ date: undefined })}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            {t("nav.today")}
          </button>
          <button
            aria-label={t("nav.next")}
            title={t("nav.next")}
            onClick={() => aller({ date: periodeVoisine(vue, ref, 1) })}
            className="rounded-md p-2 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="min-w-[14rem] flex-1 text-sm font-semibold first-letter:uppercase">
          {libelle}
        </p>
        {gestionnaire && (
          <select
            aria-label={t("filters.worker")}
            value={s.travailleur ?? ""}
            onChange={(e) => aller({ travailleur: e.target.value || undefined })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">{t("filters.allWorkers")}</option>
            {travailleurs.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label={t("filters.site")}
          value={s.chantier ?? ""}
          onChange={(e) => aller({ chantier: e.target.value || undefined })}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">{t("filters.allSites")}</option>
          {chantiers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("stats.total")} value={formatDuree(totalMinutes(lignes))} />
        <Stat label={t("stats.workers")} value={String(parTravailleur.size)} />
        <Stat label={t("stats.sites")} value={String(parChantier.size)} />
        <Stat label={t("stats.open")} value={String(enCours)} />
      </div>

      {vue === "semaine" && lignes.length > 0 && (
        <GrilleSemaine lignes={lignes} debut={debut} fin={fin} noms={noms.w} />
      )}

      {vue !== "jour" && lignes.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Totaux
            titre={t("byWorker")}
            lignes={libelles(parTravailleur, (id) => noms.w.get(id)?.full_name ?? "—")}
            total={totalMinutes(lignes)}
          />
          <Totaux
            titre={t("bySite")}
            lignes={libelles(parChantier, (id) => noms.c.get(id) ?? "—")}
            total={totalMinutes(lignes)}
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{t("detail")}</h2>
        {lignes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">{t("columns.date")}</th>
                  <th className="px-4 py-2">{t("columns.worker")}</th>
                  <th className="px-4 py-2">{t("columns.site")}</th>
                  <th className="px-4 py-2">{t("columns.arrival")}</th>
                  <th className="px-4 py-2">{t("columns.departure")}</th>
                  <th className="px-4 py-2">{t("columns.break")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.duration")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((p) => (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateBE(p.date)}</td>
                    <td className="px-4 py-2">
                      <Link
                        to="/personnel/$id"
                        params={{ id: p.personnel_id }}
                        className="font-medium hover:underline"
                      >
                        {p.travailleur}
                      </Link>
                      {p.fonction && <p className="text-xs text-muted-foreground">{p.fonction}</p>}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to="/chantiers/$id"
                        params={{ id: p.chantier_id }}
                        className="hover:underline"
                      >
                        {p.chantier}
                      </Link>
                      {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{heureCourte(p.arrivee)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {p.depart ? (
                        heureCourte(p.depart)
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          <Clock className="h-3 w-3" /> {t("inProgress")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {t("breakMinutes", { count: p.pause_minutes })}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {formatDuree(p.minutes_travaillees)}
                      {p.modifie_le && (
                        <p className="text-[10px] font-normal text-muted-foreground">
                          {t("corrected")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {gestionnaire && p.depart == null && (
                          <Action
                            label={t("actions.clockOut")}
                            onClick={() => void pointerDepart(p)}
                            icon={LogOut}
                          />
                        )}
                        {gestionnaire && (
                          <Action
                            label={t("actions.correct")}
                            onClick={() => setModal({ type: "saisie", pointage: p })}
                            icon={Pencil}
                          />
                        )}
                        <Action
                          label={t("actions.history")}
                          onClick={() => setModal({ type: "historique", pointageId: p.id })}
                          icon={History}
                        />
                        {gestionnaire && (
                          <Action
                            label={t("actions.delete")}
                            onClick={() => setModal({ type: "suppression", pointage: p })}
                            icon={Trash2}
                            danger
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === "saisie" && companyId && (
        <PointageModal
          pointage={modal.pointage}
          travailleurs={(modal.pointage ? travailleurs : actifs).map((w) => ({
            id: w.id,
            nom: w.full_name,
          }))}
          chantiers={chantiers.map((c) => ({ id: c.id, nom: c.name }))}
          companyId={companyId}
          dateParDefaut={vue === "jour" ? ref : isoJour(new Date())}
          onClose={() => setModal(null)}
          onSaved={rafraichir}
        />
      )}
      {modal?.type === "suppression" && (
        <SuppressionPointageModal
          pointage={modal.pointage}
          travailleur={modal.pointage.travailleur}
          chantier={modal.pointage.chantier}
          onClose={() => setModal(null)}
          onDeleted={rafraichir}
        />
      )}
      {modal?.type === "historique" && (
        <HistoriquePointageModal
          pointageId={modal.pointageId}
          chantiers={noms.c}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Action({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: typeof Pencil;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 hover:bg-muted ${danger ? "text-red-600" : "text-muted-foreground"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Totaux({
  titre,
  lignes,
  total,
}: {
  titre: string;
  lignes: { id: string; nom: string; min: number }[];
  total: number;
}) {
  const { t } = useTranslation("timesheet");
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{titre}</h2>
      <table className="w-full text-sm">
        <tbody>
          {[...lignes]
            .sort((a, b) => b.min - a.min)
            .map(({ id, nom, min }) => (
              <tr key={id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{nom}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {formatDuree(min)}
                </td>
              </tr>
            ))}
        </tbody>
        <tfoot className="bg-muted/40">
          <tr>
            <td className="px-4 py-2 font-semibold">{t("columns.total")}</td>
            <td className="px-4 py-2 text-right font-bold tabular-nums">{formatDuree(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GrilleSemaine({
  lignes,
  debut,
  fin,
  noms,
}: {
  lignes: Ligne[];
  debut: string;
  fin: string;
  noms: Map<string, { full_name: string }>;
}) {
  const { t } = useTranslation("timesheet");
  const jours = joursEntre(debut, fin);
  const g = grille(lignes);
  const parJour = totauxPar(lignes, (p) => p.date);
  const ids = [...g.keys()].sort((a, b) =>
    (noms.get(a)?.full_name ?? "").localeCompare(noms.get(b)?.full_name ?? ""),
  );
  const courts = joursSemaineCourts();
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{t("grid")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">{t("columns.worker")}</th>
              {jours.map((j, i) => (
                <th key={j} className="px-2 py-2 text-center">
                  {courts[i]} {j.slice(8, 10)}
                </th>
              ))}
              <th className="px-4 py-2 text-right">{t("columns.total")}</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const l = g.get(id)!;
              const total = [...l.values()].reduce((a, b) => a + b, 0);
              return (
                <tr key={id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{noms.get(id)?.full_name ?? "—"}</td>
                  {jours.map((j) => (
                    <td key={j} className="px-2 py-2 text-center tabular-nums">
                      {l.has(j) ? formatDuree(l.get(j)) : ""}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {formatDuree(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr>
              <td className="px-4 py-2 font-semibold">{t("columns.total")}</td>
              {jours.map((j) => (
                <td key={j} className="px-2 py-2 text-center font-semibold tabular-nums">
                  {parJour.has(j) ? formatDuree(parJour.get(j)) : ""}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-bold tabular-nums">
                {formatDuree(totalMinutes(lignes))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
