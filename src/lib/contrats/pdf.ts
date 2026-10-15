import jsPDF from "jspdf";
import i18n, { type LangueDocument } from "@/lib/i18n";
import type { Bloc } from "./sous-traitance";

export type SignaturePDF = {
  nom: string | null;
  qualite: string | null;
  image: string | null; // data:image/png;base64,…
  le: string | null; // horodatage ISO
};

export type AuditPDF = {
  envoyeLe: string;
  consulteLe: string | null;
  signeLe: string | null;
  ip: string | null;
  userAgent: string | null;
  hashEnvoi: string;
  hashSigne: string | null;
};

// Les polices standard de jsPDF (Helvetica, WinAnsi) ne couvrent pas tout l'Unicode :
// on garde Latin-1 + les signes WinAnsi usuels, et on retire les accents des autres lettres
// (ex. « Wiśniewski » -> « Wisniewski ») plutôt que d'imprimer des caractères illisibles.
const WINANSI = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function pdfSafe(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\u202f\u00a0]/g, " ")) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0xff || WINANSI.has(ch)) out += ch;
    else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += [...base].every((b) => (b.codePointAt(0) ?? 0) <= 0xff) ? base : "?";
    }
  }
  return out;
}

const dt = (iso: string | null, lang: LangueDocument) =>
  iso
    ? new Date(iso).toLocaleString(`${lang}-BE`, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Brussels",
      })
    : "—";

type OptionsPDF = {
  blocs: Bloc[];
  faitA: string;
  entrepriseNom: string;
  entreprise: SignaturePDF;
  sousTraitant: SignaturePDF;
  audit: AuditPDF;
  lang: LangueDocument;
  fichier: string;
};

/**
 * Signature (PNG du pavé de signature) -> JPEG sur fond blanc : le décodeur PNG de jsPDF
 * rend certaines images sur fond noir.
 */
export async function versJpeg(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

/** PDF du contrat (signé ou en attente), avec zone de signature et piste d'audit. */
export async function exportContratPDF(opts: OptionsPDF) {
  const [e, s] = await Promise.all([
    versJpeg(opts.entreprise.image),
    versJpeg(opts.sousTraitant.image),
  ]);
  construireContratPDF({
    ...opts,
    entreprise: { ...opts.entreprise, image: e },
    sousTraitant: { ...opts.sousTraitant, image: s },
  }).save(`${opts.fichier}.pdf`);
}

export function construireContratPDF(opts: OptionsPDF): jsPDF {
  const t = i18n.getFixedT(opts.lang, "pdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const M = 18;
  const W = 210 - 2 * M;
  const BAS = 282;
  let y = 20;

  const place = (h: number) => {
    if (y + h > BAS) {
      doc.addPage();
      y = 20;
    }
  };
  const ecrire = (
    texte: string,
    o: { size?: number; bold?: boolean; indent?: number; gap?: number; align?: "center" } = {},
  ) => {
    const size = o.size ?? 9.5;
    const indent = o.indent ?? 0;
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lignes: string[] = doc.splitTextToSize(pdfSafe(texte), W - indent);
    const lh = size * 0.42;
    for (const l of lignes) {
      place(lh);
      if (o.align === "center") doc.text(l, 105, y, { align: "center" });
      else doc.text(l, M + indent, y);
      y += lh;
    }
    y += o.gap ?? 1.5;
  };

  for (const b of opts.blocs) {
    switch (b.k) {
      case "titre":
        ecrire(b.t, { size: 13, bold: true, align: "center", gap: 2 });
        break;
      case "soustitre":
        ecrire(b.t, { size: 9, align: "center", gap: 5 });
        break;
      case "h":
        y += 2;
        place(12);
        ecrire(b.t, { size: 10.5, bold: true, gap: 1.5 });
        break;
      case "p":
        ecrire(b.t);
        break;
      case "li":
        ecrire(`•  ${b.t}`, { indent: 4, gap: 1 });
        break;
      case "check":
        ecrire(`[  ]  ${b.t}`, { indent: 4, gap: 1 });
        break;
      case "ligne":
        ecrire(`${b.label} : ${b.valeur}`, { indent: 2, gap: 1 });
        break;
    }
  }

  // Signatures
  y += 4;
  place(60);
  ecrire(t("contrat.signatures"), { size: 10.5, bold: true, gap: 2 });
  ecrire(opts.faitA, { gap: 4 });
  const col = (x: number, titre: string, s: SignaturePDF) => {
    let yy = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(pdfSafe(titre), x, yy);
    doc.setFont("helvetica", "normal");
    yy += 5;
    doc.text(pdfSafe(t("contrat.name", { value: s.nom ?? "" })), x, yy);
    yy += 4.5;
    doc.text(pdfSafe(t("contrat.role", { value: s.qualite ?? "" })), x, yy);
    yy += 2;
    if (s.image) {
      try {
        doc.addImage(
          s.image,
          s.image.startsWith("data:image/jpeg") ? "JPEG" : "PNG",
          x,
          yy,
          60,
          22,
        );
      } catch {
        // image illisible : la signature reste prouvée par la piste d'audit
      }
    }
    yy += 25;
    doc.setFontSize(8);
    doc.text(
      pdfSafe(s.le ? t("contrat.signedOn", { date: dt(s.le, opts.lang) }) : t("contrat.notSigned")),
      x,
      yy,
    );
    return yy;
  };
  const fin = Math.max(
    col(M, t("contrat.forContractor", { name: opts.entrepriseNom }), opts.entreprise),
    col(M + W / 2 + 4, t("contrat.forSubcontractor"), opts.sousTraitant),
  );
  y = fin + 10;

  // Piste d'audit
  place(50);
  ecrire(t("contrat.audit"), { size: 10, bold: true, gap: 2 });
  const a = opts.audit;
  for (const l of [
    t("contrat.auditSent", { date: dt(a.envoyeLe, opts.lang) }),
    t("contrat.auditViewed", { date: dt(a.consulteLe, opts.lang) }),
    t("contrat.auditSigned", { date: dt(a.signeLe, opts.lang) }),
    t("contrat.auditIp", { value: a.ip || "—" }),
    t("contrat.auditUa", { value: a.userAgent || "—" }),
    t("contrat.auditHashSent", { value: a.hashEnvoi }),
    t("contrat.auditHashSigned", { value: a.hashSigne ?? "—" }),
  ]) {
    ecrire(l, { size: 8, gap: 0.8 });
  }
  ecrire(t("contrat.auditNote"), { size: 7.5, gap: 0 });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(pdfSafe(t("contrat.page", { page: i, total: n })), 105, 292, { align: "center" });
  }
  return doc;
}
