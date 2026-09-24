export function formatEUR(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${Math.round(v).toLocaleString("fr-BE").replace(/,/g, " ")} €`;
}

export function formatEURk(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${Math.round(v / 1000)} k€`;
}

export function formatDateBE(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function daysUntil(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const diff = date.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-blue-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
