import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Truck, Car, RefreshCw, Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE, daysUntil } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vehicules/$id")({
  component: VehiculeDetail,
});

function VehiculeDetail() {
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
        supabase.from("vehicule_affectations").select("*, chantiers(id, name)").eq("vehicule_id", id).order("start_date", { ascending: false }),
        supabase.from("chantiers").select("id, name").eq("company_id", companyId ?? "").order("name"),
      ]);
      return { v: vRes.data, affectations: aRes.data ?? [], chantiers: cRes.data ?? [] };
    },
    enabled: !!companyId,
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (!data.v) return <div>Véhicule introuvable.</div>;

  const v = data.v;
  const current = data.affectations.find((a: any) => !a.end_date);

  const renew = async (field: "ct_date" | "insurance_date" | "maintenance_date") => {
    const now = new Date();
    const newDate = field === "maintenance_date"
      ? now
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const { error } = await supabase.from("vehicules").update({ [field]: newDate.toISOString().slice(0, 10) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mis à jour");
    qc.invalidateQueries({ queryKey: ["vehicule", id] });
    qc.invalidateQueries({ queryKey: ["vehicules"] });
  };

  const closeAffectation = async (aff: any) => {
    const endKmStr = prompt(`Kilométrage de fin (km actuel: ${v.current_km}) :`, String(v.current_km));
    if (!endKmStr) return;
    const endKm = Number(endKmStr);
    if (isNaN(endKm)) return toast.error("Kilométrage invalide");
    const { error } = await supabase.from("vehicule_affectations").update({
      end_date: new Date().toISOString().slice(0, 10),
      end_km: endKm,
    }).eq("id", aff.id);
    if (error) return toast.error(error.message);
    await supabase.from("vehicules").update({ current_km: endKm, status: "Disponible" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["vehicule", id] });
    qc.invalidateQueries({ queryKey: ["vehicules"] });
    toast.success("Affectation clôturée");
  };

  const deleteVeh = async () => {
    if (!confirm("Supprimer ce véhicule et son historique ?")) return;
    await supabase.from("vehicule_affectations").delete().eq("vehicule_id", id);
    const { error } = await supabase.from("vehicules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Véhicule supprimé");
    window.location.href = "/vehicules";
  };

  const Icon = v.type === "Voiture" ? Car : Truck;

  return (
    <div className="space-y-6">
      <Link to="/vehicules" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à la flotte
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{v.brand} {v.model}</h1>
                <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm font-bold tracking-wider">{v.plate}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{v.type} · {v.year ?? "—"} · {v.current_km.toLocaleString("fr-BE")} km · {formatEUR(v.cost_per_km)} / km</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {current ? (
              <span className="rounded-full bg-info/10 px-3 py-1 text-xs font-semibold text-info">🏗 {current.chantiers?.name}</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">● Disponible</span>
            )}
            <button onClick={deleteVeh} className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Alertes / entretiens */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Alertes & Entretiens</h2>
        <div className="space-y-2">
          <AlertRow label="Contrôle technique" date={v.ct_date} onRenew={() => renew("ct_date")} />
          <AlertRow label="Assurance" date={v.insurance_date} onRenew={() => renew("insurance_date")} />
          <AlertRow label="Dernier entretien" date={v.maintenance_date} reverse onRenew={() => renew("maintenance_date")} />
        </div>
      </div>

      {/* Affectations */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historique d'affectations</h2>
          {!current && (
            <button
              onClick={() => setAffModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" /> Affecter à un chantier
            </button>
          )}
        </div>
        {data.affectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune affectation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Chantier</th>
                  <th className="pb-2">Période</th>
                  <th className="pb-2">Km parcourus</th>
                  <th className="pb-2">Coût véhicule</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.affectations.map((a: any) => {
                  const km = a.end_km && a.start_km ? a.end_km - a.start_km : null;
                  const cost = km ? km * Number(v.cost_per_km) : null;
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2 font-medium">
                        <Link to="/chantiers/$id" params={{ id: a.chantier_id }} className="hover:text-primary">
                          {a.chantiers?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDateBE(a.start_date)} → {a.end_date ? formatDateBE(a.end_date) : <span className="text-info">En cours</span>}
                      </td>
                      <td className="py-2">{km !== null ? `${km.toLocaleString("fr-BE")} km` : "—"}</td>
                      <td className="py-2 font-semibold">{cost !== null ? formatEUR(cost) : "—"}</td>
                      <td className="py-2 text-right">
                        {!a.end_date && (
                          <button onClick={() => closeAffectation(a)} className="text-xs font-semibold text-primary hover:underline">
                            Clôturer
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

function AlertRow({ label, date, reverse, onRenew }: { label: string; date: string | null; reverse?: boolean; onRenew: () => void }) {
  const d = daysUntil(date);
  let tone = "bg-muted text-muted-foreground";
  let info = "Non renseigné";
  if (date) {
    if (reverse) {
      const ago = d === null ? 0 : -d;
      info = `Effectué le ${formatDateBE(date)} · il y a ${ago} j`;
      if (ago > 365) tone = "bg-red-100 text-red-700";
      else if (ago > 335) tone = "bg-amber-100 text-amber-700";
      else tone = "bg-emerald-100 text-emerald-700";
    } else {
      info = d! < 0 ? `Expiré depuis ${Math.abs(d!)} j (${formatDateBE(date)})`
        : `Expire le ${formatDateBE(date)} (${d} j)`;
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
        {date ? (reverse ? "Entretien" : d! < 0 ? "Expiré" : d! < 30 ? "Bientôt" : "OK") : "—"}
      </span>
      <button
        onClick={onRenew}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
      >
        <RefreshCw className="h-3 w-3" /> Renouveler
      </button>
    </div>
  );
}

function AffectationModal({ vehiculeId, currentKm, chantiers, onClose, onSaved }: any) {
  const [chantierId, setChantierId] = useState(chantiers[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startKm, setStartKm] = useState(currentKm);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chantierId) return toast.error("Sélectionnez un chantier");
    setSaving(true);
    const { error } = await supabase.from("vehicule_affectations").insert({
      vehicule_id: vehiculeId,
      chantier_id: chantierId,
      start_date: startDate,
      start_km: Number(startKm),
    });
    if (!error) await supabase.from("vehicules").update({ status: "Affecté" }).eq("id", vehiculeId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Véhicule affecté");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Affecter à un chantier</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Chantier</span>
            <select className={inputCls} value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
              {chantiers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Date de début</span>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Kilométrage de départ</span>
            <input type="number" className={inputCls} value={startKm} onChange={(e) => setStartKm(e.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Annuler</button>
          <button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? "…" : "Affecter"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
