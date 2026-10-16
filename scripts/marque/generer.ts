// Génère les fichiers du logo ZidarPro à partir de la géométrie de src/lib/marque.ts :
//   docs/marque/zidarpro-clair.svg, zidarpro-sombre.svg, zidarpro-symbole.svg, zidarpro-icone.svg
//   public/favicon.svg, favicon.ico (16, 32, 48), apple-touch-icon.png (180), icon-512.png
// Sans dépendance : rastérisation des polygones (suréchantillonnage 4 × 4), PNG via zlib.
// Lancer : bun scripts/marque/generer.ts

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import {
  BRIQUES,
  BRIQUES_ICONE,
  COULEURS_MARQUE,
  MARQUE_PARTIES,
  NOM_MARQUE,
  RAYON_ICONE,
  cheminSvg,
  couleurBrique,
  type Brique,
  type VarianteMarque,
} from "../../src/lib/marque";

// ---------------------------------------------------------------- SVG
const chemins = (briques: readonly Brique[], v: VarianteMarque) =>
  briques.map((b) => `<path d="${cheminSvg(b)}" fill="${couleurBrique(b, v)}"/>`).join("");

const svgIcone = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${NOM_MARQUE}</title>` +
  `<rect width="64" height="64" rx="${RAYON_ICONE}" fill="${COULEURS_MARQUE.bleu}"/>` +
  `${chemins(BRIQUES_ICONE, "sombre")}</svg>\n`;

const svgSymbole = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${NOM_MARQUE}</title>` +
  `${chemins(BRIQUES, "clair")}</svg>\n`;

/** Logo complet (symbole + texte en Inter 800, repli sur les polices système). */
function svgLogo(v: VarianteMarque) {
  const [zidar, pro] = MARQUE_PARTIES;
  const fond =
    v === "sombre" ? `<rect width="300" height="80" fill="${COULEURS_MARQUE.bleu}"/>` : "";
  const texte = v === "clair" ? COULEURS_MARQUE.bleu : COULEURS_MARQUE.blanc;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><title>${NOM_MARQUE}</title>${fond}` +
    `<g transform="translate(8 8)">${chemins(BRIQUES, v)}</g>` +
    `<text x="80" y="54" font-family="Inter, Manrope, 'Segoe UI', Arial, sans-serif" ` +
    `font-weight="800" font-size="40" letter-spacing="-0.8">` +
    `<tspan fill="${texte}">${zidar}</tspan><tspan fill="${COULEURS_MARQUE.orange}">${pro}</tspan>` +
    `</text></svg>\n`
  );
}

// ---------------------------------------------------------------- Rastérisation
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function dansPolygone(x: number, y: number, pts: readonly (readonly [number, number])[]) {
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
function dansRectArrondi(x: number, y: number, r: number) {
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return x >= 0 && x <= 64 && y >= 0 && y <= 64 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Icône (fond bleu arrondi + briques simplifiées) en RGBA, taille × taille. */
function rasteriser(taille: number): Uint8Array {
  const px = new Uint8Array(taille * taille * 4);
  const S = 4;
  const bleu = hex(COULEURS_MARQUE.bleu);
  for (let py = 0; py < taille; py++)
    for (let pxx = 0; pxx < taille; pxx++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const x = ((pxx + (sx + 0.5) / S) * 64) / taille;
          const y = ((py + (sy + 0.5) / S) * 64) / taille;
          if (!dansRectArrondi(x, y, RAYON_ICONE)) continue;
          let c = bleu;
          for (const br of BRIQUES_ICONE)
            if (dansPolygone(x, y, br.points)) c = hex(couleurBrique(br, "sombre"));
          r += c[0];
          g += c[1];
          b += c[2];
          a += 255;
        }
      const n = S * S;
      const o = (py * taille + pxx) * 4;
      const cov = a / 255;
      px[o] = cov ? Math.round(r / cov) : 0;
      px[o + 1] = cov ? Math.round(g / cov) : 0;
      px[o + 2] = cov ? Math.round(b / cov) : 0;
      px[o + 3] = Math.round(a / n);
    }
  return px;
}

// ---------------------------------------------------------------- PNG et ICO
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function bloc(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function png(taille: number) {
  const rgba = rasteriser(taille);
  const brut = new Uint8Array(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y++)
    brut.set(rgba.subarray(y * taille * 4, (y + 1) * taille * 4), y * (taille * 4 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, taille);
  dv.setUint32(4, taille);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(brut, { level: 9 })),
    bloc("IEND", new Uint8Array()),
  ]);
}
/** ICO contenant des PNG (format accepté par tous les navigateurs actuels). */
function ico(tailles: number[]) {
  const images = tailles.map(png);
  const entete = Buffer.alloc(6 + 16 * tailles.length);
  entete.writeUInt16LE(0, 0);
  entete.writeUInt16LE(1, 2);
  entete.writeUInt16LE(tailles.length, 4);
  let decalage = entete.length;
  tailles.forEach((t, i) => {
    const o = 6 + 16 * i;
    entete.writeUInt8(t >= 256 ? 0 : t, o);
    entete.writeUInt8(t >= 256 ? 0 : t, o + 1);
    entete.writeUInt16LE(1, o + 4);
    entete.writeUInt16LE(32, o + 6);
    entete.writeUInt32LE(images[i].length, o + 8);
    entete.writeUInt32LE(decalage, o + 12);
    decalage += images[i].length;
  });
  return Buffer.concat([entete, ...images]);
}

// ---------------------------------------------------------------- Écriture
const fichiers: [string, string | Buffer][] = [
  ["docs/marque/zidarpro-clair.svg", svgLogo("clair")],
  ["docs/marque/zidarpro-sombre.svg", svgLogo("sombre")],
  ["docs/marque/zidarpro-symbole.svg", svgSymbole()],
  ["docs/marque/zidarpro-icone.svg", svgIcone()],
  ["public/favicon.svg", svgIcone()],
  ["public/favicon.ico", ico([16, 32, 48])],
  ["public/apple-touch-icon.png", png(180)],
  ["public/icon-512.png", png(512)],
];
for (const [chemin, contenu] of fichiers) {
  writeFileSync(chemin, contenu);
  console.log(`✓ ${chemin}`);
}
