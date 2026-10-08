import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  X,
  Copy,
  HardHat,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE } from "@/lib/format";
import { toast } from "sonner";
import {
  exportFacturePDF,
  langueDocument,
  mentionAttestation6,
  mentionAutoliquidation,
} from "@/lib/invoice-pdf";
import { useTranslation } from "react-i18next";
import { pageHead } from "@/lib/head";
import { nomsPhasesParDefaut } from "@/lib/chantiers";
import { toCode } from "@/lib/statuts";
import { StatusBadge, effectiveStatus, nextDevisNumber, plusDays } from "./facturation.index";
import { ClientSelect } from "@/components/ClientSelect";
import { clientLabel, clientAddress, type Client } from "@/lib/clients";

export const Route = createFileRoute("/_app/facturation/$id")({
  head: () => pageHead("devisDetail"),
  component: DevisDetail,
});

type Ligne = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  order_index: number;
};

function DevisDetail() {
  const { t } = useTranslation(["devis", "statuts", "common"]);
  const { t: tChantiers } = useTranslation("chantiers");
  const { id } = Route.useParams();
  const { profile, company } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["facture", id],
    queryFn: async () => {
      const [fRes, lRes] = await Promise.all([
        supabase.from("factures").select("*").eq("id", id).single(),
        supabase.from("facture_lignes").select("*").eq("facture_id", id).order("order_index"),
      ]);
      const f = fRes.data;
      let client: Client | null = null;
      if (f?.client_id)
        client = (await supabase.from("clients").select("*").eq("id", f.client_id).maybeSingle())
          .data as Client | null;
      const lignes: Ligne[] = lRes.data ?? [];
      return { facture: f, lignes, client };
    },
  });

  const [f, setF] = useState<Tables<"factures"> | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  useEffect(() => {
    if (data?.facture) {
      setF(data.facture);
      setLignes(data.lignes ?? []);
      setClient(data.client);
    }
  }, [data]);

  const totals = useMemo(() => {
    const subtotal = lignes.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
    const byRate: Record<number, { base: number; vat: number }> = {};
    for (const l of lignes) {
      const rate = f?.autoliquidation ? 0 : Number(l.vat_rate);
      const base = Number(l.quantity) * Number(l.unit_price);
      byRate[rate] ??= { base: 0, vat: 0 };
      byRate[rate].base += base;
      byRate[rate].vat += (base * rate) / 100;
    }
    const vat = Object.values(byRate).reduce((s, r) => s + r.vat, 0);
    return { subtotal, vat, total: subtotal + vat, byRate };
  }, [lignes, f]);

  if (isLoading || !f) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

  const status = effectiveStatus(f);
  const has6 = !f.autoliquidation && lignes.some((l) => Number(l.vat_rate) === 6);
  // Les documents officiels sortent dans la langue du client (fr / nl / en).
  const docLang = langueDocument(client?.langue);
  const canAutoliq = !!client?.assujetti_tva;

  const updateLigne = (idx: number, patch: Partial<Ligne>) => {
    const next = [...lignes];
    next[idx] = { ...next[idx], ...patch };
    setLignes(next);
  };

  const persist = async (quiet = false) => {
    const mainRate = f.autoliquidation ? 0 : Number(lignes[0]?.vat_rate ?? 21);
    const { error } = await supabase
      .from("factures")
      .update({
        number: f.number,
        client_id: f.client_id,
        client_name: f.client_name,
        client_vat: f.client_vat,
        client_address: f.client_address,
        issue_date: f.issue_date,
        valid_until: f.valid_until,
        due_date: f.valid_until,
        vat_rate: mainRate,
        subtotal_ht: totals.subtotal,
        vat_amount: totals.vat,
        total_ttc: totals.total,
        autoliquidation: !!f.autoliquidation,
        attestation_6: has6 && !!f.attestation_6,
        notes: f.notes,
        conditions: f.conditions,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await supabase.from("facture_lignes").delete().eq("facture_id", id);
    if (lignes.length) {
      const { error: lErr } = await supabase.from("facture_lignes").insert(
        lignes.map((l, i) => ({
          facture_id: id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          vat_rate: f.autoliquidation ? 0 : l.vat_rate,
          total_ht: Number(l.quantity) * Number(l.unit_price),
          order_index: i,
        })),
      );
      if (lErr) {
        toast.error(lErr.message);
        return false;
      }
    }
    if (!quiet) toast.success(t("toasts.saved"));
    qc.invalidateQueries({ queryKey: ["facture", id] });
    qc.invalidateQueries({ queryKey: ["factures"] });
    return true;
  };

  const setStatus = async (s: string) => {
    const { error } = await supabase.from("factures").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    setF({ ...f, status: s });
    qc.invalidateQueries({ queryKey: ["factures"] });
    toast.success(
      t("toasts.statusChanged", { status: t(`statuts:devis.${toCode(s)}`, { defaultValue: s }) }),
    );
  };

  const duplicate = async () => {
    const { id: _i, created_at: _c, ...rest } = f;
    const { data: copy, error } = await supabase
      .from("factures")
      .insert({
        ...rest,
        number: nextDevisNumber(),
        status: "brouillon",
        chantier_id: null,
        issue_date: plusDays(0),
        valid_until: plusDays(30),
        due_date: plusDays(30),
        subtotal_ht: totals.subtotal,
        vat_amount: totals.vat,
        total_ttc: totals.total,
      })
      .select()
      .single();
    if (error || !copy) return toast.error(error?.message ?? t("common:errors.generic"));
    if (lignes.length)
      await supabase.from("facture_lignes").insert(
        lignes.map((l, i) => ({
          facture_id: copy.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          vat_rate: l.vat_rate,
          total_ht: Number(l.quantity) * Number(l.unit_price),
          order_index: i,
        })),
      );
    qc.invalidateQueries({ queryKey: ["factures"] });
    toast.success(t("toasts.duplicated"));
    navigate({ to: "/facturation/$id", params: { id: copy.id } });
  };

  const createChantier = async () => {
    if (!profile?.company_id) return;
    const name = prompt(
      t("detail.siteNamePrompt"),
      lignes[0]?.description
        ? `${f.client_name} — ${lignes[0].description}`
        : t("detail.siteNameDefault", { client: f.client_name }),
    );
    if (!name) return;
    const { data: ch, error } = await supabase
      .from("chantiers")
      .insert({
        company_id: profile.company_id,
        name,
        client_id: f.client_id,
        client_name: f.client_name,
        address: f.client_address,
        budget: totals.subtotal,
        actual_costs: 0,
        status: "en_attente",
        progress: 0,
        start_date: plusDays(14),
        description: t("detail.siteDescription", { number: f.number }),
      })
      .select()
      .single();
    if (error || !ch) return toast.error(error?.message ?? t("common:errors.generic"));
    await supabase.from("etapes").insert(
      nomsPhasesParDefaut(tChantiers).map((n, i) => ({
        chantier_id: ch.id,
        name: n,
        order_index: i,
        status: "en_attente",
        progress: 0,
      })),
    );
    await supabase.from("factures").update({ chantier_id: ch.id }).eq("id", id);
    qc.invalidateQueries();
    toast.success(t("toasts.siteCreated"));
    navigate({ to: "/chantiers/$id", params: { id: ch.id } });
  };

  const remove = async () => {
    if (!confirm(t("detail.confirmDelete"))) return;
    await supabase.from("facture_lignes").delete().eq("facture_id", id);
    const { error } = await supabase.from("factures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("toasts.deleted"));
    navigate({ to: "/facturation" });
  };

  const downloadPDF = () => {
    exportFacturePDF(
      {
        ...f,
        status,
        due_date: f.valid_until ?? f.due_date,
        subtotal_ht: totals.subtotal,
        vat_amount: totals.vat,
        total_ttc: totals.total,
        attestation_6: has6 && !!f.attestation_6,
      },
      lignes.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        vat_rate: f.autoliquidation ? 0 : Number(l.vat_rate),
        total_ht: Number(l.quantity) * Number(l.unit_price),
      })),
      {
        name: company?.name ?? t("detail.defaultCompany"),
        bce_number: company?.bce_number,
        address: company?.address,
      },
      totals.byRate,
      docLang,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/facturation" className="rounded-lg p-2 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("detail.title", { number: f.number })}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-sm text-muted-foreground">
                {t("detail.issued", {
                  issue: formatDateBE(f.issue_date),
                  until: formatDateBE(f.valid_until ?? f.due_date),
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadPDF}
            className={btnGhost}
            title={t("detail.pdfLanguage", { language: t(`statuts:langue.${docLang}`) })}
          >
            <Download className="h-4 w-4" /> {t("detail.pdf")} ({docLang.toUpperCase()})
          </button>
          <button onClick={duplicate} className={btnGhost}>
            <Copy className="h-4 w-4" /> {t("detail.duplicate")}
          </button>
          {status === "brouillon" && (
            <button
              onClick={async () => {
                if (await persist(true)) setStatus("envoye");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-info px-3 py-2 text-sm font-semibold text-white hover:bg-info/90"
            >
              <Send className="h-4 w-4" /> {t("detail.markSent")}
            </button>
          )}
          {status === "envoye" && (
            <>
              <button
                onClick={() => setStatus("accepte")}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" /> {t("detail.accepted")}
              </button>
              <button
                onClick={() => setStatus("refuse")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <X className="h-4 w-4" /> {t("detail.refused")}
              </button>
            </>
          )}
          {status === "accepte" &&
            (f.chantier_id ? (
              <Link to="/chantiers/$id" params={{ id: f.chantier_id }} className={btnGhost}>
                <HardHat className="h-4 w-4" /> {t("detail.viewSite")}
              </Link>
            ) : (
              <button
                onClick={createChantier}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <HardHat className="h-4 w-4" /> {t("detail.createSite")}
              </button>
            ))}
          <button
            onClick={() => persist()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Save className="h-4 w-4" /> {t("detail.save")}
          </button>
          <button
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.client")}
          </h3>
          <ClientSelect
            value={f.client_id ?? ""}
            onChange={(cid, c) => {
              setClient(c);
              setF({
                ...f,
                client_id: cid || null,
                client_name: clientLabel(c) || f.client_name,
                client_vat: c?.numero_tva ?? null,
                client_address: clientAddress(c) || null,
                autoliquidation: c?.assujetti_tva ? f.autoliquidation : false,
              });
            }}
          />
          {client && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p>{clientAddress(client)}</p>
              {client.numero_tva && (
                <p>
                  {t("detail.clientVat", { value: client.numero_tva })}{" "}
                  {client.assujetti_tva && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {t("detail.vatLiable")}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          {canAutoliq && (
            <label className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!f.autoliquidation}
                onChange={(e) => setF({ ...f, autoliquidation: e.target.checked })}
              />
              <span>
                <span className="font-semibold">{t("detail.reverseCharge")}</span> —{" "}
                {t("detail.reverseChargeHelp", { mention: mentionAutoliquidation(docLang) })}
              </span>
            </label>
          )}
          {has6 && (
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!f.attestation_6}
                onChange={(e) => setF({ ...f, attestation_6: e.target.checked })}
              />
              <span>{mentionAttestation6(docLang)}</span>
            </label>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.details")}
          </h3>
          <div className="space-y-3">
            <Field label={t("form.number")}>
              <input
                className={inputCls}
                value={f.number ?? ""}
                onChange={(e) => setF({ ...f, number: e.target.value })}
              />
            </Field>
            <Field label={t("form.issueDate")}>
              <input
                type="date"
                className={inputCls}
                value={f.issue_date ?? ""}
                onChange={(e) => setF({ ...f, issue_date: e.target.value })}
              />
            </Field>
            <Field label={t("form.validUntil")}>
              <input
                type="date"
                className={inputCls}
                value={f.valid_until ?? f.due_date ?? ""}
                onChange={(e) => setF({ ...f, valid_until: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.lines")}
          </h3>
          <button
            onClick={() =>
              setLignes([
                ...lignes,
                {
                  id: crypto.randomUUID(),
                  description: "",
                  quantity: 1,
                  unit_price: 0,
                  vat_rate: 21,
                  order_index: lignes.length,
                },
              ])
            }
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> {t("detail.addLine")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("columnsLines.description")}
                </th>
                <th className="w-24 px-3 py-2 text-right font-semibold">{t("columnsLines.qty")}</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">
                  {t("columnsLines.unitPrice")}
                </th>
                <th className="w-28 px-3 py-2 text-right font-semibold">{t("columnsLines.vat")}</th>
                <th className="w-32 px-3 py-2 text-right font-semibold">
                  {t("columnsLines.totalExcl")}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {t("detail.noLines")}
                  </td>
                </tr>
              ) : (
                lignes.map((l, i) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        className={inputCls}
                        value={l.description}
                        onChange={(e) => updateLigne(i, { description: e.target.value })}
                        placeholder={t("detail.linePlaceholder")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        className={`${inputCls} text-right`}
                        value={l.quantity}
                        onChange={(e) => updateLigne(i, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        className={`${inputCls} text-right`}
                        value={l.unit_price}
                        onChange={(e) => updateLigne(i, { unit_price: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!!f.autoliquidation}
                        className={`${inputCls} text-right`}
                        value={f.autoliquidation ? 0 : l.vat_rate}
                        onChange={(e) => updateLigne(i, { vat_rate: Number(e.target.value) })}
                      >
                        <option value={21}>21 %</option>
                        <option value={6}>6 %</option>
                        <option value={0}>0 %</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEUR(Number(l.quantity) * Number(l.unit_price))}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border p-5">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("detail.subtotalExcl")}</span>
              <span className="font-medium">{formatEUR(totals.subtotal)}</span>
            </div>
            {Object.entries(totals.byRate)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([rate, r]) => (
                <div key={rate} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("detail.vatOn", { rate, base: formatEUR(r.base) })}
                  </span>
                  <span className="font-medium">{formatEUR(r.vat)}</span>
                </div>
              ))}
            {f.autoliquidation && (
              <p className="text-xs italic text-muted-foreground">
                {mentionAutoliquidation(docLang)}
              </p>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>{t("detail.totalIncl")}</span>
              <span className="text-primary">{formatEUR(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.notes")}
          </h3>
          <textarea
            rows={4}
            className={inputCls}
            value={f.notes ?? ""}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            placeholder={t("detail.notesPlaceholder")}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detail.conditions")}
          </h3>
          <textarea
            rows={4}
            className={inputCls}
            value={f.conditions ?? ""}
            onChange={(e) => setF({ ...f, conditions: e.target.value })}
            placeholder={t("detail.conditionsPlaceholder")}
          />
        </div>
      </div>
    </div>
  );
}

const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted";
const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
