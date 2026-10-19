/**
 * Exports du timesheet : CSV (Excel belge) et PDF paginé. Rapport interne : langue de
 * l'interface. Indicatif — la paie reste au secrétariat social.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import i18n from "./i18n";
import { formatDateBE } from "./format";
import { header, lastTableY } from "./pdf";
import { dateCsv, nombreCsv, telechargerCsv, versCsv } from "./exports/csv";
import {
  formatDuree,
  heureCourte,
  heuresDecimales,
  totalMinutes,
  totauxPar,
  type PointageCalcul,
} from "./timesheet";

export type PointageExport = PointageCalcul & {
  arrivee: string;
  depart: string | null;
  pause_minutes: number;
  note: string | null;
  travailleur: string;
  fonction: string | null;
  chantier: string;
};

type Contexte = { debut: string; fin: string; filtres: string[]; societe?: string | null };

const t = () => i18n.getFixedT(i18n.language, "timesheet");

const trier = (pts: PointageExport[]) =>
  [...pts].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.travailleur.localeCompare(b.travailleur) ||
      a.arrivee.localeCompare(b.arrivee),
  );

export function exporterTimesheetCsv(pts: PointageExport[], ctx: Contexte) {
  const tr = t();
  const contenu = versCsv(
    [
      tr("columns.date"),
      tr("columns.worker"),
      tr("columns.role"),
      tr("columns.site"),
      tr("columns.arrival"),
      tr("columns.departure"),
      tr("csv.breakMinutes"),
      tr("csv.hoursDecimal"),
      tr("columns.note"),
    ],
    trier(pts).map((p) => [
      dateCsv(p.date),
      p.travailleur,
      p.fonction ?? "",
      p.chantier,
      heureCourte(p.arrivee),
      heureCourte(p.depart),
      p.pause_minutes,
      p.minutes_travaillees == null ? "" : nombreCsv(heuresDecimales(p.minutes_travaillees)),
      p.note ?? "",
    ]),
  );
  telechargerCsv(tr("csv.file", { debut: ctx.debut, fin: ctx.fin }), contenu);
}

/** Tableau « libellé / heures » trié par total décroissant. */
function lignesTotaux(
  pts: PointageExport[],
  cle: (p: PointageExport) => string,
  nom: (p: PointageExport) => string,
) {
  const noms = new Map(pts.map((p) => [cle(p), nom(p)]));
  return [...totauxPar(pts, cle).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, min]) => [noms.get(id) ?? "", formatDuree(min)]);
}

export function exporterTimesheetPdf(pts: PointageExport[], ctx: Contexte) {
  const tr = t();
  const doc = new jsPDF({ orientation: "landscape" });
  const sousTitre = [
    tr("pdf.period", { debut: formatDateBE(ctx.debut), fin: formatDateBE(ctx.fin) }),
    ctx.societe ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  header(doc, tr("pdf.title"), sousTitre);
  let y = 46;
  if (ctx.filtres.length) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(tr("pdf.filters", { filtres: ctx.filtres.join(", ") }), 14, y);
    doc.setTextColor(15, 23, 42);
    y += 4;
  }

  const styles = { fontSize: 9, cellPadding: 1.8 };
  const entete = { fillColor: [15, 42, 67] as [number, number, number] };
  const total = [tr("columns.total"), formatDuree(totalMinutes(pts))];
  autoTable(doc, {
    startY: y + 2,
    head: [[tr("byWorker"), tr("columns.hours")]],
    body: lignesTotaux(
      pts,
      (p) => p.personnel_id,
      (p) => p.travailleur,
    ),
    foot: [total],
    styles,
    headStyles: entete,
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: 125,
    margin: { left: 14 },
  });
  const finTravailleurs = lastTableY(doc);
  autoTable(doc, {
    startY: y + 2,
    head: [[tr("bySite"), tr("columns.hours")]],
    body: lignesTotaux(
      pts,
      (p) => p.chantier_id,
      (p) => p.chantier,
    ),
    foot: [total],
    styles,
    headStyles: entete,
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: 125,
    margin: { left: 158 },
  });
  y = Math.max(finTravailleurs, lastTableY(doc)) + 8;

  autoTable(doc, {
    startY: y,
    head: [
      [
        tr("columns.date"),
        tr("columns.worker"),
        tr("columns.role"),
        tr("columns.site"),
        tr("columns.arrival"),
        tr("columns.departure"),
        tr("columns.break"),
        tr("columns.duration"),
        tr("columns.note"),
      ],
    ],
    body: trier(pts).map((p) => [
      formatDateBE(p.date),
      p.travailleur,
      p.fonction ?? "",
      p.chantier,
      heureCourte(p.arrivee),
      p.depart ? heureCourte(p.depart) : tr("inProgress"),
      tr("breakMinutes", { count: p.pause_minutes }),
      formatDuree(p.minutes_travaillees),
      p.note ?? "",
    ]),
    styles,
    headStyles: entete,
    columnStyles: { 7: { halign: "right" } },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  // Pied de page : mention indicative et pagination « Page X / Y ».
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(tr("pdf.disclaimer"), 14, H - 8);
    doc.text(tr("pdf.page", { page: i, total: n }), W - 14, H - 8, { align: "right" });
  }
  doc.save(`${tr("csv.file", { debut: ctx.debut, fin: ctx.fin }).replace(/\s+/g, "-")}.pdf`);
}
