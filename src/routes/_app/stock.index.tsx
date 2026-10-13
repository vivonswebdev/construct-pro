import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Package,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  AlertTriangle,
  X,
  Search,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE } from "@/lib/format";
import { toast } from "sonner";
import { backdropClose } from "@/lib/modal";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/lib/i18n";
import { toCode } from "@/lib/statuts";

export const Route = createFileRoute("/_app/stock/")({
  component: StockPage,
});

type Materiau = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  unit_price: number;
  stock_quantity: number;
  min_stock: number;
  supplier: string | null;
  category: string | null;
};

type Mouvement = {
  id: string;
  materiau_id: string;
  chantier_id: string | null;
  type: string;
  quantity: number;
  unit_price: number;
  total: number;
  date: string;
  supplier: string | null;
  reference: string | null;
  notes: string | null;
};

function StockPage() {
  const { t } = useTranslation(["stock", "statuts", "common"]);
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"catalog" | "mouvements">("catalog");
  const [search, setSearch] = useState("");
  const [showMatModal, setShowMatModal] = useState(false);
  const [showMvtModal, setShowMvtModal] = useState<{ type: "achat" | "sortie" | "retour" } | null>(
    null,
  );

  const { data, isLoading } = useQuery({
    queryKey: ["stock", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const [mRes, mvRes, chRes] = await Promise.all([
        supabase.from("materiaux").select("*").order("name"),
        supabase
          .from("stock_mouvements")
          .select("*")
          .order("date", { ascending: false })
          .limit(200),
        supabase.from("chantiers").select("id, name").order("name"),
      ]);
      return {
        materiaux: (mRes.data ?? []) as unknown as Materiau[],
        mouvements: (mvRes.data ?? []) as unknown as Mouvement[],
        chantiers: chRes.data ?? [],
      };
    },
  });

  const materiaux = data?.materiaux ?? [];
  const mouvements = data?.mouvements ?? [];
  const chantiers = data?.chantiers ?? [];

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return materiaux.filter(
      (m) => !s || m.name.toLowerCase().includes(s) || (m.sku ?? "").toLowerCase().includes(s),
    );
  }, [materiaux, search]);

  const lowStock = materiaux.filter(
    (m) => Number(m.stock_quantity) <= Number(m.min_stock) && Number(m.min_stock) > 0,
  );
  const stockValue = materiaux.reduce(
    (s, m) => s + Number(m.stock_quantity) * Number(m.unit_price),
    0,
  );
  const totalAchats = mouvements
    .filter((m) => m.type === "achat")
    .reduce((s, m) => s + Number(m.total), 0);
  const totalSorties = mouvements
    .filter((m) => m.type === "sortie")
    .reduce((s, m) => s + Number(m.total), 0);

  const exportCSV = () => {
    const chMap = new Map(chantiers.map((c) => [c.id, c.name]));
    const matMap = new Map(materiaux.map((m) => [m.id, m]));
    const rows = [
      [
        t("columns.date"),
        t("columns.type"),
        t("columns.material"),
        t("columns.sku"),
        t("columns.qty"),
        t("columns.unit"),
        t("columns.unitPrice"),
        t("columns.total"),
        t("columns.site"),
        t("columns.supplier"),
        t("columns.reference"),
      ],
      ...mouvements.map((m) => {
        const mat = matMap.get(m.materiau_id);
        return [
          formatDateBE(m.date),
          t(`statuts:mouvement.${toCode(m.type)}`, { defaultValue: m.type }),
          mat?.name ?? "",
          mat?.sku ?? "",
          String(m.quantity).replace(".", ","),
          mat?.unit ?? "",
          String(m.unit_price).replace(".", ","),
          String(m.total).replace(".", ","),
          m.chantier_id ? (chMap.get(m.chantier_id) ?? "") : "",
          m.supplier ?? "",
          m.reference ?? "",
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("csvFileName")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-primary" /> {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/30"
          >
            <Download className="h-4 w-4" /> {t("exportCsv")}
          </button>
          <button
            onClick={() => setShowMvtModal({ type: "achat" })}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <ArrowDownToLine className="h-4 w-4" /> {t("purchase")}
          </button>
          <button
            onClick={() => setShowMvtModal({ type: "sortie" })}
            className="inline-flex items-center gap-2 rounded-lg bg-info px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <ArrowUpFromLine className="h-4 w-4" /> {t("issueSlip")}
          </button>
          <button
            onClick={() => setShowMatModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("newMaterial")}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("kpi.references")} value={String(materiaux.length)} />
        <Kpi label={t("kpi.stockValue")} value={formatEUR(stockValue)} />
        <Kpi label={t("kpi.recentPurchases")} value={formatEUR(totalAchats)} tone="info" />
        <Kpi label={t("kpi.siteIssues")} value={formatEUR(totalSorties)} tone="warn" />
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {t("lowStock", { count: lowStock.length })}
            </p>
            <p className="mt-1 text-amber-800">
              {lowStock
                .slice(0, 5)
                .map((m) => `${m.name} (${m.stock_quantity} ${m.unit})`)
                .join(" · ")}
              {lowStock.length > 5 && ` · +${lowStock.length - 5}`}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["catalog", "mouvements"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-4 py-2 text-sm font-semibold transition ${tab === k ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {k === "catalog" ? t("tabs.catalog") : t("tabs.movements")}
            {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-b-xl bg-muted/30" />
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("noMaterial")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("columns.name")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.sku")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.stock")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.unitPrice")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.value")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.supplier")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const low =
                    Number(m.stock_quantity) <= Number(m.min_stock) && Number(m.min_stock) > 0;
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{m.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {m.sku ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={low ? "font-semibold text-amber-600" : ""}>
                          {Number(m.stock_quantity).toLocaleString(intlLocale())} {m.unit}
                        </span>
                        {low && <AlertTriangle className="ml-1 inline h-3 w-3 text-amber-600" />}
                      </td>
                      <td className="px-4 py-2 text-right">{formatEUR(m.unit_price)}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatEUR(Number(m.stock_quantity) * Number(m.unit_price))}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{m.supplier ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "mouvements" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {mouvements.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t("noMovement")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("columns.date")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.type")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.material")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.qty")}</th>
                  <th className="px-4 py-2 text-right">{t("columns.total")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.site")}</th>
                  <th className="px-4 py-2 text-left">{t("columns.supplierRef")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((m) => {
                  const mat = materiaux.find((x) => x.id === m.materiau_id);
                  const ch = chantiers.find((c) => c.id === m.chantier_id);
                  return (
                    <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-2">{formatDateBE(m.date)}</td>
                      <td className="px-4 py-2">
                        <TypeBadge type={m.type} />
                      </td>
                      <td className="px-4 py-2 font-medium">{mat?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {Number(m.quantity).toLocaleString(intlLocale())} {mat?.unit}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{formatEUR(m.total)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ch?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {m.supplier ?? "—"}
                        {m.reference ? ` · ${m.reference}` : ""}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={async () => {
                            if (!confirm(t("confirmDeleteMovement"))) return;
                            const { error } = await supabase
                              .from("stock_mouvements")
                              .delete()
                              .eq("id", m.id);
                            if (error) toast.error(error.message);
                            else {
                              toast.success(t("common:toasts.deleted"));
                              qc.invalidateQueries({ queryKey: ["stock"] });
                              qc.invalidateQueries({ queryKey: ["chantier"] });
                            }
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger"
                          title={t("common:actions.delete")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showMatModal && (
        <MateriauModal onClose={() => setShowMatModal(false)} companyId={profile!.company_id!} />
      )}
      {showMvtModal && (
        <MouvementModal
          type={showMvtModal.type}
          materiaux={materiaux}
          chantiers={chantiers}
          companyId={profile!.company_id!}
          onClose={() => setShowMvtModal(null)}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "info" | "warn" }) {
  const color =
    tone === "info" ? "text-info" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    achat: "bg-emerald-100 text-emerald-700",
    sortie: "bg-cyan-100 text-cyan-700",
    retour: "bg-amber-100 text-amber-700",
  };
  const { t } = useTranslation("statuts");
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[type] ?? "bg-muted"}`}
    >
      {t(`mouvement.${toCode(type)}`, { defaultValue: type })}
    </span>
  );
}

function MateriauModal({ onClose, companyId }: { onClose: () => void; companyId: string }) {
  const { t } = useTranslation(["stock", "common"]);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: t("materialForm.defaultUnit"),
    unit_price: 0,
    stock_quantity: 0,
    min_stock: 0,
    supplier: "",
    category: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) {
      toast.error(t("validation.nameRequired"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("materiaux").insert({
      ...form,
      sku: form.sku || null,
      supplier: form.supplier || null,
      category: form.category || null,
      company_id: companyId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("toasts.materialCreated"));
    qc.invalidateQueries({ queryKey: ["stock"] });
    onClose();
  };

  return (
    <Modal title={t("newMaterial")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("materialForm.name")}>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("materialForm.sku")}>
            <input
              className={inputCls}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>
          <Field label={t("materialForm.unit")}>
            <input
              className={inputCls}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("materialForm.unitPrice")}>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("materialForm.initialStock")}>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("materialForm.minStock")}>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("materialForm.supplier")}>
            <input
              className={inputCls}
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </Field>
          <Field label={t("materialForm.category")}>
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {t("common:actions.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MouvementModal({
  type,
  materiaux,
  chantiers,
  companyId,
  onClose,
}: {
  type: "achat" | "sortie" | "retour";
  materiaux: Materiau[];
  chantiers: { id: string; name: string }[];
  companyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["stock", "common"]);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    materiau_id: materiaux[0]?.id ?? "",
    chantier_id: "",
    quantity: 1,
    unit_price: materiaux[0]?.unit_price ?? 0,
    date: new Date().toISOString().slice(0, 10),
    supplier: "",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const mat = materiaux.find((m) => m.id === form.materiau_id);
  const total = Number(form.quantity) * Number(form.unit_price);
  const labels = { achat: t("purchase"), sortie: t("issueSlip"), retour: t("return") };

  const save = async () => {
    if (!form.materiau_id) {
      toast.error(t("validation.materialRequired"));
      return;
    }
    if (type === "sortie" && !form.chantier_id) {
      toast.error(t("validation.siteRequiredForIssue"));
      return;
    }
    if (type === "sortie" && mat && Number(form.quantity) > Number(mat.stock_quantity)) {
      if (!confirm(t("validation.insufficientStock", { qty: mat.stock_quantity, unit: mat.unit })))
        return;
    }
    setSaving(true);
    const { error } = await supabase.from("stock_mouvements").insert({
      company_id: companyId,
      materiau_id: form.materiau_id,
      chantier_id: form.chantier_id || null,
      type,
      quantity: form.quantity,
      unit_price: form.unit_price,
      total,
      date: form.date,
      supplier: form.supplier || null,
      reference: form.reference || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("toasts.movementSaved", { label: labels[type] }));
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["chantier"] });
    onClose();
  };

  return (
    <Modal title={labels[type]} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("movementForm.material")}>
          <select
            className={inputCls}
            value={form.materiau_id}
            onChange={(e) => {
              const m = materiaux.find((x) => x.id === e.target.value);
              setForm({
                ...form,
                materiau_id: e.target.value,
                unit_price: m?.unit_price ?? form.unit_price,
              });
            }}
          >
            <option value="">{t("movementForm.choose")}</option>
            {materiaux.map((m) => (
              <option key={m.id} value={m.id}>
                {t("movementForm.materialOption", {
                  name: m.name,
                  qty: Number(m.stock_quantity),
                  unit: m.unit,
                })}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            type === "sortie" ? t("movementForm.siteRequired") : t("movementForm.siteOptional")
          }
        >
          <select
            className={inputCls}
            value={form.chantier_id}
            onChange={(e) => setForm({ ...form, chantier_id: e.target.value })}
          >
            <option value="">{t("movementForm.none")}</option>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("movementForm.quantity", { unit: mat?.unit ?? "" })}>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("movementForm.unitPrice")}>
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("movementForm.date")}>
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
        </div>
        {type === "achat" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("movementForm.supplier")}>
              <input
                className={inputCls}
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </Field>
            <Field label={t("movementForm.invoiceRef")}>
              <input
                className={inputCls}
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </Field>
          </div>
        )}
        <Field label={t("movementForm.notes")}>
          <textarea
            rows={2}
            className={inputCls}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
          <span className="text-sm font-medium">{t("movementForm.total")}</span>
          <span className="text-lg font-bold text-primary">{formatEUR(total)}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">
            {t("common:actions.cancel")}
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {type === "achat" && <ArrowDownToLine className="h-4 w-4" />}
            {type === "sortie" && <ArrowUpFromLine className="h-4 w-4" />}
            {type === "retour" && <RotateCcw className="h-4 w-4" />}
            {t("common:actions.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      {...backdropClose(onClose)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
