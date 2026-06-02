import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MapPin, ChevronDown, ChevronUp, CheckCircle2, Play, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR, formatDateBE, daysUntil, initials, avatarColor } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chantiers/$id")({
  component: ChantierDetail,
});

const STATUS_STYLES: Record<string, string> = {
  "En cours": "bg-cyan-100 text-cyan-700",
  "En retard": "bg-red-100 text-red-700",
  "Terminé": "bg-emerald-100 text-emerald-700",
  "En attente": "bg-amber-100 text-amber-700",
};

const PHASE_STATUS_DOT: Record<string, string> = {
  "En attente": "bg-gray-300 text-gray-700",
  "En cours": "bg-info text-white",
  "Terminé": "bg-success text-white",
  "En retard": "bg-danger text-white",
};

function ChantierDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["chantier", id],
    queryFn: async () => {
      const [cRes, eRes, aRes, vaRes] = await Promise.all([
        supabase.from("chantiers").select("*").eq("id", id).maybeSingle(),
        supabase.from("etapes").select("*").eq("chantier_id", id).order("order_index"),
        supabase.from("affectations").select("*, personnel(id, full_name)").eq("chantier_id", id),
        supabase.from("vehicule_affectations").select("*").eq("chantier_id", id),
      ]);
      const vIds = Array.from(new Set((vaRes.data ?? []).map((va) => va.vehicule_id)));
      const vMap = new Map<string, any>();
      if (vIds.length) {
        const { data: vehs } = await supabase.from("vehicules").select("id, plate, brand, model, cost_per_km, current_km").in("id", vIds);
        (vehs ?? []).forEach((v) => vMap.set(v.id, v));
      }
      const vehAffectations = (vaRes.data ?? []).map((va) => ({ ...va, vehicule: vMap.get(va.vehicule_id) }));
      return { chantier: cRes.data, etapes: eRes.data ?? [], affectations: aRes.data ?? [], vehAffectations };
    },
  });

  if (isLoading || !data) return <div className="p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const { chantier, etapes, affectations, vehAffectations } = data;
  if (!chantier) return <div>Chantier introuvable.</div>;

  const benefice = Number(chantier.budget ?? 0) - Number(chantier.actual_costs ?? 0);
  const days = daysUntil(chantier.end_date);
  const completed = etapes.filter((e) => e.progress >= 100).length;

  const updateEtape = async (etapeId: string, patch: { progress?: number; status?: string; notes?: string; start_date?: string | null; end_date?: string | null }) => {
    const { error } = await supabase.from("etapes").update(patch).eq("id", etapeId);
    if (error) { toast.error(error.message); return; }

    // Recalculate chantier progress
    const { data: allEtapes } = await supabase.from("etapes").select("progress").eq("chantier_id", id);
    if (allEtapes && allEtapes.length > 0) {
      const avg = Math.round(allEtapes.reduce((s, e) => s + e.progress, 0) / allEtapes.length);
      const newStatus = avg >= 100 ? "Terminé"
        : chantier.end_date && new Date(chantier.end_date) < new Date() ? "En retard"
        : avg > 0 ? "En cours"
        : "En attente";
      await supabase.from("chantiers").update({ progress: avg, status: newStatus }).eq("id", id);
    }
    qc.invalidateQueries({ queryKey: ["chantier", id] });
    qc.invalidateQueries({ queryKey: ["chantiers"] });
    toast.success("Étape mise à jour");
  };

  return (
    <div className="space-y-6">
      <Link to="/chantiers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux chantiers
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{chantier.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{chantier.client_name}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {chantier.address}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[chantier.status] ?? "bg-muted"}`}>
              {chantier.status}
            </span>
            {days !== null && chantier.progress < 100 && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${days < 14 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                {days < 0 ? `${Math.abs(days)} j de retard` : `${days} j restants`}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Metric label="Budget" value={formatEUR(chantier.budget)} />
          <Metric label="Dépenses" value={formatEUR(chantier.actual_costs)} />
          <Metric
            label="Bénéfice"
            value={formatEUR(benefice)}
            tone={benefice >= 0 ? "success" : "danger"}
            badge="temps réel"
          />
        </div>

        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progression globale</span>
            <span className="font-semibold">{chantier.progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${chantier.progress}%` }} />
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Phases du chantier</h2>
          <span className="text-sm text-muted-foreground">{completed}/{etapes.length} étapes complétées</span>
        </div>
        <div className="space-y-0">
          {etapes.map((e, i) => (
            <PhaseRow
              key={e.id}
              etape={e}
              index={i}
              isLast={i === etapes.length - 1}
              onUpdate={(patch: { progress?: number; status?: string; notes?: string }) => updateEtape(e.id, patch)}
            />
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Équipe sur ce chantier</h2>
        {affectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun ouvrier affecté.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {affectations.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(a.personnel?.full_name ?? "?")}`}>
                  {initials(a.personnel?.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.personnel?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.role ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Véhicules */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Truck className="h-5 w-5 text-primary" /> Véhicules affectés
        </h2>
        {vehAffectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun véhicule affecté.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehAffectations.map((va: any) => {
              const v = va.vehicule;
              if (!v) return null;
              const km = va.end_km && va.start_km ? va.end_km - va.start_km
                : !va.end_date && va.start_km ? v.current_km - va.start_km
                : null;
              const cost = km ? km * Number(v.cost_per_km) : null;
              return (
                <Link
                  key={va.id}
                  to="/vehicules/$id"
                  params={{ id: v.id }}
                  className="block rounded-lg border border-border p-3 transition hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold">{v.plate}</span>
                    {!va.end_date && <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">En cours</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{v.brand} {v.model}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBE(va.start_date)} → {va.end_date ? formatDateBE(va.end_date) : "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{km !== null ? `${km.toLocaleString("fr-BE")} km` : "—"}</span>
                    <span className="font-semibold text-primary">{cost !== null ? formatEUR(cost) : "—"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone, badge }: { label: string; value: string; tone?: "success" | "danger"; badge?: string }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{badge}</span>}
      </div>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function PhaseRow({ etape, index, isLast, onUpdate }: any) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(etape.progress);
  const [notes, setNotes] = useState(etape.notes ?? "");
  const [startDate, setStartDate] = useState(etape.start_date ?? "");
  const [endDate, setEndDate] = useState(etape.end_date ?? "");

  const dotStyle = PHASE_STATUS_DOT[etape.status] ?? "bg-gray-300";

  const save = () => onUpdate({
    progress,
    notes,
    start_date: startDate || null,
    end_date: endDate || null,
    status: progress >= 100 ? "Terminé" : progress > 0 ? "En cours" : "En attente",
  });

  return (
    <div className="relative pb-4">
      {!isLast && <div className="absolute left-[18px] top-9 h-full w-px bg-border" />}
      <div className="flex gap-4">
        <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dotStyle}`}>
          {index + 1}
        </div>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{etape.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[etape.status] ?? "bg-muted"}`}>
                  {etape.status}
                </span>
                {(etape.start_date || etape.end_date) && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateBE(etape.start_date)} → {formatDateBE(etape.end_date)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${etape.progress}%` }} />
                </div>
                <span className="text-xs font-medium">{etape.progress}%</span>
              </div>
            </div>
            {open ? <ChevronUp className="ml-3 h-4 w-4 text-muted-foreground" /> : <ChevronDown className="ml-3 h-4 w-4 text-muted-foreground" />}
          </button>

          {open && (
            <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Progression : {progress}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Date de début</label>
                  <input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Date de fin</label>
                  <input type="date" value={endDate ?? ""} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={save}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                >
                  Enregistrer
                </button>
                {etape.status !== "Terminé" && (
                  <button
                    onClick={() => { setProgress(100); onUpdate({ progress: 100, status: "Terminé", notes, start_date: startDate || null, end_date: endDate || null }); }}
                    className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Marquer terminé
                  </button>
                )}
                {etape.status === "En attente" && (
                  <button
                    onClick={() => onUpdate({ progress: 10, status: "En cours", notes, start_date: startDate || null, end_date: endDate || null })}
                    className="inline-flex items-center gap-1 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <Play className="h-3 w-3" /> Démarrer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
