import type jsPDF from "jspdf";
import {
  BRIQUES,
  COULEURS_MARQUE,
  MARQUE_PARTIES,
  TAILLE_SYMBOLE,
  couleurBrique,
  type VarianteMarque,
} from "./marque";

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/**
 * Logo ZidarPro vectoriel dans un PDF (symbole en briques + « Zidar » « Pro »), sans image.
 * (x, y) : coin supérieur gauche ; `hauteur` en mm. Renvoie la largeur dessinée (mm).
 * Jamais utilisé dans les contrats.
 */
export function dessinerMarquePdf(
  doc: jsPDF,
  x: number,
  y: number,
  hauteur: number,
  variante: VarianteMarque = "clair",
): number {
  const k = hauteur / TAILLE_SYMBOLE;
  for (const b of BRIQUES) {
    const [x0, y0] = b.points[0];
    const deltas = b.points.slice(1).map(([px, py], i) => {
      const [qx, qy] = b.points[i];
      return [(px - qx) * k, (py - qy) * k];
    });
    doc.setFillColor(...rgb(couleurBrique(b, variante)));
    doc.lines(deltas, x + x0 * k, y + y0 * k, [1, 1], "F", true);
  }
  const [zidar, pro] = MARQUE_PARTIES;
  const taille = hauteur * 1.55; // points : texte un peu moins haut que le symbole
  doc.setFont("helvetica", "bold");
  doc.setFontSize(taille);
  const xt = x + hauteur * 1.05;
  const yt = y + hauteur * 0.72;
  doc.setTextColor(...rgb(variante === "clair" ? COULEURS_MARQUE.bleu : COULEURS_MARQUE.blanc));
  doc.text(zidar, xt, yt);
  const lz = doc.getTextWidth(zidar);
  doc.setTextColor(...rgb(COULEURS_MARQUE.orange));
  doc.text(pro, xt + lz, yt);
  return xt + lz + doc.getTextWidth(pro) - x;
}

export const couleurMarquePdf = (c: keyof typeof COULEURS_MARQUE) => rgb(COULEURS_MARQUE[c]);
