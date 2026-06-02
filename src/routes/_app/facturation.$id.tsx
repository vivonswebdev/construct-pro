import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Plus, Trash2, Save, Send, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, formatDateBE } from "@/lib/format";
import { toast } from "sonner";
import { exportFacturePDF } from "@/lib/invoice-pdf";
import { StatusBadge } from "./facturation.index";

export const Route = createFileRoute("/_app/facturation/$id")({
  component: FactureDetail,
});

type Ligne = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_ht: number;
  order_index: number;
  _isNew?: boolean;
};

function FactureDetail() {
  const { id } = Route.useParams();
  const { profile, company } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["facture", id],
    queryFn: async () => {
      const [fRes, lRes] = await Promise.all([
        (supabase.from("factures" as any) as any).select("*").eq("id", id).single(),
        (supabase.from("facture_lignes" as any) as any).select("*").eq("facture_id", id).order("order_index"),
      ]);
      return { facture: fRes.data, lignes: (lRes.data ?? []) as Ligne[] };
    },
  });

  const [facture, setFacture] = useState<any>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  useEffect(() => {
    if (data?.facture) {
      setFacture(data.facture);
      setLignes(data.lignes ?? []);
    }
  }, [data]);

  const totals = useMemo(() => {
    const subtotal = lignes.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
    const vatRate = Number(facture?.vat_rate ?? 21);
    const vat = subtotal * vatRate / 100;
    return { subtotal, vat, total: subtotal + vat, vatRate };
  }, [lignes, facture]);

  if (isLoading || !facture) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const isDevis = facture.type === "devis";

  const addLigne = () => {
    setLignes([
      ...lignes,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unit_price: 0,
        total_ht: 0,
        order_index: lignes.length,
        _isNew: true,
      },
    ]);
  };

  const updateLigne = (idx: number, patch: Partial<Ligne>) => {
    const next = [...lignes];
    next[idx] = { ...next[idx], ...patch };
    next[idx].total_ht = Number(next[idx].quantity) * Number(next[idx].unit_price);
    setLignes(next);
  };

  const removeLigne = (idx: number) => {
    const next = [...lignes];
    next.splice(idx, 1);
    setLignes(next);
  };

  const save = async () => {
    const { error: fErr } = await (supabase.from("factures" as any) as any)
      .update({
        number: facture.number,
        client_name: facture.client_name,
        client_vat: facture.client_vat,
        client_address: facture.client_address,
        issue_date: facture.issue_date,
        due_date: facture.due_date,
        vat_rate: facture.vat_rate,
        subtotal_ht: totals.subtotal,
        vat_amount: totals.vat,
        total_ttc: totals.total,
        notes: facture.notes,
        conditions: facture.conditions,
      })
      .eq("id", id);
    if (fErr) return toast.error(fErr.message);

    // Wipe & reinsert lignes (simpler than diffing)
    await (supabase.from("facture_lignes" as any) as any).delete().eq("facture_id", id);
    if (lignes.length) {
      const payload = lignes.map((l, i) => ({
        facture_id: id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total_ht: Number(l.quantity) * Number(l.unit_price),
        order_index: i,
      }));
      const { error: lErr } = await (supabase.from("facture_lignes" as any) as any).insert(payload);
      if (lErr) return toast.error(lErr.message);
    }
    toast.success("Enregistré");
    qc.invalidateQueries({ queryKey: ["facture", id] });
    qc.invalidateQueries({ queryKey: ["factures"] });
  };

  const setStatus = async (status: string, extra: any = {}) => {
    const { error } = await (supabase.from("factures" as any) as any)
      .update({ status, ...extra })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setFacture({ ...facture, status, ...extra });
    qc.invalidateQueries({ queryKey: ["factures"] });
    toast.success(`Statut: ${status}`);
  };

  const remove = async () => {
    if (!confirm("Supprimer définitivement ce document ?")) return;
    await (supabase.from("facture_lignes" as any) as any).delete().eq("facture_id", id);
    const { error } = await (supabase.from("factures" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    navigate({ to: "/facturation" });
  };

  const downloadPDF = () => {
    exportFacturePDF(
      { ...facture, subtotal_ht: totals.subtotal, vat_amount: totals.vat, total_ttc: totals.total },
      lignes.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        total_ht: Number(l.quantity) * Number(l.unit_price),
      })),
      {
        name: company?.name ?? "Mon entreprise",
        bce_number: company?.bce_number,
        address: company?.address,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/facturation" className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isDevis ? "Devis" : "Facture"} {facture.number}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={facture.status} />
              <span className="text-sm text-muted-foreground">
                Émis le {formatDateBE(facture.issue_date)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            <Download className="h-4 w-4" /> PDF
          </button>
          {facture.status === "Brouillon" && (
            <button onClick={() => setStatus(isDevis ? "Envoyé" : "Envoyée")} className="inline-flex items-center gap-2 rounded-lg bg-info px-3 py-2 text-sm font-semibold text-white hover:bg-info/90">
              <Send className="h-4 w-4" /> Marquer comme envoyé
            </button>
          )}
          {!isDevis && (facture.status === "Envoyée" || facture.status === "En retard") && (
            <button onClick={() => setStatus("Payée", { paid_date: new Date().toISOString().slice(0, 10) })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Marquer payée
            </button>
          )}
          {isDevis && facture.status === "Envoyé" && (
            <>
              <button onClick={() => setStatus("Accepté")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Accepté
              </button>
              <button onClick={() => setStatus("Refusé")} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                <X className="h-4 w-4" /> Refusé
              </button>
            </>
          )}
          <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
          <button onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Client */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom">
              <input className={inputCls} value={facture.client_name ?? ""} onChange={(e) => setFacture({ ...facture, client_name: e.target.value })} />
            </Field>
            <Field label="N° TVA">
              <input className={inputCls} value={facture.client_vat ?? ""} onChange={(e) => setFacture({ ...facture, client_vat: e.target.value })} />
            </Field>
            <Field label="Adresse" full>
              <input className={inputCls} value={facture.client_address ?? ""} onChange={(e) => setFacture({ ...facture, client_address: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Détails</h3>
          <div className="space-y-3">
            <Field label="Numéro">
              <input className={inputCls} value={facture.number ?? ""} onChange={(e) => setFacture({ ...facture, number: e.target.value })} />
            </Field>
            <Field label="Date d'émission">
              <input type="date" className={inputCls} value={facture.issue_date ?? ""} onChange={(e) => setFacture({ ...facture, issue_date: e.target.value })} />
            </Field>
            <Field label={isDevis ? "Validité" : "Échéance"}>
              <input type="date" className={inputCls} value={facture.due_date ?? ""} onChange={(e) => setFacture({ ...facture, due_date: e.target.value })} />
            </Field>
            <Field label="Taux TVA">
              <select className={inputCls} value={facture.vat_rate} onChange={(e) => setFacture({ ...facture, vat_rate: Number(e.target.value) })}>
                <option value={21}>21 %</option>
                <option value={6}>6 % (rénovation)</option>
                <option value={12}>12 %</option>
                <option value={0}>0 % (cocontractant)</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lignes</h3>
          <button onClick={addLigne} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Description</th>
                <th className="px-3 py-2 text-right font-semibold w-24">Qté</th>
                <th className="px-3 py-2 text-right font-semibold w-32">Prix unit.</th>
                <th className="px-3 py-2 text-right font-semibold w-32">Total HT</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune ligne. Cliquez sur "Ajouter".</td></tr>
              ) : lignes.map((l, i) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input className={inputCls} value={l.description} onChange={(e) => updateLigne(i, { description: e.target.value })} placeholder="Description du service ou produit" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" className={`${inputCls} text-right`} value={l.quantity} onChange={(e) => updateLigne(i, { quantity: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" className={`${inputCls} text-right`} value={l.unit_price} onChange={(e) => updateLigne(i, { unit_price: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatEUR(Number(l.quantity) * Number(l.unit_price))}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeLigne(i)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Totaux */}
        <div className="border-t border-border p-5">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Sous-total HT</span><span className="font-medium">{formatEUR(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA {totals.vatRate}%</span><span className="font-medium">{formatEUR(totals.vat)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total TTC</span><span className="text-primary">{formatEUR(totals.total)}</span></div>
          </div>
        </div>
      </div>

      {/* Notes & conditions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
          <textarea
            rows={4}
            className={inputCls}
            value={facture.notes ?? ""}
            onChange={(e) => setFacture({ ...facture, notes: e.target.value })}
            placeholder="Notes internes ou message au client"
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Conditions générales</h3>
          <textarea
            rows={4}
            className={inputCls}
            value={facture.conditions ?? ""}
            onChange={(e) => setFacture({ ...facture, conditions: e.target.value })}
            placeholder="Conditions de paiement, pénalités de retard…"
          />
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
