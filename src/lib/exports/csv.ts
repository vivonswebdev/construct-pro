/**
 * CSV pour Excel belge : séparateur « ; », UTF-8 avec BOM, décimales à virgule sans symbole,
 * fin de ligne CRLF, toutes les valeurs entre guillemets (échappement des « " »).
 */

/** 1234.5 -> "1234,50" ; null -> "". */
export function nombreCsv(n: number | null | undefined, decimales = 2): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toFixed(decimales).replace(".", ",");
}

/** AAAA-MM-JJ (ou ISO) -> JJ/MM/AAAA. */
export function dateCsv(d: string | null | undefined): string {
  if (!d) return "";
  const [a, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function versCsv(entetes: string[], lignes: (string | number | null | undefined)[][]) {
  return (
    "﻿" +
    [entetes, ...lignes]
      .map((l) => l.map((v) => echapper(v == null ? "" : String(v))).join(";"))
      .join("\r\n")
  );
}

/** Nom de fichier sûr (accents conservés, caractères spéciaux remplacés). */
export const nomFichier = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export function telechargerCsv(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomFichier(nom)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
