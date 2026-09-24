import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Landmark,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  formatEURBE,
  quarterOfMonth,
  onssDueDate,
  precompteDueDate,
  DEFAULTS,
  MONTHS_FR,
} from "@/lib/belgian";
import { formatDateBE, initials, avatarColor } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/precompte")({
  component: PrecomptePage,
});

type PayKind = "salary" | "precompte" | "onss";

function PrecomptePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const companyId = profile?.company_id;
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [showSettings, setShowSettings] = useState(false);
  const [rates, setRates] = useState(DEFAULTS);
  const [payModal, setPayModal] = useState<{
    kind: PayKind;
    personName: string;
    defaultAmount: number;
    personnelId: string;
    existingId?: string;
  } | null>(null);

  const quarter = quarterOfMonth(period.month);
  const onssDue = onssDueDate(quarter, period.year);
  const precompteDue = precompteDueDate(period.month, period.year);

  const { data } = useQuery({
    queryKey: ["precompte", companyId, period.year, period.month, quarter],
    enabled: !!companyId,
    queryFn: async () => {
      const [pers, sal, prec, onss, aff] = await Promise.all([
        supabase.from("personnel").select("*").eq("company_id", companyId!).eq("status", "Actif"),
        supabase
          .from("salary_payments")
          .select("*")
          .eq("company_id", companyId!)
          .eq("period_year", period.year)
          .eq("period_month", period.month + 1),
        supabase
          .from("precompte_payments")
          .select("*")
          .eq("company_id", companyId!)
          .eq("period_year", period.year)
          .eq("period_month", period.month + 1),
        supabase
          .from("onss_payments")
          .select("*")
          .eq("company_id", companyId!)
          .eq("year", period.year)
          .eq("quarter", quarter),
        supabase.from("affectations").select("personnel_id, chantiers(name)").is("end_date", null),
      ]);
      return {
        personnel: (pers.data ?? []).filter((p) =>
          ["CDI", "CDD", "Intérim"].includes(p.contract_type ?? ""),
        ),
        salaries: sal.data ?? [],
        precomptes: prec.data ?? [],
        onss: onss.data ?? [],
        affectations: aff.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.personnel.map((p) => {
      const sal = data.salaries.find((s) => s.personnel_id === p.id);
      const prec = data.precomptes.find((s) => s.personnel_id === p.id);
      const onss = data.onss.find((s) => s.personnel_id === p.id);
      const aff = data.affectations.find((a) => a.personnel_id === p.id);
      const defaultGross = Number(p.hourly_rate ?? 20) * 8 * 22;
      const defaultNet = defaultGross * (1 - rates.precompteRate - rates.onssEmployeeRate);
      const defaultPrec = defaultGross * rates.precompteRate;
      const defaultOnss = defaultGross * 3 * (rates.onssEmployerRate + rates.onssEmployeeRate);
      return {
        person: p,
        chantierName: (aff as any)?.chantiers?.name ?? "—",
        salary: { row: sal, defaultGross, defaultNet },
        precompte: { row: prec, defaultAmount: defaultPrec },
        onss: { row: onss, defaultAmount: defaultOnss },
      };
    });
  }, [data, rates]);

  const stats = useMemo(() => {
    const total = rows.length || 1;
    const salPaid = rows.filter((r) => r.salary.row?.paid).length;
    const precPaid = rows.filter((r) => r.precompte.row?.paid).length;
    const onssPaid = rows.filter((r) => r.onss.row?.paid).length;
    const unpaid = rows.reduce((s, r) => {
      let n = 0;
      if (!r.salary.row?.paid)
        n += r.salary.row ? Number(r.salary.row.net_amount ?? 0) : r.salary.defaultNet;
      if (!r.precompte.row?.paid)
        n += r.precompte.row ? Number(r.precompte.row.amount ?? 0) : r.precompte.defaultAmount;
      if (!r.onss.row?.paid)
        n += r.onss.row ? Number(r.onss.row.amount ?? 0) : r.onss.defaultAmount;
      return s + n;
    }, 0);
    return {
      salPaid,
      precPaid,
      onssPaid,
      total: rows.length,
      totalUnpaid: unpaid,
      anyOnssPaid: onssPaid > 0 && onssPaid === total,
    };
  }, [rows]);

  const confirmPayment = async (paidDate: string, reference: string, amount: number) => {
    if (!payModal || !companyId) return;
    const { kind, personnelId } = payModal;
    let error: any = null;
    if (kind === "salary") {
      const gross = rows.find((r) => r.person.id === personnelId)!.salary.defaultGross;
      const res = await supabase.from("salary_payments").upsert(
        {
          company_id: companyId,
          personnel_id: personnelId,
          period_month: period.month + 1,
          period_year: period.year,
          gross_amount: gross,
          net_amount: amount,
          paid: true,
          paid_date: paidDate,
          reference,
          payment_method: "Virement",
        },
        { onConflict: "personnel_id,period_month,period_year" },
      );
      error = res.error;
    } else if (kind === "precompte") {
      const res = await supabase.from("precompte_payments").upsert(
        {
          company_id: companyId,
          personnel_id: personnelId,
          period_month: period.month + 1,
          period_year: period.year,
          amount,
          paid: true,
          paid_date: paidDate,
          reference,
          due_date: precompteDue.toISOString().slice(0, 10),
        },
        { onConflict: "personnel_id,period_month,period_year" },
      );
      error = res.error;
    } else {
      const res = await supabase.from("onss_payments").upsert(
        {
          company_id: companyId,
          personnel_id: personnelId,
          quarter,
          year: period.year,
          amount,
          paid: true,
          paid_date: paidDate,
          reference,
          due_date: onssDue.toISOString().slice(0, 10),
        },
        { onConflict: "personnel_id,quarter,year" },
      );
      error = res.error;
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Paiement enregistré");
      setPayModal(null);
      qc.invalidateQueries({ queryKey: ["precompte"] });
    }
  };

  const cancelPayment = async (kind: PayKind, rowId: string) => {
    const table =
      kind === "salary"
        ? "salary_payments"
        : kind === "precompte"
          ? "precompte_payments"
          : "onss_payments";
    const { error } = await supabase
      .from(table)
      .update({ paid: false, paid_date: null, reference: null })
      .eq("id", rowId);
    if (error) toast.error(error.message);
    else {
      toast.success("Paiement annulé");
      qc.invalidateQueries({ queryKey: ["precompte"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Précompte & ONSS</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des obligations sociales et fiscales par ouvrier
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setPeriod((p) => ({
                year: p.month === 0 ? p.year - 1 : p.year,
                month: p.month === 0 ? 11 : p.month - 1,
              }))
            }
            className="rounded-md border border-border p-1.5 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] rounded-md border border-border bg-card px-3 py-1.5 text-center text-sm font-semibold">
            {MONTHS_FR[period.month]} {period.year}
          </span>
          <button
            onClick={() =>
              setPeriod((p) => ({
                year: p.month === 11 ? p.year + 1 : p.year,
                month: p.month === 11 ? 0 : p.month + 1,
              }))
            }
            className="rounded-md border border-border p-1.5 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="rounded-md border border-border p-1.5 hover:bg-muted"
            title="Paramètres des taux"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">
            Paramètres des taux (CP 124 construction par défaut)
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <RateInput
              label="Précompte professionnel"
              value={rates.precompteRate}
              onChange={(v) => setRates((r) => ({ ...r, precompteRate: v }))}
            />
            <RateInput
              label="ONSS travailleur"
              value={rates.onssEmployeeRate}
              onChange={(v) => setRates((r) => ({ ...r, onssEmployeeRate: v }))}
            />
            <RateInput
              label="ONSS employeur"
              value={rates.onssEmployerRate}
              onChange={(v) => setRates((r) => ({ ...r, onssEmployerRate: v }))}
            />
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard
          label="Salaires payés"
          value={`${stats.salPaid}/${stats.total}`}
          tone={
            stats.salPaid === stats.total ? "success" : stats.salPaid > 0 ? "warning" : "danger"
          }
        />
        <KpiCard
          label="Précompte payé"
          value={`${stats.precPaid}/${stats.total}`}
          tone={
            stats.precPaid === stats.total ? "success" : stats.precPaid > 0 ? "warning" : "danger"
          }
        />
        <KpiCard
          label={`ONSS Q${quarter}/${period.year}`}
          value={stats.anyOnssPaid ? "Payé" : `${stats.onssPaid}/${stats.total}`}
          tone={stats.anyOnssPaid ? "success" : "danger"}
        />
        <KpiCard label="Total obligations" value={formatEURBE(stats.totalUnpaid)} tone="danger" />
      </div>

      {/* Alerts */}
      {(stats.precPaid < stats.total || stats.onssPaid < stats.total) && (
        <div className="space-y-2">
          {stats.precPaid < stats.total && (
            <AlertBar
              tone="warning"
              text={`Précompte ${MONTHS_FR[period.month]} ${period.year} non payé pour ${stats.total - stats.precPaid} ouvrier(s) — Échéance : ${formatDateBE(precompteDue)}`}
            />
          )}
          {stats.onssPaid < stats.total && (
            <AlertBar
              tone="danger"
              text={`ONSS Q${quarter} ${period.year} non payé — Échéance : ${formatDateBE(onssDue)}`}
            />
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">
            Ouvriers actifs — {MONTHS_FR[period.month]} {period.year}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Ouvrier</th>
                <th className="px-3 py-2">Chantier</th>
                <th className="px-3 py-2 text-right">Salaire net</th>
                <th className="px-3 py-2">Statut salaire</th>
                <th className="px-3 py-2 text-right">Précompte</th>
                <th className="px-3 py-2">Statut précompte</th>
                <th className="px-3 py-2 text-right">ONSS Q{quarter}</th>
                <th className="px-3 py-2">Statut ONSS</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Aucun ouvrier actif (CDI/CDD/Intérim).
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const allPaid = r.salary.row?.paid && r.precompte.row?.paid && r.onss.row?.paid;
                return (
                  <tr key={r.person.id} className="border-b border-border/50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {allPaid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(r.person.full_name)}`}
                        >
                          {initials(r.person.full_name)}
                        </div>
                        <span className="font-medium">{r.person.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.chantierName}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {formatEURBE(
                        r.salary.row ? Number(r.salary.row.net_amount) : r.salary.defaultNet,
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <PayStatusCell
                        paid={!!r.salary.row?.paid}
                        paidDate={r.salary.row?.paid_date}
                        onPay={() =>
                          setPayModal({
                            kind: "salary",
                            personName: r.person.full_name,
                            defaultAmount: r.salary.row
                              ? Number(r.salary.row.net_amount)
                              : r.salary.defaultNet,
                            personnelId: r.person.id,
                            existingId: r.salary.row?.id,
                          })
                        }
                        onCancel={() => r.salary.row && cancelPayment("salary", r.salary.row.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {formatEURBE(
                        r.precompte.row
                          ? Number(r.precompte.row.amount)
                          : r.precompte.defaultAmount,
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <PayStatusCell
                        paid={!!r.precompte.row?.paid}
                        paidDate={r.precompte.row?.paid_date}
                        onPay={() =>
                          setPayModal({
                            kind: "precompte",
                            personName: r.person.full_name,
                            defaultAmount: r.precompte.row
                              ? Number(r.precompte.row.amount)
                              : r.precompte.defaultAmount,
                            personnelId: r.person.id,
                            existingId: r.precompte.row?.id,
                          })
                        }
                        onCancel={() =>
                          r.precompte.row && cancelPayment("precompte", r.precompte.row.id)
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {formatEURBE(r.onss.row ? Number(r.onss.row.amount) : r.onss.defaultAmount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <PayStatusCell
                        paid={!!r.onss.row?.paid}
                        paidDate={r.onss.row?.paid_date}
                        onPay={() =>
                          setPayModal({
                            kind: "onss",
                            personName: r.person.full_name,
                            defaultAmount: r.onss.row
                              ? Number(r.onss.row.amount)
                              : r.onss.defaultAmount,
                            personnelId: r.person.id,
                            existingId: r.onss.row?.id,
                          })
                        }
                        onCancel={() => r.onss.row && cancelPayment("onss", r.onss.row.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => toast.info("Export PDF bientôt disponible")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <FileDown className="h-3.5 w-3.5" /> Exporter PDF — Récapitulatif
        </button>
        <button
          onClick={() => toast.info("Export CSV bientôt disponible")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <FileDown className="h-3.5 w-3.5" /> Exporter CSV
        </button>
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          Fiche Belcotax (bientôt)
        </button>
      </div>

      {payModal && (
        <PayModal modal={payModal} onClose={() => setPayModal(null)} onConfirm={confirmPayment} />
      )}
    </div>
  );
}

function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.01"
          value={(value * 100).toFixed(2)}
          onChange={(e) => onChange(parseFloat(e.target.value) / 100 || 0)}
          className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "border-l-emerald-500 bg-emerald-50/40"
      : tone === "warning"
        ? "border-l-amber-500 bg-amber-50/40"
        : "border-l-red-500 bg-red-50/40";
  const text =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-red-700";
  return (
    <div className={`rounded-xl border border-border bg-card p-4 shadow-sm border-l-4 ${cls}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${text}`}>{value}</p>
    </div>
  );
}

function AlertBar({ tone, text }: { tone: "warning" | "danger"; text: string }) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${cls}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

function PayStatusCell({
  paid,
  paidDate,
  onPay,
  onCancel,
}: {
  paid: boolean;
  paidDate?: string | null;
  onPay: () => void;
  onCancel: () => void;
}) {
  if (paid) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          ✓ Payé le {formatDateBE(paidDate)}
        </span>
        <button
          onClick={onCancel}
          className="w-fit text-[10px] text-muted-foreground hover:text-red-600 hover:underline"
        >
          Annuler
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPay}
      className="rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
    >
      Payer
    </button>
  );
}

function PayModal({
  modal,
  onClose,
  onConfirm,
}: {
  modal: { kind: PayKind; personName: string; defaultAmount: number; personnelId: string };
  onClose: () => void;
  onConfirm: (paidDate: string, reference: string, amount: number) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(modal.defaultAmount.toFixed(2));
  const title =
    modal.kind === "salary"
      ? "Paiement du salaire"
      : modal.kind === "precompte"
        ? "Paiement du précompte"
        : "Paiement ONSS";
  const note =
    modal.kind === "precompte"
      ? "À verser au SPF Finances avant le 15 du mois suivant."
      : modal.kind === "onss"
        ? "À verser à l'ONSS avant le dernier jour du mois suivant le trimestre."
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ouvrier : <span className="font-medium text-foreground">{modal.personName}</span>
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Montant (€)">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Date de paiement">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Référence virement">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: VIR-2025-06-001"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </Field>
          {note && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700">ⓘ {note}</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(date, reference, parseFloat(amount) || 0)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Confirmer le paiement
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
