/**
 * Identité ZidarPro : nom, couleurs et géométrie du symbole (Z en briques), partagés par le
 * composant React, le favicon (scripts/marque/generer_icones.py), les SVG de docs/marque et le
 * dessin vectoriel dans les PDF. Sans dépendance (utilisable dans les tests et les scripts).
 */
export const NOM_MARQUE = "ZidarPro"; // i18n-ignore : nom de marque
export const MARQUE_PARTIES = ["Zidar", "Pro"] as const; // i18n-ignore : nom de marque

export const COULEURS_MARQUE = {
  bleu: "#0F2A43",
  orange: "#F59E0B",
  blanc: "#FFFFFF",
} as const;

export type Point = readonly [number, number];
/** `principal` : bleu (clair) ou blanc (sombre) ; `accent` : toujours orange. */
export type Brique = { role: "principal" | "accent"; points: readonly Point[] };

/** Symbole sur une grille 64 × 64 (marge de 6 unités). */
export const TAILLE_SYMBOLE = 64;
export const BRIQUES: readonly Brique[] = [
  // Rangée 1
  {
    role: "principal",
    points: [
      [6, 6],
      [34, 6],
      [34, 13],
      [6, 13],
    ],
  },
  {
    role: "accent",
    points: [
      [37, 6],
      [58, 6],
      [58, 13],
      [37, 13],
    ],
  },
  // Rangée 2 (brique orange en biseau)
  {
    role: "principal",
    points: [
      [6, 16],
      [20, 16],
      [20, 23],
      [6, 23],
    ],
  },
  {
    role: "accent",
    points: [
      [23, 16],
      [58, 16],
      [51, 23],
      [23, 23],
    ],
  },
  // Diagonale du Z
  {
    role: "principal",
    points: [
      [44, 26],
      [54, 26],
      [16, 47],
      [6, 47],
    ],
  },
  // Rangée 4 (biseau parallèle à la diagonale)
  {
    role: "principal",
    points: [
      [33, 40],
      [58, 40],
      [58, 47],
      [20, 47],
    ],
  },
  // Rangée 5
  {
    role: "accent",
    points: [
      [6, 50],
      [27, 50],
      [27, 57],
      [6, 57],
    ],
  },
  {
    role: "principal",
    points: [
      [30, 50],
      [58, 50],
      [58, 57],
      [30, 57],
    ],
  },
];

/**
 * Version simplifiée pour les petites tailles (favicon 16–48 px) : trois rangées épaisses, à
 * dessiner en variante « sombre » sur un carré bleu arrondi.
 */
export const BRIQUES_ICONE: readonly Brique[] = [
  {
    role: "principal",
    points: [
      [8, 8],
      [36, 8],
      [36, 20],
      [8, 20],
    ],
  },
  {
    role: "accent",
    points: [
      [40, 8],
      [56, 8],
      [56, 20],
      [40, 20],
    ],
  },
  {
    role: "principal",
    points: [
      [42, 24],
      [56, 24],
      [22, 40],
      [8, 40],
    ],
  },
  {
    role: "accent",
    points: [
      [8, 44],
      [26, 44],
      [26, 56],
      [8, 56],
    ],
  },
  {
    role: "principal",
    points: [
      [30, 44],
      [56, 44],
      [56, 56],
      [30, 56],
    ],
  },
];
/** Rayon d'angle du carré de fond de l'icône (grille 64). */
export const RAYON_ICONE = 12;

export type VarianteMarque = "clair" | "sombre";

export const couleurBrique = (b: Brique, v: VarianteMarque) =>
  b.role === "accent"
    ? COULEURS_MARQUE.orange
    : v === "clair"
      ? COULEURS_MARQUE.bleu
      : COULEURS_MARQUE.blanc;

/** Attribut `d` SVG d'une brique. */
export const cheminSvg = (b: Brique) => `M${b.points.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;
