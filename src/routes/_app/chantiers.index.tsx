import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Eye, Edit2, X, FileDown, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE, daysUntil } from "@/lib/format";
import { exportChantiersPDF, exportChantiersCSV } from "@/lib/pdf";
import { toast } from "sonner";
import { ClientSelect } from "@/components/ClientSelect";
import { clientLabel, clientAddress } from "@/lib/clients";

export const Route = createFileRoute("/_app/chantiers/")({
  component: ChantiersList,
});

const STATUS_STYLES: Record<string, string> = {
  "En cours": "bg-cyan-100 text-cyan-700",
  "En retard": "bg-red-100 text-red-700",
  Terminé: "bg-emerald-100 text-emerald-700",
  "En attente": "bg-amber-100 text-amber-700",
};

const DEFAULT_PHASES = [
  "Préparation du site",
  "Fondations",
  "Gros œuvre",
  "Charpente & Toiture",
  "Second œuvre (électricité, plomberie)",
  "Finitions & Peinture",
  "Nettoyage & Réception",
];

function ChantiersList() {
  const { profile, company } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Tous");
  const [showModal, setShowModal] = useState(false);

  const { data: chantiers = [], isLoading } = useQuery({
    queryKey: ["chantiers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chantiers")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = chantiers.filter((c) => {
    if (status !== "Tous" && c.status !== status) return false;
    if (search && !`${c.name} ${c.client_name ?? ""}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Chantiers</h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {chantiers.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportChantiersCSV(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            title="Exporter en CSV"
          >
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => exportChantiersPDF(filtered, company?.name)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            title="Exporter en PDF"
          >
            <FileDown className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nouveau chantier
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un chantier..."
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {["Tous", "En cours", "En retard", "Terminé", "En attente"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setShowModal(true)} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Chantier</Th>
                <Th>Client</Th>
                <Th>Budget</Th>
                <Th>Progression</Th>
                <Th>Statut</Th>
                <Th>Remise</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const days = daysUntil(c.end_date);
                const urgent = days !== null && days < 14 && days >= 0 && c.progress < 100;
                return (
                  <tr key={c.id} className="transition hover:bg-muted/40">
                    <Td>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.address}</div>
                    </Td>
                    <Td>{c.client_name ?? "—"}</Td>
                    <Td className="font-medium">{formatEUR(c.budget)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${c.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium">{c.progress}%</span>
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[c.status] ?? "bg-muted"}`}
                      >
                        {c.status}
                      </span>
                    </Td>
                    <Td>
                      <div>{formatDateBE(c.end_date)}</div>
                      {days !== null && c.progress < 100 && (
                        <div
                          className={`text-xs ${urgent ? "text-danger font-semibold" : "text-muted-foreground"}`}
                        >
                          {days < 0 ? `${Math.abs(days)} j de retard` : `${days} j restants`}
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Link
                        to="/chantiers/$id"
                        params={{ id: c.id }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/chantiers/$id"
                        params={{ id: c.id }}
                        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewChantierModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["chantiers"] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Plus className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">Aucun chantier pour le moment</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Démarrez en créant votre premier chantier.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Créer un chantier
      </button>
    </div>
  );
}

function NewChantierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    name: "",
    client_id: "",
    client_name: "",
    address: "",
    budget: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const { data: chantier, error } = await supabase
        .from("chantiers")
        .insert({
          company_id: profile.company_id,
          name: form.name,
          client_name: form.client_name,
          client_id: form.client_id || null,
          address: form.address,
          budget: Number(form.budget) || 0,
          actual_costs: 0,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          description: form.description,
          status: "En attente",
          progress: 0,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("etapes").insert(
        DEFAULT_PHASES.map((name, i) => ({
          chantier_id: chantier.id,
          name,
          order_index: i,
          status: "En attente",
          progress: 0,
        })),
      );

      toast.success("Chantier créé");
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
          <h3 className="text-lg font-semibold">Nouveau chantier</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <ModalField label="Nom du chantier">
            <input
              required
              className="modal-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </ModalField>
          <ModalField label="Client">
            <ClientSelect
              value={form.client_id}
              onChange={(id, c) =>
                setForm({
                  ...form,
                  client_id: id,
                  client_name: clientLabel(c),
                  address: form.address || clientAddress(c),
                })
              }
            />
          </ModalField>
          <ModalField label="Adresse">
            <input
              className="modal-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </ModalField>
          <div className="grid grid-cols-3 gap-3">
            <ModalField label="Budget (€)">
              <input
                type="number"
                min="0"
                className="modal-input"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </ModalField>
            <ModalField label="Début">
              <input
                type="date"
                className="modal-input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </ModalField>
            <ModalField label="Remise">
              <input
                type="date"
                className="modal-input"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </ModalField>
          </div>
          <ModalField label="Description">
            <textarea
              rows={3}
              className="modal-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </ModalField>
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
            {saving ? "..." : "Créer"}
          </button>
        </div>
        <style>{`
          .modal-input {
            width: 100%; padding: 0.5rem 0.75rem;
            border: 1px solid var(--color-border); border-radius: 0.5rem;
            font-size: 0.875rem; background: white; outline: none;
          }
          .modal-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 20%, transparent); }
        `}</style>
      </form>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
