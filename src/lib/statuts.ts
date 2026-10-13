/**
 * Codes neutres stockés en base (statuts, types, contrats), traduits à l'affichage
 * via le namespace i18n "statuts" : t(`statuts:chantier.${code}`).
 */

export const CHANTIER_STATUTS = ["en_attente", "en_cours", "en_retard", "termine"] as const;
export type ChantierStatut = (typeof CHANTIER_STATUTS)[number];

export const DEVIS_STATUTS = ["brouillon", "envoye", "accepte", "refuse", "expire"] as const;
export type DevisStatut = (typeof DEVIS_STATUTS)[number];

export const PRESENCE_STATUTS = ["present", "absent", "conge"] as const;
export type PresenceStatut = (typeof PRESENCE_STATUTS)[number];

export const PERSONNEL_STATUTS = ["actif", "inactif"] as const;
export type PersonnelStatut = (typeof PERSONNEL_STATUTS)[number];

export const CONTRATS = ["cdi", "cdd", "interim", "independant"] as const;
export type Contrat = (typeof CONTRATS)[number];
/** Contrats de travail soumis à précompte / ONSS (hors indépendants). */
export const CONTRATS_SALARIES: readonly string[] = ["cdi", "cdd", "interim"];

export const VEHICULE_STATUTS = ["disponible", "affecte", "maintenance"] as const;
export type VehiculeStatut = (typeof VEHICULE_STATUTS)[number];

export const VEHICULE_TYPES = ["camionnette", "camion", "voiture", "engin", "remorque"] as const;
export type VehiculeType = (typeof VEHICULE_TYPES)[number];

export const MOUVEMENT_TYPES = ["achat", "sortie", "retour"] as const;
export type MouvementType = (typeof MOUVEMENT_TYPES)[number];

/**
 * Normalise une valeur en code : 'En cours' -> 'en_cours', 'Intérim' -> 'interim'.
 * Même règle que la fonction SQL public.to_code : tolère les anciennes valeurs en français
 * tant que la migration de phase 1 n'est pas appliquée.
 */
export function toCode(v: string | null | undefined): string {
  return (v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}
