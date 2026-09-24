// Belgian compliance helpers

export function formatEURBE(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return (
    v
      .toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/\u202f/g, " ")
      .replace(/\u00a0/g, " ") + " €"
  );
}

export function cleanVAT(input: string): string {
  return input.replace(/[\s.-]/g, "").toUpperCase();
}

export function formatVATDisplay(vat: string): string {
  const c = cleanVAT(vat);
  if (!/^BE\d{10}$/.test(c)) return vat;
  return `${c.slice(0, 2)}${c.slice(2, 6)} ${c.slice(6, 9)} ${c.slice(9)}`;
}

export function isValidVAT(input: string): boolean {
  return /^BE\d{10}$/.test(cleanVAT(input));
}

export function quarterOfMonth(month0: number): number {
  return Math.floor(month0 / 3) + 1;
}

export function onssDueDate(quarter: number, year: number): Date {
  // Q1 -> 30 Apr, Q2 -> 31 Jul, Q3 -> 31 Oct, Q4 -> 31 Jan next year
  if (quarter === 1) return new Date(year, 3, 30);
  if (quarter === 2) return new Date(year, 6, 31);
  if (quarter === 3) return new Date(year, 9, 31);
  return new Date(year + 1, 0, 31);
}

export function precompteDueDate(month0: number, year: number): Date {
  // 15 of following month
  const m = month0 === 11 ? 0 : month0 + 1;
  const y = month0 === 11 ? year + 1 : year;
  return new Date(y, m, 15);
}

export const DEFAULTS = {
  precompteRate: 0.18,
  onssEmployeeRate: 0.1307,
  onssEmployerRate: 0.27,
};

export const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
