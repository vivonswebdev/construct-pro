import type { TFunction } from "i18next";
import { toCode } from "@/lib/statuts";

/** Couleur du badge de statut (chantier ou étape), par code. */
export const STATUT_CHANTIER_STYLES: Record<string, string> = {
  en_cours: "bg-cyan-100 text-cyan-700",
  en_retard: "bg-red-100 text-red-700",
  termine: "bg-emerald-100 text-emerald-700",
  en_attente: "bg-amber-100 text-amber-700",
};

export const statutChantierStyle = (status: string | null | undefined) =>
  STATUT_CHANTIER_STYLES[toCode(status)] ?? "bg-muted";

/** Étapes créées par défaut avec un chantier (libellés dans chantiers:phases). */
export const PHASES_PAR_DEFAUT = [
  "preparation",
  "fondations",
  "grosOeuvre",
  "charpente",
  "secondOeuvre",
  "finitions",
  "reception",
] as const;

/** Noms des étapes par défaut, dans la langue de l'utilisateur qui crée le chantier. */
export function nomsPhasesParDefaut(t: TFunction<"chantiers">): string[] {
  return PHASES_PAR_DEFAUT.map((k) => t(`phases.${k}`));
}
