import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Euro,
  IdCard,
  FileDown,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initials, avatarColor, formatDateBE } from "@/lib/format";
import { exportPresencePDF } from "@/lib/pdf";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LANGUES, intlLocale, isLangue, joursSemaineCourts } from "@/lib/i18n";
import { toCode, type PresenceStatut } from "@/lib/statuts";

export const Route = createFileRoute("/_app/personnel/$id")({
  component: PersonnelDetail,
});

function PersonnelDetail() {
  const { t } = useTranslation(["personnel", "common", "statuts"]);
  const { id } = Route.useParams();
  const { company } = useAuth();
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { data } = useQuery({
    queryKey: ["personnel-detail", id, viewMonth.year, viewMonth.month],
    queryFn: async () => {
      const monthStart = new Date(viewMonth.year, viewMonth.month, 1).toISOString().slice(0, 10);
      const monthEnd = new Date(viewMonth.year, viewMonth.month + 1, 0).toISOString().slice(0, 10);
      const [pRes, presRes, affRes] = await Promise.all([
        supabase.from("personnel").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("presence")
          .select("*")
          .eq("personnel_id", id)
          .gte("date", monthStart)
          .lte("date", monthEnd),
        supabase.from("affectations").select("*, chantiers(id, name)").eq("personnel_id", id),
      ]);
      return { person: pRes.data, presence: presRes.data ?? [], affectations: affRes.data ?? [] };
    },
  });

  if (!data?.person) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  const { person, presence, affectations } = data;

  const togglePresence = async (date: string, currentStatus: string | null) => {
    const current = toCode(currentStatus);
    const next: PresenceStatut =
      current === "present" ? "absent" : current === "absent" ? "conge" : "present";
    const { error } = await supabase
      .from("presence")
      .upsert(
        { personnel_id: id, date, status: next, hours: next === "present" ? 8 : 0 },
        { onConflict: "personnel_id,date" },
      );
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["personnel-detail"] });
  };

  const changeLangue = async (langue: string) => {
    if (!isLangue(langue)) return;
    const { error } = await supabase.from("personnel").update({ langue }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("toasts.languageSaved"));
      qc.invalidateQueries({ queryKey: ["personnel-detail"] });
    }
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(intlLocale(), {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: {
    date?: string;
    day?: number;
    dow?: number;
    future?: boolean;
    isToday?: boolean;
  }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewMonth.year, viewMonth.month, d);
    const iso = dateObj.toISOString().slice(0, 10);
    const dow = (dateObj.getDay() + 6) % 7;
    cells.push({
      date: iso,
      day: d,
      dow,
      future: dateObj > today,
      isToday: dateObj.getTime() === today.getTime(),
    });
  }

  const presents = presence.filter((p) => toCode(p.status) === "present").length;
  const absents = presence.filter((p) => toCode(p.status) === "absent").length;
  const conges = presence.filter((p) => toCode(p.status) === "conge").length;
  const hours = presence.reduce((s, p) => s + Number(p.hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        to="/personnel"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white ${avatarColor(person.full_name)}`}
          >
            {initials(person.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{person.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {person.contract_type
                  ? t(`statuts:contrat.${toCode(person.contract_type)}`, {
                      defaultValue: person.contract_type,
                    })
                  : "—"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toCode(person.status) === "actif" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
              >
                {t(`statuts:personnel.${toCode(person.status)}`, { defaultValue: person.status })}
              </span>
              <select
                aria-label={t("form.language")}
                title={t("form.language")}
                value={person.langue ?? "fr"}
                onChange={(e) => changeLangue(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-0.5 text-xs"
              >
                {LANGUES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoItem icon={IdCard} label={t("form.nrn")} value={person.nrn ?? "—"} />
          <InfoItem icon={Mail} label={t("form.email")} value={person.email ?? "—"} />
          <InfoItem icon={Phone} label={t("form.phone")} value={person.phone ?? "—"} />
          <InfoItem
            icon={Euro}
            label={t("detail.hourlyRate")}
            value={
              person.hourly_rate ? t("detail.hourlyRateValue", { value: person.hourly_rate }) : "—"
            }
          />
        </div>
      </div>

      {/* Presence calendar */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t("detail.presenceTitle", {
              month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            })}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportPresencePDF({
                  personName: person.full_name,
                  year: viewMonth.year,
                  month: viewMonth.month,
                  presence,
                  hourlyRate: person.hourly_rate,
                  companyName: company?.name,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              title={t("detail.reportPdfTitle")}
            >
              <FileDown className="h-3.5 w-3.5" /> {t("detail.reportPdf")}
            </button>
            <button
              onClick={() =>
                setViewMonth((v) => ({
                  year: v.month === 0 ? v.year - 1 : v.year,
                  month: v.month === 0 ? 11 : v.month - 1,
                }))
              }
              className="rounded-md p-1.5 hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setViewMonth((v) => ({
                  year: v.month === 11 ? v.year + 1 : v.year,
                  month: v.month === 11 ? 0 : v.month + 1,
                }))
              }
              className="rounded-md p-1.5 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {joursSemaineCourts().map((d) => (
            <div key={d} className="py-1 font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c.date) return <div key={i} />;
            const pr = presence.find((p) => p.date === c.date);
            const weekend = c.dow === 5 || c.dow === 6;
            let style = "bg-gray-50 text-gray-300";
            let label = String(c.day);
            if (weekend) style = "bg-gray-100 text-gray-300";
            else if (c.future) style = "bg-gray-50 text-gray-300";
            else if (toCode(pr?.status) === "present") {
              style = "bg-emerald-100 text-emerald-700";
              label += " ✓";
            } else if (toCode(pr?.status) === "absent") {
              style = "bg-red-100 text-red-600";
              label += " ✗";
            } else if (toCode(pr?.status) === "conge") {
              style = "bg-amber-100 text-amber-600";
              label += " ~";
            } else style = "bg-card border border-dashed border-border text-foreground";
            const clickable = !weekend && !c.future;
            return (
              <button
                key={i}
                disabled={!clickable}
                onClick={() => clickable && togglePresence(c.date!, pr?.status ?? null)}
                title={clickable ? t("detail.clickToChange") : ""}
                className={`relative aspect-square rounded-md text-xs font-medium ${style} ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${c.isToday ? "ring-2 ring-primary" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Stat label={t("detail.statPresent")} value={presents} tone="text-success" />
          <Stat label={t("detail.statAbsent")} value={absents} tone="text-danger" />
          <Stat label={t("detail.statLeave")} value={conges} tone="text-warning" />
          <Stat label={t("detail.statHours")} value={hours} suffix=" h" tone="text-foreground" />
        </div>
      </div>

      {/* Affectations */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t("detail.sites")}</h2>
        {affectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noAssignment")}</p>
        ) : (
          <div className="space-y-2">
            {affectations.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-semibold">{a.chantiers?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.role ?? "—"} · {t("detail.since", { date: formatDateBE(a.start_date) })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
  suffix,
}: {
  value: number;
  label: string;
  tone: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <span className={`font-bold ${tone}`}>
        {value}
        {suffix ?? ""}
      </span>{" "}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
