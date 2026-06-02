import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Plus, X, Search, Receipt, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE, daysUntil } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/facturation/")({
  component: FacturationPage,
});

type Facture = {
  id: string;
  type: string;
  number: string;
  client_name: string;
  chantier_id: string | null;
  issue_date: string;
  due_date: string | null;
  total_ttc: number;
  subtotal_ht: number;
  vat_amount: number;
  vat_rate: number;
  status: string;
  paid_date: string | null;
};

const STATUSES_FACTURE = ["Brouillon", "Envoyée", "Payée", "En retard"];
const STATUSES_DEVIS = ["Brouillon", "Envoyé", "Accepté", "Refusé"];

function FacturationPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"facture" | "devis">("facture");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [openNew, setOpenNew] = useState(false);

  const { data: chantiers } = useQuery({
    queryKey: ["chantiers-mini", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chantiers")
        .select("id, name, client_name, address")
        .eq("company_id", companyId!);
      return data ?? [];
    },
  });

  const { data: factures, isLoading } = useQuery({
    queryKey: ["factures", companyId, tab],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await (supabase.from("factures" as any) as any)
        .select("*")
        .eq("company_id", companyId!)
        .eq("type", tab)
        .order("issue_date", { ascending: false });
      // Auto-flag overdue invoices
      const out: Facture[] = (data ?? []).map((f: Facture) => {
        if (
          f.type === "facture" &&
          f.status === "Envoyée" &&
          f.due_date &&
          (daysUntil(f.due_date) ?? 0) < 0
        ) {
          return { ...f, status: "En retard" };
        }
        return f;
      });
      return out;
    },
  });

  const filtered = useMemo(() => {
    const list = factures ?? [];
    return list.filter((f) => {
      if (statusFilter && f.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!f.number.toLowerCase().includes(s) && !f.client_name.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [factures, statusFilter, search]);

  const kpis = useMemo(() => {
    const list = factures ?? [];
    const total = list.reduce((s, f) => s + Number(f.total_ttc), 0);
    const paid = list.filter((f) => f.status === "Payée").reduce((s, f) => s + Number(f.total_ttc), 0);
    const pending = list.filter((f) => f.status === "Envoyée").reduce((s, f) => s + Number(f.total_ttc), 0);
    const overdue = list.filter((f) => f.status === "En retard").reduce((s, f) => s + Number(f.total_ttc), 0);
    return { total, paid, pending, overdue, count: list.length };
  }, [factures]);

  const statuses = tab === "facture" ? STATUSES_FACTURE : STATUSES_DEVIS;

  const exportCSV = () => {
    const list = filtered;
    const headers = ["Numéro", "Type", "Client", "Date", "Échéance", "HT (€)", "TVA (€)", "TTC (€)", "Statut"];
    const rows = list.map((f) => [
      f.number, f.type, f.client_name,
      formatDateBE(f.issue_date), formatDateBE(f.due_date),
      String(Math.round(Number(f.subtotal_ht))).replace(".", ","),
      String(Math.round(Number(f.vat_amount))).replace(".", ","),
      String(Math.round(Number(f.total_ttc))).replace(".", ","),
      f.status,
    ]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis & Factures</h1>
          <p className="text-sm text-muted-foreground">
            Gestion commerciale avec TVA belge (21% / 6% rénovation)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4" /> Exporter CSV
          </button>
          <button
            onClick={() => setOpenNew(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Nouveau {tab === "devis" ? "devis" : "facture"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["facture", "devis"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStatusFilter(""); }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "facture" ? "Factures" : "Devis"}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label={`Total ${tab === "devis" ? "devisé" : "facturé"}`} value={formatEUR(kpis.total)} sub={`${kpis.count} document${kpis.count > 1 ? "s" : ""}`} tone="default" />
        <KPI label={tab === "devis" ? "Devis acceptés" : "Encaissé"} value={formatEUR(kpis.paid)} tone="success" />
        <KPI label="En attente" value={formatEUR(kpis.pending)} tone="info" />
        <KPI label="En retard" value={formatEUR(kpis.overdue)} tone="danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro ou un client…"
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          {tab === "devis" ? <FileText className="mx-auto h-10 w-10 text-muted-foreground" /> : <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />}
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun {tab === "devis" ? "devis" : "facture"} pour le moment.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Numéro</th>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Échéance</th>
                <th className="px-4 py-3 text-right font-semibold">Total TTC</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => navigate({ to: "/facturation/$id", params: { id: f.id } })}
                  className="cursor-pointer border-t border-border transition hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-mono font-semibold">{f.number}</td>
                  <td className="px-4 py-3">{f.client_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateBE(f.issue_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateBE(f.due_date)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatEUR(f.total_ttc)}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openNew && (
        <NewFactureModal
          type={tab}
          companyId={companyId!}
          chantiers={chantiers ?? []}
          onClose={() => setOpenNew(false)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ["factures"] });
            setOpenNew(false);
            navigate({ to: "/facturation/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "default" | "success" | "info" | "danger" }) {
  const toneCls = {
    default: "text-foreground",
    success: "text-emerald-600",
    info: "text-info",
    danger: "text-red-600",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Brouillon": "bg-muted text-muted-foreground",
    "Envoyée": "bg-info/10 text-info",
    "Envoyé": "bg-info/10 text-info",
    "Payée": "bg-emerald-100 text-emerald-700",
    "Accepté": "bg-emerald-100 text-emerald-700",
    "Refusé": "bg-red-100 text-red-700",
    "En retard": "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

function nextNumber(type: string): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900) + 100;
  return `${type === "devis" ? "DEV" : "FAC"}-${year}-${String(seq).padStart(4, "0")}`;
}

function NewFactureModal({
  type, companyId, chantiers, onClose, onCreated,
}: {
  type: "facture" | "devis";
  companyId: string;
  chantiers: any[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    number: nextNumber(type),
    client_name: "",
    client_vat: "",
    client_address: "",
    chantier_id: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    vat_rate: 21,
  });
  const [saving, setSaving] = useState(false);

  const applyChantier = (chId: string) => {
    const c = chantiers.find((x) => x.id === chId);
    setForm({
      ...form,
      chantier_id: chId,
      client_name: form.client_name || c?.client_name || "",
      client_address: form.client_address || c?.address || "",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) return toast.error("Le nom du client est requis");
    setSaving(true);
    const { data, error } = await (supabase.from("factures" as any) as any)
      .insert({
        company_id: companyId,
        type,
        number: form.number,
        client_name: form.client_name,
        client_vat: form.client_vat || null,
        client_address: form.client_address || null,
        chantier_id: form.chantier_id || null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        vat_rate: form.vat_rate,
        status: "Brouillon",
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${type === "devis" ? "Devis" : "Facture"} créé`);
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nouveau {type === "devis" ? "devis" : "facture"}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro">
            <input className={inputCls} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </Field>
          <Field label="Taux TVA">
            <select className={inputCls} value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}>
              <option value={21}>21 % (standard)</option>
              <option value={6}>6 % (rénovation &gt; 10 ans)</option>
              <option value={12}>12 % (logement social)</option>
              <option value={0}>0 % (cocontractant)</option>
            </select>
          </Field>
          <Field label="Chantier lié">
            <select className={inputCls} value={form.chantier_id} onChange={(e) => applyChantier(e.target.value)}>
              <option value="">— Aucun —</option>
              {chantiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="N° TVA client">
            <input className={inputCls} value={form.client_vat} onChange={(e) => setForm({ ...form, client_vat: e.target.value })} placeholder="BE0123456789" />
          </Field>
          <Field label="Nom du client *">
            <input className={inputCls} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
          <Field label="Adresse du client">
            <input className={inputCls} value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
          </Field>
          <Field label="Date d'émission">
            <input type="date" className={inputCls} value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </Field>
          <Field label={type === "devis" ? "Date de validité" : "Échéance"}>
            <input type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Annuler</button>
          <button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Création…" : "Créer et éditer"}
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
