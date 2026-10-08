import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Euro,
  HardHat,
  Users,
  AlertTriangle,
  ArrowRight,
  FileText,
  Percent,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatEUR, daysUntil } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/lib/i18n";
import { toCode, CONTRATS_SALARIES } from "@/lib/statuts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const now = new Date();
      const ym = now.getFullYear();
      const mm = now.getMonth() + 1;
      const quarter = Math.floor((mm - 1) / 3) + 1;
      const [chantiersRes, personnelRes, affRes, salRes, precRes, onssRes, vehRes] =
        await Promise.all([
          supabase.from("chantiers").select("*").eq("company_id", companyId!),
          supabase.from("personnel").select("*").eq("company_id", companyId!),
          supabase.from("affectations").select("personnel_id, chantier_id"),
          supabase
            .from("salary_payments")
            .select("personnel_id, paid")
            .eq("company_id", companyId!)
            .eq("period_year", ym)
            .eq("period_month", mm),
          supabase
            .from("precompte_payments")
            .select("personnel_id, amount, paid")
            .eq("company_id", companyId!)
            .eq("period_year", ym)
            .eq("period_month", mm),
          supabase
            .from("onss_payments")
            .select("personnel_id, amount, paid")
            .eq("company_id", companyId!)
            .eq("year", ym)
            .eq("quarter", quarter),
          supabase
            .from("vehicules")
            .select("id, plate, ct_date, insurance_date")
            .eq("company_id", companyId!),
        ]);
      const devRes = await supabase
        .from("factures")
        .select("status, total_ttc")
        .eq("company_id", companyId!)
        .eq("type", "devis");
      return {
        chantiers: chantiersRes.data ?? [],
        personnel: personnelRes.data ?? [],
        affectations: affRes.data ?? [],
        salaries: salRes.data ?? [],
        precomptes: precRes.data ?? [],
        onss: onssRes.data ?? [],
        vehicules: vehRes.data ?? [],
        devis: devRes.data ?? [],
        quarter,
      };
    },
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const {
    chantiers,
    personnel,
    affectations,
    salaries,
    precomptes,
    onss,
    vehicules,
    quarter,
    devis,
  } = data;
  const devisPending = devis.filter((d) => ["envoye", "brouillon"].includes(toCode(d.status)));
  const devisAccepted = devis.filter((d) => toCode(d.status) === "accepte").length;
  const devisDecided = devis.filter((d) =>
    ["accepte", "refuse", "expire"].includes(toCode(d.status)),
  ).length;
  const acceptRate = devisDecided ? Math.round((devisAccepted / devisDecided) * 100) : 0;

  // Compliance metrics for active workers under contract
  const eligibleWorkers = personnel.filter(
    (p) => toCode(p.status) === "actif" && CONTRATS_SALARIES.includes(toCode(p.contract_type)),
  );
  const totalElig = eligibleWorkers.length;
  const unpaidSalaries = totalElig - salaries.filter((s) => s.paid).length;
  const unpaidPrecompte = totalElig - precomptes.filter((s) => s.paid).length;
  const precompteAmount = precomptes
    .filter((s) => !s.paid)
    .reduce((acc, s) => acc + Number(s.amount ?? 0), 0);
  const onssPaidCount = onss.filter((s) => s.paid).length;
  const onssAmount = onss.filter((s) => !s.paid).reduce((acc, s) => acc + Number(s.amount ?? 0), 0);
  const onssDue = totalElig > 0 && onssPaidCount < totalElig;
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const onssDueDate =
    quarter === 1
      ? new Date(now.getFullYear(), 3, 30)
      : quarter === 2
        ? new Date(now.getFullYear(), 6, 31)
        : quarter === 3
          ? new Date(now.getFullYear(), 9, 31)
          : new Date(now.getFullYear() + 1, 0, 31);

  // Auto-detect late chantiers
  const late = chantiers.filter((c) => {
    const days = daysUntil(c.end_date);
    return c.progress < 100 && days !== null && days < 0;
  });
  const active = chantiers.filter((c) => ["en_cours", "en_retard"].includes(toCode(c.status)));

  const caTotal = chantiers.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const coutsTotal = chantiers.reduce((s, c) => s + Number(c.actual_costs ?? 0), 0);
  const beneficeTotal = caTotal - coutsTotal;

  const activePersonnel = personnel.filter((p) => toCode(p.status) === "actif");
  const affectedIds = new Set(affectations.map((a) => a.personnel_id));
  const unassigned = activePersonnel.filter((p) => !affectedIds.has(p.id));

  // Chart: aggregate by month (last 6 months, approximation from start_date)
  const months: { name: string; ca: number; couts: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString(intlLocale(), { month: "short" }).replace(".", "");
    months.push({ name: label.charAt(0).toUpperCase() + label.slice(1), ca: 0, couts: 0 });
  }
  chantiers.forEach((c) => {
    if (!c.start_date) return;
    const d = new Date(c.start_date);
    const idx = months.findIndex((_, i) => {
      const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
    });
    if (idx >= 0) {
      months[idx].ca += Number(c.budget ?? 0) / 6;
      months[idx].couts += Number(c.actual_costs ?? 0) / 6;
    }
  });
  // If all zero, spread totals across last 6 months for visual feedback
  if (months.every((m) => m.ca === 0)) {
    months.forEach((m, i) => {
      const factor = 0.6 + i * 0.12;
      m.ca = Math.round((caTotal / 6) * factor);
      m.couts = Math.round((coutsTotal / 6) * factor);
    });
  }

  const topRentables = [...chantiers]
    .map((c) => ({
      ...c,
      rentabilite: c.budget
        ? ((Number(c.budget) - Number(c.actual_costs)) / Number(c.budget)) * 100
        : 0,
    }))
    .sort((a, b) => b.rentabilite - a.rentabilite)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={TrendingUp}
          label={t("kpi.ca")}
          value={formatEUR(caTotal)}
          sub={t("kpi.caSub", { count: chantiers.length })}
          tone="primary"
        />
        <KpiCard
          icon={Euro}
          label={t("kpi.profit")}
          value={formatEUR(beneficeTotal)}
          sub={beneficeTotal >= 0 ? t("kpi.marginPositive") : t("kpi.marginNegative")}
          tone={beneficeTotal >= 0 ? "success" : "danger"}
        />
        <KpiCard
          icon={HardHat}
          label={t("kpi.activeSites")}
          value={String(active.length)}
          sub={t("kpi.lateCount", { count: late.length })}
          subTone={late.length > 0 ? "danger" : "muted"}
          tone="primary"
        />
        <KpiCard
          icon={Users}
          label={t("kpi.activeWorkers")}
          value={String(activePersonnel.length)}
          sub={t("kpi.unassignedCount", { count: unassigned.length })}
          subTone={unassigned.length > 0 ? "warning" : "muted"}
          tone="primary"
        />
        <KpiCard
          icon={FileText}
          label={t("kpi.pendingQuotes")}
          value={String(devisPending.length)}
          sub={formatEUR(devisPending.reduce((s, d) => s + Number(d.total_ttc ?? 0), 0))}
          tone="primary"
        />
        <KpiCard
          icon={Percent}
          label={t("kpi.acceptRate")}
          value={`${acceptRate}%`}
          sub={t("kpi.acceptRateSub", { accepted: devisAccepted, decided: devisDecided })}
          tone={acceptRate >= 50 ? "success" : "danger"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-base font-semibold">{t("chart.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("chart.subtitle")}</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ left: -10 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.93 0.005 250)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v: number) => formatEUR(v)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar
                  dataKey="ca"
                  name={t("chart.revenue")}
                  fill="oklch(0.62 0.12 210)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="couts"
                  name={t("chart.costs")}
                  fill="oklch(0.62 0.22 27)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-base font-semibold">{t("top.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("top.subtitle")}</p>
          </div>
          <div className="space-y-3">
            {topRentables.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("top.empty")}</p>
            )}
            {topRentables.map((c) => {
              const r = Math.round(c.rentabilite);
              const tone =
                r > 15
                  ? "bg-emerald-100 text-emerald-700"
                  : r >= 5
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700";
              return (
                <Link
                  key={c.id}
                  to="/chantiers/$id"
                  params={{ id: c.id }}
                  className="block rounded-lg p-2 transition hover:bg-muted"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
                    >
                      {r}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${c.progress}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-base font-semibold">{t("alerts.title")}</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <AlertCard tone="danger" title={t("alerts.lateSites", { count: late.length })}>
            {late.length === 0
              ? t("alerts.noLate")
              : late
                  .slice(0, 2)
                  .map((c) => c.name)
                  .join(", ")}
          </AlertCard>
          <AlertCard tone="warning" title={t("alerts.unassigned", { count: unassigned.length })}>
            {unassigned.length === 0
              ? t("alerts.allAssigned")
              : unassigned
                  .slice(0, 2)
                  .map((p) => p.full_name)
                  .join(", ")}
          </AlertCard>
          {unpaidSalaries > 0 && (
            <AlertCard tone="warning" title={t("alerts.unpaidSalaries", { count: unpaidSalaries })}>
              {t("alerts.unpaidSalariesText")}
            </AlertCard>
          )}
          {unpaidPrecompte > 0 && (
            <AlertCard
              tone="danger"
              title={t("alerts.precompteDue", {
                date: nextMonth.toLocaleDateString(intlLocale(), {
                  day: "2-digit",
                  month: "2-digit",
                }),
              })}
            >
              {t("alerts.precompteDueText", { amount: formatEUR(precompteAmount) })}
            </AlertCard>
          )}
          {onssDue && (
            <AlertCard
              tone="danger"
              title={t("alerts.onssDue", {
                quarter,
                date: onssDueDate.toLocaleDateString(intlLocale(), {
                  day: "2-digit",
                  month: "2-digit",
                }),
              })}
            >
              {t("alerts.onssDueText", { amount: formatEUR(onssAmount) })}
            </AlertCard>
          )}
          {(() => {
            const ctExpired = vehicules.filter((v) => v.ct_date && daysUntil(v.ct_date)! < 0);
            const insSoon = vehicules.filter(
              (v) =>
                v.insurance_date &&
                daysUntil(v.insurance_date)! >= 0 &&
                daysUntil(v.insurance_date)! < 30,
            );
            return (
              <>
                {ctExpired.length > 0 && (
                  <AlertCard
                    tone="danger"
                    title={t("alerts.ctExpired", { count: ctExpired.length })}
                  >
                    {ctExpired
                      .slice(0, 2)
                      .map((v) => v.plate)
                      .join(", ")}
                  </AlertCard>
                )}
                {insSoon.length > 0 && (
                  <AlertCard tone="warning" title={t("alerts.insuranceSoon")}>
                    {insSoon
                      .slice(0, 2)
                      .map((v) =>
                        t("alerts.insuranceSoonItem", {
                          plate: v.plate,
                          days: daysUntil(v.insurance_date),
                        }),
                      )
                      .join(", ")}
                  </AlertCard>
                )}
              </>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  subTone = "muted",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "success" | "danger";
  subTone?: "muted" | "danger" | "warning" | "success";
}) {
  const iconBg =
    tone === "success"
      ? "bg-emerald-100 text-emerald-600"
      : tone === "danger"
        ? "bg-red-100 text-red-600"
        : "bg-accent text-primary";
  const subClass =
    subTone === "danger"
      ? "text-danger"
      : subTone === "warning"
        ? "text-warning"
        : subTone === "success"
          ? "text-success"
          : "text-muted-foreground";
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className={`mt-1 text-xs ${subClass}`}>{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function AlertCard({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    danger: { border: "border-l-danger", bg: "bg-red-50/50", text: "text-danger" },
    warning: { border: "border-l-warning", bg: "bg-amber-50/50", text: "text-warning" },
    info: { border: "border-l-info", bg: "bg-blue-50/50", text: "text-info" },
  } as const;
  const s = map[tone];
  const { t } = useTranslation("common");
  return (
    <div className={`rounded-lg border border-border ${s.bg} border-l-4 ${s.border} p-3`}>
      <p className={`text-sm font-semibold ${s.text}`}>{title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{children}</p>
      <button className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {t("actions.see")} <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
