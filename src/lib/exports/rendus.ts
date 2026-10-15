import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import i18n, { intlLocale } from "@/lib/i18n";
import { formatBCE } from "@/lib/sous-traitants";
import { formatEURBE } from "@/lib/belgian";
import { formatDateBE } from "@/lib/format";
import { header, lastTableY } from "@/lib/pdf";
import { pdfSafe } from "@/lib/contrats/pdf";
import { dateCsv, nombreCsv, nomFichier, telechargerCsv, versCsv } from "./csv";
import { totauxRegistre, type Exigence, type LigneComptable, type LigneRegistre } from "./registre";

/** Rapports internes : langue de l'interface. */
const tr = () => i18n.getFixedT(i18n.language, "exports");

/** Date et heure à Bruxelles : 05/09/2026 10:00. */
export const dateHeureBruxelles = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(intlLocale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Brussels",
      })
    : "";

export type MetaExport = {
  societe: string;
  du: string;
  au: string;
  filtres: string[]; // libellés déjà traduits des filtres actifs
};

const periodeTexte = (m: MetaExport) =>
  tr()("period", { from: formatDateBE(m.du), to: formatDateBE(m.au) });

// --- Registre : CSV --------------------------------------------------------------------------
export function registreCsv(lignes: LigneRegistre[], m: MetaExport) {
  const t = tr();
  const entetes = [
    t("cols.paymentDate"),
    t("cols.subcontractor"),
    t("cols.bce"),
    t("cols.invoice"),
    t("cols.exclVat"),
    t("cols.onss"),
    t("cols.spf"),
    t("cols.totalWithheld"),
    t("cols.paid"),
    t("cols.checkedAt"),
    t("cols.checkStatus"),
    t("cols.site"),
    t("cols.client"),
    t("cols.cancelled"),
  ];
  const rows = lignes.map((l) => [
    dateCsv(l.datePaiement),
    l.sousTraitant,
    l.bce ? formatBCE(l.bce) : "",
    l.facture ?? "",
    nombreCsv(l.ht),
    nombreCsv(l.onss),
    nombreCsv(l.spf),
    nombreCsv(l.totalRetenu),
    nombreCsv(l.verse),
    dateHeureBruxelles(l.verifieLe),
    t(`checkStatus.${l.statutVerification}`),
    l.chantier ?? "",
    l.client ?? "",
    l.annule ? t("yes") : "",
  ]);
  telechargerCsv(`${t("registerFile")}_${m.du}_${m.au}`, versCsv(entetes, rows));
}

// --- Registre : PDF --------------------------------------------------------------------------
export function registrePdf(lignes: LigneRegistre[], m: MetaExport) {
  construireRegistrePdf(lignes, m).save(
    `${nomFichier(`${tr()("registerFile")}_${m.du}_${m.au}`)}.pdf`,
  );
}

export function construireRegistrePdf(lignes: LigneRegistre[], m: MetaExport): jsPDF {
  const t = tr();
  const s = pdfSafe;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  header(doc, s(t("registerTitle")), s(`${m.societe} — ${periodeTexte(m)}`));
  let y = 46;
  if (m.filtres.length) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(s(`${t("filters")} : ${m.filtres.join(" · ")}`), 14, y);
    doc.setTextColor(15, 23, 42);
    y += 4;
  }
  const tot = totauxRegistre(lignes);
  autoTable(doc, {
    startY: y,
    head: [
      [
        t("cols.paymentDate"),
        t("cols.subcontractor"),
        t("cols.bce"),
        t("cols.invoice"),
        t("cols.exclVat"),
        t("cols.onss"),
        t("cols.spf"),
        t("cols.totalWithheld"),
        t("cols.paid"),
        t("cols.checkedAt"),
        t("cols.checkStatus"),
        t("cols.site"),
        t("cols.client"),
      ].map(s),
    ],
    body: lignes.map((l) =>
      [
        formatDateBE(l.datePaiement) + (l.annule ? ` (${t("cancelledShort")})` : ""),
        l.sousTraitant,
        l.bce ? formatBCE(l.bce) : "",
        l.facture ?? "",
        formatEURBE(l.ht),
        formatEURBE(l.onss),
        formatEURBE(l.spf),
        formatEURBE(l.totalRetenu),
        formatEURBE(l.verse),
        dateHeureBruxelles(l.verifieLe),
        t(`checkStatus.${l.statutVerification}`),
        l.chantier ?? "",
        l.client ?? "",
      ].map(s),
    ),
    foot: [
      [
        s(t("totals", { count: tot.nombre })),
        "",
        "",
        "",
        s(formatEURBE(tot.ht)),
        s(formatEURBE(tot.onss)),
        s(formatEURBE(tot.spf)),
        s(formatEURBE(tot.totalRetenu)),
        s(formatEURBE(tot.verse)),
        "",
        "",
        "",
        "",
      ],
    ],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7 },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && lignes[d.row.index]?.annule) {
        d.cell.styles.textColor = [148, 163, 184];
        d.cell.styles.fontStyle = "italic";
      }
    },
  });
  pied(doc, lastTableY(doc));
  return doc;
}

/** Mention « indicatif » et numéros de page. */
export function pied(doc: jsPDF, y: number) {
  const t = tr();
  const h = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const lignes: string[] = doc.splitTextToSize(pdfSafe(t("disclaimer")), w - 28);
  if (y + 8 + lignes.length * 3.5 > h - 12) {
    doc.addPage();
    y = 20;
  }
  doc.text(lignes, 14, y + 8);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.text(pdfSafe(t("page", { page: i, total: n })), w / 2, h - 6, { align: "center" });
  }
  doc.setTextColor(15, 23, 42);
}

// --- Export comptable : CSV -------------------------------------------------------------------
export function comptableCsv(lignes: LigneComptable[], m: MetaExport) {
  const t = tr();
  const exigence = (e: Exigence) => i18n.t(`sousTraitants:compliance.requirement.${e}`);
  const entetes = [
    t("cols.subcontractor"),
    t("cols.bce"),
    t("cols.periodStart"),
    t("cols.periodEnd"),
    t("cols.serviceEntries"),
    t("cols.hours"),
    t("cols.exclVat"),
    t("cols.onss"),
    t("cols.spf"),
    t("cols.totalWithheld"),
    t("cols.paid"),
    t("cols.payments"),
    t("cols.compliance"),
    t("cols.missingDocuments"),
  ];
  const rows = lignes.map((l) => [
    l.sousTraitant,
    l.bce ? formatBCE(l.bce) : "",
    dateCsv(m.du),
    dateCsv(m.au),
    l.prestations,
    nombreCsv(l.heures),
    nombreCsv(l.ht),
    nombreCsv(l.onss),
    nombreCsv(l.spf),
    nombreCsv(l.totalRetenu),
    nombreCsv(l.verse),
    l.paiements,
    l.synthese ? t(`summary.${l.synthese}`) : "",
    l.manquants.map(exigence).join(" | "),
  ]);
  telechargerCsv(`${t("accountantFile")}_${m.du}_${m.au}`, versCsv(entetes, rows));
}
