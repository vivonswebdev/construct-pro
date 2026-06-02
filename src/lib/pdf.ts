import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEUR, formatDateBE } from "./format";

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

const today = () => formatDateBE(new Date());

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ConstructFlow", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Édité le ${today()}`, doc.internal.pageSize.getWidth() - 14, 14, { align: "right" });
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
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, "Liste des chantiers", companyName ?? undefined);

  const totalBudget = chantiers.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const totalCosts = chantiers.reduce((s, c) => s + Number(c.actual_costs ?? 0), 0);
  const margin = totalBudget - totalCosts;
  const avgProgress = chantiers.length
    ? Math.round(chantiers.reduce((s, c) => s + c.progress, 0) / chantiers.length)
    : 0;

  autoTable(doc, {
    startY: 46,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Nombre de chantiers", String(chantiers.length)],
      ["Budget total", formatEUR(totalBudget)],
      ["Coûts engagés", formatEUR(totalCosts)],
      ["Marge prévisionnelle", formatEUR(margin)],
      ["Progression moyenne", `${avgProgress}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9 },
    tableWidth: 110,
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Chantier", "Client", "Début", "Remise", "Budget", "Dépenses", "Progression", "Statut"]],
    body: chantiers.map((c) => [
      c.name,
      c.client_name ?? "—",
      formatDateBE(c.start_date),
      formatDateBE(c.end_date),
      formatEUR(c.budget),
      formatEUR(c.actual_costs),
      `${c.progress}%`,
      c.status,
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`chantiers_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportChantiersCSV(chantiers: Chantier[]) {
  const headers = ["Nom", "Client", "Adresse", "Début", "Remise", "Budget (€)", "Dépenses (€)", "Marge (€)", "Progression (%)", "Statut"];
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
    c.status,
  ]);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chantiers_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type PresenceRow = { date: string; status: string; hours: number | null };

export function exportPresencePDF(opts: {
  personName: string;
  year: number;
  month: number; // 0-indexed
  presence: PresenceRow[];
  hourlyRate?: number | null;
  companyName?: string;
}) {
  const { personName, year, month, presence, hourlyRate, companyName } = opts;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-BE", { month: "long", year: "numeric" });
  const doc = new jsPDF();
  header(doc, `Rapport de présences — ${personName}`, `${monthLabel}${companyName ? " · " + companyName : ""}`);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows: any[] = [];
  let totalP = 0, totalA = 0, totalC = 0, totalH = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const iso = dateObj.toISOString().slice(0, 10);
    const dowIdx = (dateObj.getDay() + 6) % 7;
    const dowName = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][dowIdx];
    const weekend = dowIdx >= 5;
    const pr = presence.find((p) => p.date === iso);
    const status = weekend ? "Week-end" : pr?.status ?? "—";
    const hours = pr?.hours ?? 0;
    if (status === "Présent") totalP++;
    else if (status === "Absent") totalA++;
    else if (status === "Congé") totalC++;
    totalH += Number(hours);
    rows.push([formatDateBE(iso), dowName, status, status === "Présent" ? `${Number(hours)} h` : "—"]);
  }

  autoTable(doc, {
    startY: 46,
    head: [["Date", "Jour", "Statut", "Heures"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 3: { halign: "right" } },
  });

  const summaryY = (doc as any).lastAutoTable.finalY + 8;
  const summary: (string | number)[][] = [
    ["Jours présents", totalP],
    ["Jours absents", totalA],
    ["Jours de congé", totalC],
    ["Total heures travaillées", `${totalH} h`],
  ];
  if (hourlyRate) {
    summary.push(["Taux horaire", `${hourlyRate} €/h`]);
    summary.push(["Coût estimé", formatEUR(totalH * Number(hourlyRate))]);
  }
  autoTable(doc, {
    startY: summaryY,
    head: [["Synthèse", "Valeur"]],
    body: summary,
    theme: "grid",
    headStyles: { fillColor: [20, 184, 166], textColor: 255 },
    styles: { fontSize: 10 },
    tableWidth: 110,
  });

  doc.save(`presences_${personName.replace(/\s+/g, "_")}_${year}-${String(month + 1).padStart(2, "0")}.pdf`);
}
