import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Truck, Car, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { daysUntil, formatDateBE } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vehicules/")({
  component: VehiculesPage,
});

const TYPES = ["Camionnette", "Camion", "Voiture", "Engin"] as const;

function VehiculesPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicules", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [vRes, aRes, cRes] = await Promise.all([
        supabase.from("vehicules").select("*").eq("company_id", companyId!).order("created_at", { ascending: false }),
        supabase.from("vehicule_affectations").select("*").is("end_date", null),
        supabase.from("chantiers").select("id, name").eq("company_id", companyId!),
      ]);
      const chMap = new Map((cRes.data ?? []).map((c) => [c.id, c]));
      const affs = (aRes.data ?? []).map((a) => ({ ...a, chantier: chMap.get(a.chantier_id) }));
      return { vehicules: vRes.data ?? [], affectations: affs };
    },
  });

  const byVehicule = useMemo(() => {
    const m = new Map<string, any>();
    data?.affectations.forEach((a: any) => m.set(a.vehicule_id, a));
    return m;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flotte véhicules</h1>
          <p className="text-sm text-muted-foreground">
            {data?.vehicules.length ?? 0} véhicule{(data?.vehicules.length ?? 0) > 1 ? "s" : ""} enregistré{(data?.vehicules.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Ajouter un véhicule
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (data?.vehicules.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Aucun véhicule. Ajoutez votre premier véhicule pour commencer.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data!.vehicules.map((v) => (
            <VehiculeCard key={v.id} v={v} affectation={byVehicule.get(v.id)} />
          ))}
        </div>
      )}

      {open && (
        <AddVehiculeModal
          companyId={companyId!}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["vehicules"] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function VehiculeCard({ v, affectation }: { v: any; affectation: any }) {
  const Icon = v.type === "Voiture" ? Car : Truck;
  return (
    <Link
      to="/vehicules/$id"
      params={{ id: v.id }}
      className="block rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs font-bold tracking-wider">
          {v.plate}
        </span>
      </div>
      <div className="mt-3">
        <p className="font-semibold">{v.brand} {v.model}</p>
        <p className="text-xs text-muted-foreground">{v.type} · {v.year ?? "—"} · {v.current_km.toLocaleString("fr-BE")} km</p>
      </div>
      <div className="mt-3">
        {affectation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
            🏗 {affectation.chantier?.name ?? "Affecté"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            ● Disponible
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <DateBadge label="CT" date={v.ct_date} />
        <DateBadge label="Assurance" date={v.insurance_date} />
        <DateBadge label="Entretien" date={v.maintenance_date} reverse />
      </div>
    </Link>
  );
}

function DateBadge({ label, date, reverse = false }: { label: string; date: string | null; reverse?: boolean }) {
  const d = daysUntil(date);
  // reverse=true means entretien (date is last maintenance, alert if > 1 year ago)
  let tone = "bg-muted text-muted-foreground";
  if (date === null) tone = "bg-muted text-muted-foreground";
  else if (reverse) {
    const ago = d === null ? 0 : -d;
    if (ago > 365) tone = "bg-red-100 text-red-700";
    else if (ago > 335) tone = "bg-amber-100 text-amber-700";
    else tone = "bg-emerald-100 text-emerald-700";
  } else {
    if (d === null) tone = "bg-muted text-muted-foreground";
    else if (d < 0) tone = "bg-red-100 text-red-700";
    else if (d < 30) tone = "bg-amber-100 text-amber-700";
    else tone = "bg-emerald-100 text-emerald-700";
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {label}: {date ? formatDateBE(date) : "—"}
    </span>
  );
}

function AddVehiculeModal({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: "Camionnette",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    plate: "",
    current_km: 0,
    cost_per_km: 0.35,
    ct_date: "",
    insurance_date: "",
    maintenance_date: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plate.trim()) return toast.error("La plaque est requise");
    setSaving(true);
    const { error } = await supabase.from("vehicules").insert({
      company_id: companyId,
      type: form.type,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year || null,
      plate: form.plate.trim().toUpperCase(),
      current_km: form.current_km,
      cost_per_km: form.cost_per_km,
      ct_date: form.ct_date || null,
      insurance_date: form.insurance_date || null,
      maintenance_date: form.maintenance_date || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Véhicule ajouté");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nouveau véhicule</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Plaque *">
            <input className={inputCls} value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="1-ABC-123" />
          </Field>
          <Field label="Marque">
            <input className={inputCls} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Modèle">
            <input className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </Field>
          <Field label="Année">
            <input type="number" className={inputCls} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
          </Field>
          <Field label="Kilométrage">
            <input type="number" className={inputCls} value={form.current_km} onChange={(e) => setForm({ ...form, current_km: Number(e.target.value) })} />
          </Field>
          <Field label="Coût/km (€)">
            <input type="number" step="0.01" className={inputCls} value={form.cost_per_km} onChange={(e) => setForm({ ...form, cost_per_km: Number(e.target.value) })} />
          </Field>
          <Field label="Date CT">
            <input type="date" className={inputCls} value={form.ct_date} onChange={(e) => setForm({ ...form, ct_date: e.target.value })} />
          </Field>
          <Field label="Date assurance">
            <input type="date" className={inputCls} value={form.insurance_date} onChange={(e) => setForm({ ...form, insurance_date: e.target.value })} />
          </Field>
          <Field label="Dernier entretien">
            <input type="date" className={inputCls} value={form.maintenance_date} onChange={(e) => setForm({ ...form, maintenance_date: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Annuler</button>
          <button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Enregistrement…" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
