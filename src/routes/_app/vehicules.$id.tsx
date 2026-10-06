import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Truck, Car, RefreshCw, Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE, daysUntil } from "@/lib/format";
import { formatEURBE } from "@/lib/belgian";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/lib/i18n";
import { toCode } from "@/lib/statuts";
import { toast } from "sonner";
import { backdropClose } from "@/lib/modal";

export const Route = createFileRoute("/_app/vehicules/$id")({
  component: VehiculeDetail,
});

function VehiculeDetail() {
  const { t } = useTranslation(["vehicules", "statuts", "common"]);
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [affModal, setAffModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicule", id],
    queryFn: async () => {
      const [vRes, aRes, cRes] = await Promise.all([
        supabase.from("vehicules").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("vehicule_affectations")
          .select("*")
          .eq("vehicule_id", id)
          .order("start_date", { ascending: false }),
        supabase
          .from("chantiers")
          .select("id, name")
          .eq("company_id", companyId ?? "")
          .order("name"),
      ]);
      const chMap = new Map((cRes.data ?? []).map((c) => [c.id, c]));
      const affs = (aRes.data ?? []).map((a) => ({ ...a, chantier: chMap.get(a.chantier_id) }));
      return { v: vRes.data, affectations: affs, chantiers: cRes.data ?? [] };
    },
    enabled: !!companyId,
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (!data.v) return <div>{t("notFound")}</div>;

  const v = data.v;
  const current = data.affectations.find((a) => !a.end_date);

  const renew = async (field: "ct_date" | "insurance_date" | "maintenance_date") => {
    const now = new Date();
    const newDate =
      field === "maintenance_date"
        ? now
        : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const patch: TablesUpdate<"vehicules"> = {};
    patch[field] = newDate.toISOString().slice(0, 10);
    const { error } = await supabase.from("vehicules").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.updated"));
    qc.invalidateQueries({ queryKey: ["vehicule", id] });
    qc.invalidateQueries({ queryKey: ["vehicules"] });
  };

  const closeAffectation = async (aff: Tables<"vehicule_affectations">) => {
    const endKmStr = prompt(t("detail.endKmPrompt", { km: v.current_km }), String(v.current_km));
    if (!endKmStr) return;
    const endKm = Number(endKmStr);
    if (isNaN(endKm)) return toast.error(t("validation.invalidKm"));
    const { error } = await supabase
      .from("vehicule_affectations")
      .update({
        end_date: new Date().toISOString().slice(0, 10),
        end_km: endKm,
      })
      .eq("id", aff.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("vehicules")
      .update({ current_km: endKm, status: "disponible" })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["vehicule", id] });
    qc.invalidateQueries({ queryKey: ["vehicules"] });
    toast.success(t("toasts.assignmentClosed"));
  };

  const deleteVeh = async () => {
    if (!confirm(t("detail.confirmDelete"))) return;
    await supabase.from("vehicule_affectations").delete().eq("vehicule_id", id);
    const { error } = await supabase.from("vehicules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.deleted"));
    window.location.href = "/vehicules";
  };

  const Icon = toCode(v.type) === "voiture" ? Car : Truck;

  return (
    <div className="space-y-6">
      <Link
        to="/vehicules"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {v.brand} {v.model}
                </h1>
                <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-bold tracking-wider">
                  {v.plate}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`statuts:vehiculeType.${toCode(v.type)}`, { defaultValue: v.type })} ·{" "}
                {v.year ?? "—"} ·{" "}
                {t("common:units.km", { value: v.current_km.toLocaleString(intlLocale()) })} ·{" "}
                {t("perKm", { amount: formatEURBE(v.cost_per_km) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {current ? (
              <span className="rounded-full bg-info/10 px-3 py-1 text-xs font-semibold text-info">
                🏗 {current.chantier?.name}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {t("available")}
              </span>
            )}
            <button
              onClick={deleteVeh}
              className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Alertes / entretiens */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("detail.alertsTitle")}</h2>
        <div className="space-y-2">
          <AlertRow label={t("detail.ct")} date={v.ct_date} onRenew={() => renew("ct_date")} />
          <AlertRow
            label={t("detail.insurance")}
            date={v.insurance_date}
            onRenew={() => renew("insurance_date")}
          />
          <AlertRow
            label={t("detail.lastMaintenance")}
            date={v.maintenance_date}
            reverse
            onRenew={() => renew("maintenance_date")}
          />
        </div>
      </div>

      {/* Affectations */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("detail.historyTitle")}</h2>
          {!current && (
            <button
              onClick={() => setAffModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" /> {t("detail.assignToSite")}
            </button>
          )}
        </div>
        {data.affectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noAssignment")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">{t("detail.columns.site")}</th>
                  <th className="pb-2">{t("detail.columns.period")}</th>
                  <th className="pb-2">{t("detail.columns.km")}</th>
                  <th className="pb-2">{t("detail.columns.cost")}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.affectations.map((a) => {
                  const km = a.end_km && a.start_km ? a.end_km - a.start_km : null;
                  const cost = km ? km * Number(v.cost_per_km) : null;
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 font-medium">
                        <Link
                          to="/chantiers/$id"
                          params={{ id: a.chantier_id }}
                          className="hover:text-primary"
                        >
                          {a.chantier?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDateBE(a.start_date)} →{" "}
                        {a.end_date ? (
                          formatDateBE(a.end_date)
                        ) : (
                          <span className="text-info">{t("detail.inProgress")}</span>
                        )}
                      </td>
                      <td className="py-2">
                        {km !== null
                          ? t("common:units.km", { value: km.toLocaleString(intlLocale()) })
                          : "—"}
                      </td>
                      <td className="py-2 font-semibold">
                        {cost !== null ? formatEUR(cost) : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {!a.end_date && (
                          <button
                            onClick={() => closeAffectation(a)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {t("detail.close")}
                          </button>
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

      {affModal && (
        <AffectationModal
          vehiculeId={id}
          currentKm={v.current_km}
          chantiers={data.chantiers}
          onClose={() => setAffModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["vehicule", id] });
            qc.invalidateQueries({ queryKey: ["vehicules"] });
            setAffModal(false);
          }}
        />
      )}
    </div>
  );
}

function AlertRow({
  label,
  date,
  reverse,
  onRenew,
}: {
  label: string;
  date: string | null;
  reverse?: boolean;
  onRenew: () => void;
}) {
  const { t } = useTranslation(["vehicules", "common"]);
  const d = daysUntil(date);
  let tone = "bg-muted text-muted-foreground";
  let info = t("detail.notSet");
  if (date) {
    if (reverse) {
      const ago = d === null ? 0 : -d;
      info =
        ago >= 0
          ? t("detail.maintenanceDone", { date: formatDateBE(date), count: ago })
          : t("detail.maintenancePlanned", { date: formatDateBE(date), count: -ago });
      if (ago > 365) tone = "bg-red-100 text-red-700";
      else if (ago > 335) tone = "bg-amber-100 text-amber-700";
      else tone = "bg-emerald-100 text-emerald-700";
    } else {
      info =
        d! < 0
          ? t("detail.expiredSince", { count: Math.abs(d!), date: formatDateBE(date) })
          : t("detail.expiresOn", { date: formatDateBE(date), count: d! });
      if (d! < 0) tone = "bg-red-100 text-red-700";
      else if (d! < 30) tone = "bg-amber-100 text-amber-700";
      else tone = "bg-emerald-100 text-emerald-700";
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{info}</p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
        {date
          ? reverse
            ? t("detail.badgeMaintenance")
            : d! < 0
              ? t("detail.badgeExpired")
              : d! < 30
                ? t("detail.badgeSoon")
                : t("detail.badgeOk")
          : "—"}
      </span>
      <button
        onClick={onRenew}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
      >
        <RefreshCw className="h-3 w-3" /> {t("detail.renew")}
      </button>
    </div>
  );
}

function AffectationModal({
  vehiculeId,
  currentKm,
  chantiers,
  onClose,
  onSaved,
}: {
  vehiculeId: string;
  currentKm: number;
  chantiers: Pick<Tables<"chantiers">, "id" | "name">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["vehicules", "common"]);
  const [chantierId, setChantierId] = useState(chantiers[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startKm, setStartKm] = useState(currentKm);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chantierId) return toast.error(t("validation.selectSite"));
    setSaving(true);
    const { error } = await supabase.from("vehicule_affectations").insert({
      vehicule_id: vehiculeId,
      chantier_id: chantierId,
      start_date: startDate,
      start_km: Number(startKm),
    });
    if (!error) await supabase.from("vehicules").update({ status: "affecte" }).eq("id", vehiculeId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.assigned"));
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("assignModal.title")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("assignModal.site")}</span>
            <select
              className={inputCls}
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
            >
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("assignModal.startDate")}</span>
            <input
              type="date"
              className={inputCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t("assignModal.startKm")}</span>
            <input
              type="number"
              className={inputCls}
              value={startKm}
              onChange={(e) => setStartKm(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "…" : t("assignModal.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
