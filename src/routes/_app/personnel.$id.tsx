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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initials, avatarColor, formatDateBE } from "@/lib/format";
import { exportPresencePDF } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/personnel/$id")({
  component: PersonnelDetail,
});

const STATUS_OPTIONS = ["Présent", "Absent", "Congé"] as const;

function PersonnelDetail() {
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
    const next =
      currentStatus === "Présent" ? "Absent" : currentStatus === "Absent" ? "Congé" : "Présent";
    const { error } = await supabase
      .from("presence")
      .upsert(
        { personnel_id: id, date, status: next, hours: next === "Présent" ? 8 : 0 },
        { onConflict: "personnel_id,date" },
      );
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["personnel-detail"] });
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("fr-BE", {
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

  const presents = presence.filter((p) => p.status === "Présent").length;
  const absents = presence.filter((p) => p.status === "Absent").length;
  const conges = presence.filter((p) => p.status === "Congé").length;
  const hours = presence.reduce((s, p) => s + Number(p.hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link
        to="/personnel"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour au personnel
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
              <span>{person.contract_type ?? "—"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${person.status === "Actif" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
              >
                {person.status}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoItem icon={IdCard} label="NRN" value={person.nrn ?? "—"} />
          <InfoItem icon={Mail} label="Email" value={person.email ?? "—"} />
          <InfoItem icon={Phone} label="Téléphone" value={person.phone ?? "—"} />
          <InfoItem
            icon={Euro}
            label="Taux horaire"
            value={person.hourly_rate ? `${person.hourly_rate} €/h` : "—"}
          />
        </div>
      </div>

      {/* Presence calendar */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold capitalize">Présences — {monthName}</h2>
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
              title="Exporter le rapport mensuel en PDF"
            >
              <FileDown className="h-3.5 w-3.5" /> Rapport PDF
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
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
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
            else if (pr?.status === "Présent") {
              style = "bg-emerald-100 text-emerald-700";
              label += " ✓";
            } else if (pr?.status === "Absent") {
              style = "bg-red-100 text-red-600";
              label += " ✗";
            } else if (pr?.status === "Congé") {
              style = "bg-amber-100 text-amber-600";
              label += " ~";
            } else style = "bg-card border border-dashed border-border text-foreground";
            const clickable = !weekend && !c.future;
            return (
              <button
                key={i}
                disabled={!clickable}
                onClick={() => clickable && togglePresence(c.date!, pr?.status ?? null)}
                title={clickable ? "Cliquer pour changer" : ""}
                className={`relative aspect-square rounded-md text-xs font-medium ${style} ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"} ${c.isToday ? "ring-2 ring-primary" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Stat label="jours présents" value={presents} tone="text-success" />
          <Stat label="absents" value={absents} tone="text-danger" />
          <Stat label="congés" value={conges} tone="text-warning" />
          <Stat label="heures travaillées" value={hours} suffix="h" tone="text-foreground" />
        </div>
      </div>

      {/* Affectations */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Chantiers affectés</h2>
        {affectations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune affectation en cours.</p>
        ) : (
          <div className="space-y-2">
            {affectations.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-semibold">{a.chantiers?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.role ?? "—"} · depuis le {formatDateBE(a.start_date)}
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

function InfoItem({ icon: Icon, label, value }: any) {
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
