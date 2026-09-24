import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Plus, X, Search, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE, daysUntil } from "@/lib/format";
import { toast } from "sonner";
import { ClientSelect } from "@/components/ClientSelect";
import { clientLabel, clientAddress, type Client } from "@/lib/clients";

export const Route = createFileRoute("/_app/facturation/")({
  head: () => ({
    meta: [
      { title: "Devis — ConstructFlow" },
      {
        name: "description",
        content:
          "Créez et suivez vos devis de construction avec TVA belge 21/6/0 % et autoliquidation.",
      },
      { property: "og:title", content: "Devis — ConstructFlow" },
      { property: "og:description", content: "Devis de construction conformes à la TVA belge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevisPage,
});

type Devis = {
  id: string;
  number: string;
  client_name: string;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  total_ttc: number;
  subtotal_ht: number;
  vat_amount: number;
  status: string;
};

export const DEVIS_STATUSES = ["Brouillon", "Envoyé", "Accepté", "Refusé", "Expiré"];

export function effectiveStatus(d: {
  status: string;
  valid_until?: string | null;
  due_date?: string | null;
}) {
  const v = d.valid_until ?? d.due_date;
  if ((d.status === "Envoyé" || d.status === "Brouillon") && v && (daysUntil(v) ?? 0) < 0)
    return "Expiré";
  return d.status;
}

function DevisPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const { data: devis, isLoading } = useQuery({
    queryKey: ["factures", companyId, "devis"],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("factures")
        .select("*")
        .eq("company_id", companyId!)
        .eq("type", "devis")
        .order("issue_date", { ascending: false });
      return (data ?? []).map((d): Devis => ({ ...d, status: effectiveStatus(d) }));
    },
  });

  const filtered = useMemo(
    () =>
      (devis ?? []).filter((f) => {
        if (statusFilter && f.status !== statusFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          if (!f.number.toLowerCase().includes(s) && !f.client_name.toLowerCase().includes(s))
            return false;
        }
        return true;
      }),
    [devis, statusFilter, search],
  );

  const kpis = useMemo(() => {
    const list = devis ?? [];
    const sum = (arr: Devis[]) => arr.reduce((s, f) => s + Number(f.subtotal_ht), 0);
    const accepted = list.filter((f) => f.status === "Accepté");
    const pending = list.filter((f) => f.status === "Envoyé" || f.status === "Brouillon");
    const decided = list.filter((f) => ["Accepté", "Refusé", "Expiré"].includes(f.status)).length;
    return {
      total: sum(list),
      accepted: sum(accepted),
      pending: sum(pending),
      pendingCount: pending.length,
      rate: decided ? Math.round((accepted.length / decided) * 100) : 0,
      count: list.length,
    };
  }, [devis]);

  const exportCSV = () => {
    const headers = [
      "Numéro",
      "Client",
      "Date",
      "Validité",
      "HT (€)",
      "TVA (€)",
      "TTC (€)",
      "Statut",
    ];
    const n = (v: number) => Number(v).toFixed(2).replace(".", ",");
    const rows = filtered.map((f) => [
      f.number,
      f.client_name,
      formatDateBE(f.issue_date),
      formatDateBE(f.valid_until ?? f.due_date),
      n(f.subtotal_ht),
      n(f.vat_amount),
      n(f.total_ttc),
      f.status,
    ]);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv =
      "\uFEFF" + [headers, ...rows].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `devis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground">
            TVA belge par ligne (21 % / 6 % / 0 %) et autoliquidation
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
            <Plus className="h-4 w-4" /> Nouveau devis
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Total devisé (HT)"
          value={formatEUR(kpis.total)}
          sub={`${kpis.count} devis`}
          tone="default"
        />
        <KPI label="Accepté (HT)" value={formatEUR(kpis.accepted)} tone="success" />
        <KPI
          label="Devis en attente"
          value={String(kpis.pendingCount)}
          sub={formatEUR(kpis.pending)}
          tone="info"
        />
        <KPI
          label="Taux d'acceptation"
          value={`${kpis.rate} %`}
          tone={kpis.rate >= 50 ? "success" : "danger"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un numéro ou un client…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Tous les statuts</option>
          {DEVIS_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Aucun devis pour le moment.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Numéro</th>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Validité</th>
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateBE(f.valid_until ?? f.due_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatEUR(f.total_ttc)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openNew && (
        <NewDevisModal
          companyId={companyId!}
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

function KPI({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "success" | "info" | "danger";
}) {
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
    Brouillon: "bg-muted text-muted-foreground",
    Envoyé: "bg-info/10 text-info",
    Accepté: "bg-emerald-100 text-emerald-700",
    Refusé: "bg-red-100 text-red-700",
    Expiré: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? "bg-muted"}`}
    >
      {status}
    </span>
  );
}

export function nextDevisNumber(): string {
  const year = new Date().getFullYear();
  return `DEV-${year}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export const plusDays = (n: number, from = new Date()) =>
  new Date(from.getTime() + n * 86400000).toISOString().slice(0, 10);

function NewDevisModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    number: nextDevisNumber(),
    client_id: "",
    client: null as Client | null,
    issue_date: plusDays(0),
    valid_until: plusDays(30),
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client) return toast.error("Sélectionnez un client");
    setSaving(true);
    const { data, error } = await supabase
      .from("factures")
      .insert({
        company_id: companyId,
        type: "devis",
        number: form.number,
        client_id: form.client.id,
        client_name: clientLabel(form.client),
        client_vat: form.client.numero_tva ?? null,
        client_address: clientAddress(form.client) || null,
        issue_date: form.issue_date,
        valid_until: form.valid_until,
        due_date: form.valid_until,
        vat_rate: 21,
        status: "Brouillon",
        conditions: "Devis valable 30 jours. Acompte de 30 % à la commande.",
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Devis créé");
    onCreated(data.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nouveau devis</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client *" full>
            <ClientSelect
              value={form.client_id}
              onChange={(id, c) => setForm({ ...form, client_id: id, client: c })}
            />
          </Field>
          <Field label="Numéro">
            <input
              className={inputCls}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </Field>
          <Field label="Date d'émission">
            <input
              type="date"
              className={inputCls}
              value={form.issue_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  issue_date: e.target.value,
                  valid_until: plusDays(30, new Date(e.target.value)),
                })
              }
            />
          </Field>
          <Field label="Valable jusqu'au">
            <input
              type="date"
              className={inputCls}
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            />
          </Field>
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
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Création…" : "Créer et éditer"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
