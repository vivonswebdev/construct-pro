import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initials, avatarColor } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/personnel/")({
  component: PersonnelList,
});

function PersonnelList() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["personnel-full", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [pRes, presRes, affRes] = await Promise.all([
        supabase.from("personnel").select("*").eq("company_id", companyId!).order("full_name"),
        supabase.from("presence").select("*"),
        supabase.from("affectations").select("*, chantiers(name)"),
      ]);
      return {
        personnel: pRes.data ?? [],
        presence: presRes.data ?? [],
        affectations: affRes.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const { personnel, presence, affectations } = data;

  const filtered = personnel.filter((p) => {
    if (statusFilter !== "Tous" && p.status !== statusFilter) return false;
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = new Date();
  const lastDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {personnel.length}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Ajouter un ouvrier
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un ouvrier..."
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {["Tous", "Actif", "Inactif"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm font-semibold">Aucun ouvrier pour le moment</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Ajouter votre premier ouvrier
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const aff = affectations.find((a: any) => a.personnel_id === p.id);
            return (
              <Link
                to="/personnel/$id"
                params={{ id: p.id }}
                key={p.id}
                className="block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(p.full_name)}`}
                  >
                    {initials(p.full_name)}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      p.status === "Actif"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold">{p.full_name}</h3>
                <p className="text-xs text-muted-foreground">{p.contract_type ?? "—"}</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Chantier</p>
                    <p className="truncate text-xs font-semibold">
                      {aff?.chantiers?.name ?? "Non affecté"}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Contrat</p>
                    <p className="truncate text-xs font-semibold">{p.contract_type ?? "—"}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1 text-[10px] uppercase text-muted-foreground">
                    7 derniers jours
                  </p>
                  <div className="flex gap-1">
                    {lastDays.map((d) => {
                      const pr = presence.find((x) => x.personnel_id === p.id && x.date === d);
                      const dow = new Date(d).getDay();
                      const weekend = dow === 0 || dow === 6;
                      let bg = "bg-gray-100";
                      if (weekend) bg = "bg-gray-100";
                      else if (pr?.status === "Présent") bg = "bg-emerald-400";
                      else if (pr?.status === "Absent") bg = "bg-red-400";
                      else if (pr?.status === "Congé") bg = "bg-amber-400";
                      return <div key={d} className={`h-4 flex-1 rounded ${bg}`} title={d} />;
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewPersonnelModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["personnel-full"] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function NewPersonnelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    nrn: "",
    email: "",
    phone: "",
    contract_type: "CDI",
    hourly_rate: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("personnel").insert({
        company_id: profile.company_id,
        full_name: form.full_name,
        nrn: form.nrn || null,
        email: form.email || null,
        phone: form.phone || null,
        contract_type: form.contract_type,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        status: "Actif",
      });
      if (error) throw error;
      toast.success("Ouvrier ajouté");
      onCreated();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nouvel ouvrier</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <F label="Nom complet">
            <input
              required
              className="mi"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="NRN">
              <input
                placeholder="85.04.12-345.67"
                className="mi"
                value={form.nrn}
                onChange={(e) => setForm({ ...form, nrn: e.target.value })}
              />
            </F>
            <F label="Téléphone">
              <input
                className="mi"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </F>
          </div>
          <F label="Email">
            <input
              type="email"
              className="mi"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Type de contrat">
              <select
                className="mi"
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
              >
                {["CDI", "CDD", "Intérim", "Indépendant"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </F>
            <F label="Taux horaire (€/h)">
              <input
                type="number"
                step="0.01"
                className="mi"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
            </F>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "..." : "Ajouter"}
          </button>
        </div>
        <style>{`.mi{width:100%;padding:.5rem .75rem;border:1px solid var(--color-border);border-radius:.5rem;font-size:.875rem;background:white;outline:none}.mi:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--color-primary) 20%,transparent)}`}</style>
      </form>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
