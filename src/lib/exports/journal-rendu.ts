import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import i18n from "@/lib/i18n";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { header, lastTableY } from "@/lib/pdf";
import { pdfSafe as s } from "@/lib/contrats/pdf";
import { dateCsv, nombreCsv, nomFichier, telechargerCsv, versCsv } from "./csv";
import { pied } from "./rendus";
import { totalChantier, type LigneJournal, type Ouvrier, type TotalSousTraitant } from "./journal";

/** Rapport interne : langue de l'interface. */
const tr = () => i18n.getFixedT(i18n.language, "sousTraitants");

export type MetaJournal = { societe: string; chantier: string; client: string | null };

const ouvriersTexte = (o: Ouvrier[]) =>
  o
    .map((x) =>
      [x.nom, x.fonction, x.heures != null ? `${x.heures} h` : null].filter(Boolean).join(", "),
    )
    .join(" ; ");

const fichier = (m: MetaJournal) =>
  nomFichier(`${tr()("site.journalFile")}_${m.chantier}_${new Date().toISOString().slice(0, 10)}`);

export function journalCsv(lignes: LigneJournal[], m: MetaJournal) {
  const t = tr();
  telechargerCsv(
    fichier(m),
    versCsv(
      [
        t("site.cols.date"),
        t("site.cols.subcontractor"),
        t("site.cols.description"),
        t("site.cols.hours"),
        t("site.cols.workers"),
        t("site.cols.checkin"),
        t("site.cols.validatedOn"),
      ],
      lignes.map((l) => [
        dateCsv(l.date),
        l.sousTraitant,
        l.description,
        nombreCsv(l.heures),
        ouvriersTexte(l.ouvriers),
        l.presence ? t("site.yes") : t("site.no"),
        dateCsv(l.valideLe),
      ]),
    ),
  );
}

export function construireJournalPdf(
  totaux: TotalSousTraitant[],
  lignes: LigneJournal[],
  m: MetaJournal,
): jsPDF {
  const t = tr();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  header(
    doc,
    s(t("site.pdfTitle", { site: m.chantier })),
    s([m.societe, m.client && t("site.client", { client: m.client })].filter(Boolean).join(" — ")),
  );
  const style = {
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 23, 42] as [number, number, number], textColor: 255 },
    footStyles: {
      fillColor: [241, 245, 249] as [number, number, number],
      textColor: [15, 23, 42] as [number, number, number],
      fontStyle: "bold" as const,
    },
    margin: { left: 14, right: 14 },
  };
  const eur = (n: number | null) => (n == null ? "" : formatEURBE(n));

  // Totaux par sous-traitant
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(s(t("site.totalsTitle")), 14, 50);
  doc.setFont("helvetica", "normal");
  const tc = totalChantier(totaux);
  autoTable(doc, {
    ...style,
    startY: 53,
    head: [
      [
        t("site.cols.subcontractor"),
        t("site.cols.entries"),
        t("site.cols.hours"),
        t("site.cols.lumpSum"),
        t("site.cols.hourlyValue"),
        t("site.cols.paidExclVat"),
        t("site.cols.withheld"),
        t("site.cols.paid"),
        t("site.cols.remaining"),
      ].map(s),
    ],
    body: totaux.map((l) =>
      [
        l.sousTraitant,
        `${l.prestations} (${t("site.validatedCount", { count: l.prestationsValidees })})`,
        String(l.heures),
        eur(l.forfait),
        eur(l.valeurHoraire),
        eur(l.payeHt),
        eur(l.retenues),
        eur(l.verse),
        eur(l.resteForfait),
      ].map(s),
    ),
    foot: [
      [
        s(t("site.total")),
        String(tc.prestations),
        String(tc.heures),
        "",
        "",
        s(eur(tc.payeHt)),
        s(eur(tc.retenues)),
        s(eur(tc.verse)),
        "",
      ],
    ],
    columnStyles: Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map((i) => [i, { halign: "right" }])),
  });
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(s(t("site.hourlyHint")), 14, lastTableY(doc) + 4);
  doc.setTextColor(15, 23, 42);

  // Journal
  let y = lastTableY(doc) + 12;
  if (y > 175) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(s(t("site.journalTitle")), 14, y);
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    ...style,
    startY: y + 3,
    head: [
      [
        t("site.cols.date"),
        t("site.cols.subcontractor"),
        t("site.cols.description"),
        t("site.cols.hours"),
        t("site.cols.workers"),
        t("site.cols.checkin"),
        t("site.cols.validatedOn"),
      ].map(s),
    ],
    body: lignes.map((l) =>
      [
        formatDateBE(l.date),
        l.sousTraitant,
        l.description,
        l.heures == null ? "" : String(l.heures),
        ouvriersTexte(l.ouvriers),
        l.presence ? t("site.yes") : t("site.no"),
        l.valideLe ? formatDateBE(l.valideLe) : "",
      ].map(s),
    ),
    columnStyles: { 2: { cellWidth: 70 }, 3: { halign: "right" }, 4: { cellWidth: 70 } },
  });
  pied(doc, lastTableY(doc));
  return doc;
}

export function journalPdf(totaux: TotalSousTraitant[], lignes: LigneJournal[], m: MetaJournal) {
  construireJournalPdf(totaux, lignes, m).save(`${fichier(m)}.pdf`);
}
