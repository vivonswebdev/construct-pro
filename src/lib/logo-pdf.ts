/**
 * Logo de la société pour les PDF : préchargé à l'ouverture de l'application (useLogoEntreprise),
 * lu de façon synchrone par les générateurs. Sans dépendance (utilisable dans les tests).
 */
export type LogoPdf = { dataUrl: string; largeur: number; hauteur: number };

// Logo courant pour les PDF (préchargé à l'ouverture de l'application, lu de façon synchrone par
// les générateurs de PDF). null : rendu sans logo, comme avant.
let logoPdf: LogoPdf | null = null;
export const definirLogoPdf = (l: LogoPdf | null) => {
  logoPdf = l;
};
export const logoPdfCourant = () => logoPdf;

/** Dimensions (mm) d'un logo tenant dans une boîte, proportions conservées. */
export function tailleDansBoite(l: LogoPdf, maxL: number, maxH: number) {
  const k = Math.min(maxL / l.largeur, maxH / l.hauteur);
  return { l: l.largeur * k, h: l.hauteur * k };
}
