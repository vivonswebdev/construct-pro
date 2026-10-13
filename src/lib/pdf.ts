import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEUR, formatDateBE } from "./format";
import i18n, { intlLocale, joursSemaineCourts } from "./i18n";
import { toCode } from "./statuts";

/**
 * Rapports internes (liste des chantiers, présences) : dans la langue de l'interface.
 * Les documents destinés aux clients (devis) sont dans invoice-pdf.ts, dans la langue du client.
 */

/** Position Y de fin du dernier tableau jspdf-autotable (propriété ajoutée au document). */
export function lastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
}

type Chantier = {
  name: string;
  client_name: string | null;
  address: string | null;
  budget: number | null;
  actual_costs: number | null;
  progress: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

const t = () => i18n.getFixedT(i18n.language, "pdf");
const statutChantier = (s: string) => i18n.t(`statuts:chantier.${toCode(s)}`, { defaultValue: s });

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ConstructFlow", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    t()("reports.editedOn", { date: formatDateBE(new Date()) }),
    doc.internal.pageSize.getWidth() - 14,
    14,
    { align: "right" },
  );
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 34);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 40);
  }
  doc.setTextColor(15, 23, 42);
}

export function exportChantiersPDF(chantiers: Chantier[], companyName?: string) {
  const tr = t();
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, tr("reports.sitesTitle"), companyName ?? undefined);

  const totalBudget = chantiers.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const totalCosts = chantiers.reduce((s, c) => s + Number(c.actual_costs ?? 0), 0);
  const margin = totalBudget - totalCosts;
  const avgProgress = chantiers.length
    ? Math.round(chantiers.reduce((s, c) => s + c.progress, 0) / chantiers.length)
    : 0;

  autoTable(doc, {
    startY: 46,
    head: [[tr("reports.indicator"), tr("reports.value")]],
    body: [
      [tr("reports.sitesCount"), String(chantiers.length)],
      [tr("reports.totalBudget"), formatEUR(totalBudget)],
      [tr("reports.committedCosts"), formatEUR(totalCosts)],
      [tr("reports.forecastMargin"), formatEUR(margin)],
      [tr("reports.avgProgress"), `${avgProgress} %`],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    tableWidth: 110,
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 8,
    head: [
      [
        tr("reports.cols.site"),
        tr("reports.cols.client"),
        tr("reports.cols.start"),
        tr("reports.cols.handover"),
        tr("reports.cols.budget"),
        tr("reports.cols.costs"),
        tr("reports.cols.progress"),
        tr("reports.cols.status"),
      ],
    ],
    body: chantiers.map((c) => [
      c.name,
      c.client_name ?? "—",
      formatDateBE(c.start_date),
      formatDateBE(c.end_date),
      formatEUR(c.budget),
      formatEUR(c.actual_costs),
      `${c.progress} %`,
      statutChantier(c.status),
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${tr("reports.sitesFile")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportChantiersCSV(chantiers: Chantier[]) {
  const tr = t();
  const headers = [
    tr("reports.cols.name"),
    tr("reports.cols.client"),
    tr("reports.cols.address"),
    tr("reports.cols.start"),
    tr("reports.cols.handover"),
    tr("reports.cols.budgetEur"),
    tr("reports.cols.costsEur"),
    tr("reports.cols.marginEur"),
    tr("reports.cols.progressPct"),
    tr("reports.cols.status"),
  ];
  const rows = chantiers.map((c) => [
    c.name,
    c.client_name ?? "",
    c.address ?? "",
    c.start_date ? formatDateBE(c.start_date) : "",
    c.end_date ? formatDateBE(c.end_date) : "",
    String(Math.round(Number(c.budget ?? 0))).replace(".", ","),
    String(Math.round(Number(c.actual_costs ?? 0))).replace(".", ","),
    String(Math.round(Number(c.budget ?? 0) - Number(c.actual_costs ?? 0))).replace(".", ","),
    String(c.progress),
    statutChantier(c.status),
  ]);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv =
    "﻿" + [headers, ...rows].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tr("reports.sitesFile")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type PresenceRow = { date: string; status: string; hours: number | null };

export function exportPresencePDF(opts: {
  personName: string;
  year: number;
  month: number; // 0 = janvier
  presence: PresenceRow[];
  hourlyRate?: number | null;
  companyName?: string;
}) {
  const tr = t();
  const { personName, year, month, presence, hourlyRate, companyName } = opts;
  const monthLabel = new Date(year, month, 1).toLocaleDateString(intlLocale(), {
    month: "long",
    year: "numeric",
  });
  const doc = new jsPDF();
  header(
    doc,
    tr("reports.presenceTitle", { name: personName }),
    `${monthLabel}${companyName ? " · " + companyName : ""}`,
  );

  const jours = joursSemaineCourts();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: string[][] = [];
  let totalP = 0,
    totalA = 0,
    totalC = 0,
    totalH = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const iso = dateObj.toISOString().slice(0, 10);
    const dowIdx = (dateObj.getDay() + 6) % 7;
    const weekend = dowIdx >= 5;
    const pr = presence.find((p) => p.date === iso);
    const code = pr ? toCode(pr.status) : "";
    const hours = pr?.hours ?? 0;
    if (code === "present") totalP++;
    else if (code === "absent") totalA++;
    else if (code === "conge") totalC++;
    totalH += Number(hours);
    const label = weekend
      ? tr("reports.weekend")
      : pr
        ? i18n.t(`statuts:presence.${code}`, { defaultValue: pr.status })
        : "—";
    rows.push([
      formatDateBE(iso),
      jours[dowIdx],
      label,
      code === "present" ? tr("reports.hoursValue", { value: Number(hours) }) : "—",
    ]);
  }

  autoTable(doc, {
    startY: 46,
    head: [
      [
        tr("reports.cols.date"),
        tr("reports.cols.day"),
        tr("reports.cols.status"),
        tr("reports.cols.hours"),
      ],
    ],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 3: { halign: "right" } },
  });

  const summaryY = lastTableY(doc) + 8;
  const summary: (string | number)[][] = [
    [tr("reports.daysPresent"), totalP],
    [tr("reports.daysAbsent"), totalA],
    [tr("reports.daysLeave"), totalC],
    [tr("reports.totalHours"), tr("reports.hoursValue", { value: totalH })],
  ];
  if (hourlyRate) {
    summary.push([tr("reports.hourlyRate"), tr("reports.hourlyRateValue", { value: hourlyRate })]);
    summary.push([tr("reports.estimatedCost"), formatEUR(totalH * Number(hourlyRate))]);
  }
  autoTable(doc, {
    startY: summaryY,
    head: [[tr("reports.summary"), tr("reports.value")]],
    body: summary,
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255 },
    styles: { fontSize: 10 },
    tableWidth: 110,
  });

  doc.save(
    `${tr("reports.presenceFile")}_${personName.replace(/\s+/g, "_")}_${year}-${String(month + 1).padStart(2, "0")}.pdf`,
  );
}
