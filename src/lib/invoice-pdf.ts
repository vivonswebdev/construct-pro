import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEUR, formatDateBE } from "./format";
import { lastTableY } from "./pdf";
import i18n, { LANGUES_DOCUMENTS, type LangueDocument } from "./i18n";
import { DEVIS_STATUTS, toCode, type DevisStatut } from "./statuts";

const isDevisStatut = (s: string): s is DevisStatut =>
  (DEVIS_STATUTS as readonly string[]).includes(s);

export type FactureForPDF = {
  type: string;
  number: string;
  client_name: string;
  client_vat: string | null;
  client_address: string | null;
  issue_date: string;
  due_date: string | null;
  vat_rate: number;
  subtotal_ht: number;
  vat_amount: number;
  total_ttc: number;
  status: string;
  notes: string | null;
  conditions: string | null;
  payment_reference: string | null;
  autoliquidation?: boolean;
  attestation_6?: boolean;
};

export type LigneForPDF = {
  description: string;
  quantity: number;
  unit_price: number;
  total_ht: number;
  vat_rate?: number;
};

export type CompanyForPDF = {
  name: string;
  bce_number?: string | null;
  address?: string | null;
};

/** Langue d'un document officiel : celle du client (fr / nl / en), français par défaut. */
export function langueDocument(langueClient: string | null | undefined): LangueDocument {
  const l = (langueClient ?? "").toLowerCase();
  return (LANGUES_DOCUMENTS as readonly string[]).includes(l) ? (l as LangueDocument) : "fr";
}

const pdfT = (lang: LangueDocument) => i18n.getFixedT(lang, "pdf");

/** Mention légale d'autoliquidation, dans la langue du document. */
export const mentionAutoliquidation = (lang: LangueDocument) => pdfT(lang)("mentionReverseCharge");
/** Mention TVA 6 % (logement de plus de 10 ans), dans la langue du document. */
export const mentionAttestation6 = (lang: LangueDocument) => pdfT(lang)("mention6");

function structuredCommunication(num: string): string {
  // Communication structurée (OGM) dérivée des chiffres du numéro
  const digits = (num.replace(/\D/g, "") + "0000000000").slice(0, 10);
  const n = BigInt(digits);
  const mod = Number(n % 97n) || 97;
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7, 10)}${String(mod).padStart(2, "0")}+++`;
}

export function exportFacturePDF(
  facture: FactureForPDF,
  lignes: LigneForPDF[],
  company: CompanyForPDF,
  byRate: Record<number, { base: number; vat: number }> | undefined,
  lang: LangueDocument,
) {
  const t = pdfT(lang);
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const isDevis = facture.type === "devis";
  const title = isDevis ? t("quote") : t("invoice");

  // Bandeau d'en-tête
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(company.name || "ConstructFlow", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (company.address) doc.text(company.address, 14, 20);
  if (company.bce_number) doc.text(t("bce", { value: company.bce_number }), 14, 24);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, W - 14, 16, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(t("number", { number: facture.number }), W - 14, 22, { align: "right" });

  // Client
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(t("billedTo"), 14, 42);
  doc.setFont("helvetica", "normal");
  doc.text(facture.client_name, 14, 48);
  if (facture.client_address) {
    const addrLines = doc.splitTextToSize(facture.client_address, 80);
    doc.text(addrLines, 14, 53);
  }
  if (facture.client_vat) doc.text(t("vat", { value: facture.client_vat }), 14, 68);

  // Dates et statut
  const metaX = W - 80;
  doc.setFont("helvetica", "bold");
  doc.text(t("issueDate"), metaX, 42);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateBE(facture.issue_date), metaX + 40, 42);
  doc.setFont("helvetica", "bold");
  doc.text(isDevis ? t("validity") : t("dueDate"), metaX, 48);
  doc.setFont("helvetica", "normal");
  doc.text(formatDateBE(facture.due_date), metaX + 40, 48);
  doc.setFont("helvetica", "bold");
  doc.text(t("status"), metaX, 54);
  doc.setFont("helvetica", "normal");
  const statusCode = toCode(facture.status);
  const statusLabel = isDevisStatut(statusCode) ? t(`statusLabels.${statusCode}`) : facture.status;
  doc.text(statusLabel, metaX + 40, 54);

  // Lignes
  autoTable(doc, {
    startY: 78,
    head: [
      [
        t("columns.description"),
        t("columns.qty"),
        t("columns.unitPrice"),
        t("columns.vat"),
        t("columns.totalExcl"),
      ],
    ],
    body: lignes.map((l) => [
      l.description,
      String(l.quantity),
      formatEUR(l.unit_price),
      `${l.vat_rate ?? facture.vat_rate} %`,
      formatEUR(l.total_ht),
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 20 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right", cellWidth: 30 },
    },
  });

  // Totaux
  const afterTable = lastTableY(doc) + 6;
  const totalsX = W - 80;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(t("subtotalExcl"), totalsX, afterTable);
  doc.text(formatEUR(facture.subtotal_ht), W - 14, afterTable, { align: "right" });
  const rates =
    byRate && Object.keys(byRate).length
      ? Object.entries(byRate).sort((a, b) => Number(b[0]) - Number(a[0]))
      : [
          [
            String(facture.vat_rate),
            { base: facture.subtotal_ht, vat: facture.vat_amount },
          ] as const,
        ];
  let ty = afterTable;
  for (const [rate, r] of rates) {
    ty += 6;
    doc.text(t("vatRate", { rate }), totalsX, ty);
    doc.text(formatEUR(r.vat), W - 14, ty, { align: "right" });
  }
  doc.setFillColor(8, 145, 178);
  doc.rect(totalsX - 4, ty + 3, W - totalsX - 6, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(t("totalIncl"), totalsX, ty + 9);
  doc.text(formatEUR(facture.total_ttc), W - 14, ty + 9, { align: "right" });
  doc.setTextColor(15, 23, 42);

  let y = ty + 22;
  const mentions: string[] = [];
  if (facture.autoliquidation) mentions.push(mentionAutoliquidation(lang));
  if (facture.attestation_6) mentions.push(mentionAttestation6(lang));
  if (mentions.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t("legalMentions"), 14, y);
    doc.setFont("helvetica", "normal");
    mentions.forEach((m, i) => doc.text(m, 14, y + 5 + i * 5));
    y += 8 + mentions.length * 5;
  }

  // Notes, paiement, conditions
  if (facture.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t("notes"), 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(facture.notes, W - 28);
    doc.text(lines, 14, y + 5);
    y += 5 + lines.length * 4 + 4;
  }
  if (!isDevis) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t("paymentTerms"), 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      t("structuredCommunication", { value: structuredCommunication(facture.number) }),
      14,
      y + 5,
    );
    if (facture.payment_reference)
      doc.text(t("reference", { value: facture.payment_reference }), 14, y + 10);
    y += 18;
  }
  if (facture.conditions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t("generalConditions"), 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(facture.conditions, W - 28);
    doc.text(lines, 14, y + 5);
  }

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    t("footer", { date: formatDateBE(new Date()) }),
    W / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" },
  );

  doc.save(`${isDevis ? t("fileQuote") : t("fileInvoice")}_${facture.number}.pdf`);
}
