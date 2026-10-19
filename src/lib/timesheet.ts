/**
 * Timesheet de l'équipe interne : périodes (jour / semaine / mois), durées et totaux.
 * Fonctions pures (testées par scripts/tests/timesheet.check.ts) ; la durée d'un pointage est
 * calculée en base (colonne générée `minutes_travaillees`).
 */
import { errorMessage } from "./utils";

export const VUES_TIMESHEET = ["jour", "semaine", "mois"] as const;
export type VueTimesheet = (typeof VUES_TIMESHEET)[number];

/** Codes d'erreur levés par la migration 20261020090000 (traduits dans timesheet:errors). */
export const ERREURS_POINTAGE = [
  "pointage_motif_obligatoire",
  "pointage_chevauchement",
  "pointage_travailleur_inactif",
  "pointage_champ_protege",
  "pointage_introuvable",
  "pointages_horaires_chk",
  "personnel_lien_compte_reserve",
  "personnel_lien_compte_autre_societe",
] as const;
export type ErreurPointage = (typeof ERREURS_POINTAGE)[number];

export function codeErreurPointage(err: unknown): ErreurPointage | null {
  const m = errorMessage(err, "");
  return ERREURS_POINTAGE.find((c) => m.includes(c)) ?? null;
}

/** Date locale -> AAAA-MM-JJ (sans passer par UTC). */
export function isoJour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** AAAA-MM-JJ -> Date locale à midi (évite les décalages d'heure d'été). */
export function depuisIso(s: string): Date {
  const [a, m, j] = s.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, j, 12);
}

export function decalerJours(s: string, n: number): string {
  const d = depuisIso(s);
  d.setDate(d.getDate() + n);
  return isoJour(d);
}

/** Bornes incluses de la période contenant `ref` : semaine du lundi au dimanche. */
export function periode(vue: VueTimesheet, ref: string): { debut: string; fin: string } {
  const d = depuisIso(ref);
  if (vue === "jour") return { debut: ref, fin: ref };
  if (vue === "semaine") {
    const lundi = decalerJours(ref, -((d.getDay() + 6) % 7));
    return { debut: lundi, fin: decalerJours(lundi, 6) };
  }
  return {
    debut: isoJour(new Date(d.getFullYear(), d.getMonth(), 1, 12)),
    fin: isoJour(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)),
  };
}

/** Période précédente (-1) ou suivante (+1). */
export function periodeVoisine(vue: VueTimesheet, ref: string, sens: -1 | 1): string {
  if (vue === "jour") return decalerJours(ref, sens);
  if (vue === "semaine") return decalerJours(ref, 7 * sens);
  const d = depuisIso(ref);
  return isoJour(new Date(d.getFullYear(), d.getMonth() + sens, 1, 12));
}

export function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let j = debut; j <= fin; j = decalerJours(j, 1)) out.push(j);
  return out;
}

/** Numéro de semaine ISO 8601. */
export function semaineIso(s: string): number {
  const d = depuisIso(s);
  const jeudi = new Date(d);
  jeudi.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const premierJeudi = new Date(jeudi.getFullYear(), 0, 4, 12);
  return (
    1 +
    Math.round(
      ((jeudi.getTime() - premierJeudi.getTime()) / 86400000 -
        3 +
        ((premierJeudi.getDay() + 6) % 7)) /
        7,
    )
  );
}

/** 450 -> « 7:30 » ; null -> « — ». Format neutre, identique dans toutes les langues. */
export function formatDuree(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const signe = minutes < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutes));
  return `${signe}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** 450 -> 7,5 (heures décimales, pour le CSV et le secrétariat social). */
export const heuresDecimales = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** « 07:30:00 » -> « 07:30 ». */
export const heureCourte = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** Minutes entre deux heures « HH:MM », pause déduite ; null si incohérent. */
export function dureeSaisie(arrivee: string, depart: string, pause: number): number | null {
  const enMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  if (!arrivee || !depart) return null;
  const brut = enMin(depart) - enMin(arrivee);
  if (brut <= 0 || pause < 0 || pause >= brut) return null;
  return brut - pause;
}

export type PointageCalcul = {
  personnel_id: string;
  chantier_id: string;
  date: string;
  minutes_travaillees: number | null;
};

/** Somme des minutes par clé (travailleur, chantier, jour…) ; pointages en cours ignorés. */
export function totauxPar<T extends PointageCalcul>(
  pointages: T[],
  cle: (p: T) => string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pointages) {
    if (p.minutes_travaillees == null) continue;
    m.set(cle(p), (m.get(cle(p)) ?? 0) + p.minutes_travaillees);
  }
  return m;
}

export const totalMinutes = (pointages: PointageCalcul[]) =>
  pointages.reduce((s, p) => s + (p.minutes_travaillees ?? 0), 0);

/** Grille semaine / mois : minutes[travailleur][jour]. */
export function grille(pointages: PointageCalcul[]): Map<string, Map<string, number>> {
  const g = new Map<string, Map<string, number>>();
  for (const p of pointages) {
    if (p.minutes_travaillees == null) continue;
    const ligne = g.get(p.personnel_id) ?? new Map<string, number>();
    ligne.set(p.date, (ligne.get(p.date) ?? 0) + p.minutes_travaillees);
    g.set(p.personnel_id, ligne);
  }
  return g;
}
