/**
 * Journal des prestations d'un chantier et totaux par sous-traitant : fonctions PURES (aucun
 * accès réseau), testées dans scripts/tests/journal.check.ts.
 */
import { produitArrondiCent } from "../retenue-30bis";

export type ContratChantier = {
  id: string;
  sous_traitant_id: string;
  type_prix: string;
  montant_forfait_ht: number | null;
  prix_unitaire_ht: number | null;
  unite: string | null;
};
export type PrestationChantier = {
  id: string;
  contrat_id: string;
  date_prestation: string;
  description: string | null;
  heures: number | null;
  ouvriers: unknown;
  presence_enregistree: boolean;
  valide_le: string | null;
};
export type PaiementChantier = {
  contrat_id: string;
  montant_ht: number;
  retenue_onss: number;
  retenue_spf: number;
  montant_verse: number | null;
  annule_le: string | null;
};

export type Ouvrier = { nom: string; fonction?: string | null; heures?: number | null };
export const ouvriersDe = (j: unknown): Ouvrier[] =>
  Array.isArray(j) ? (j as Ouvrier[]).filter((o) => o && typeof o.nom === "string") : [];

export type TotalSousTraitant = {
  sousTraitantId: string;
  sousTraitant: string;
  prestations: number;
  prestationsValidees: number;
  heures: number;
  /** Montant des contrats au forfait (HTVA) ; null s'il n'y en a pas. */
  forfait: number | null;
  /** Heures × prix horaire, pour les contrats à l'heure (estimation) ; null sinon. */
  valeurHoraire: number | null;
  payeHt: number;
  retenues: number;
  verse: number;
  /** Forfait − payé HTVA (null sans forfait). */
  resteForfait: number | null;
};

const somme = (xs: number[]) =>
  produitArrondiCent(
    xs.reduce((a, b) => a + b, 0),
    1,
  );

export function totauxParSousTraitant(
  contrats: ContratChantier[],
  prestations: PrestationChantier[],
  paiements: PaiementChantier[],
  noms: Map<string, string>,
): TotalSousTraitant[] {
  const parSt = new Map<string, ContratChantier[]>();
  for (const c of contrats)
    parSt.set(c.sous_traitant_id, [...(parSt.get(c.sous_traitant_id) ?? []), c]);

  return [...parSt.entries()]
    .map(([stId, cs]): TotalSousTraitant => {
      const ids = new Set(cs.map((c) => c.id));
      const pr = prestations.filter((p) => ids.has(p.contrat_id));
      const pa = paiements.filter((p) => ids.has(p.contrat_id) && !p.annule_le);
      const forfaits = cs.filter((c) => c.type_prix === "forfait" && c.montant_forfait_ht != null);
      const horaires = cs.filter((c) => c.type_prix === "horaire" && c.prix_unitaire_ht != null);
      const forfait = forfaits.length
        ? somme(forfaits.map((c) => Number(c.montant_forfait_ht)))
        : null;
      const valeurHoraire = horaires.length
        ? somme(
            horaires.map((c) =>
              produitArrondiCent(
                pr
                  .filter((p) => p.contrat_id === c.id)
                  .reduce((a, p) => a + Number(p.heures ?? 0), 0),
                Number(c.prix_unitaire_ht),
              ),
            ),
          )
        : null;
      const payeHt = somme(pa.map((p) => Number(p.montant_ht)));
      return {
        sousTraitantId: stId,
        sousTraitant: noms.get(stId) ?? "",
        prestations: pr.length,
        prestationsValidees: pr.filter((p) => p.valide_le).length,
        heures: somme(pr.map((p) => Number(p.heures ?? 0))),
        forfait,
        valeurHoraire,
        payeHt,
        retenues: somme(pa.map((p) => Number(p.retenue_onss) + Number(p.retenue_spf))),
        verse: somme(pa.map((p) => Number(p.montant_verse ?? 0))),
        resteForfait: forfait == null ? null : produitArrondiCent(forfait - payeHt, 1),
      };
    })
    .sort((a, b) => a.sousTraitant.localeCompare(b.sousTraitant));
}

/** Totaux du chantier (toutes lignes). */
export function totalChantier(t: TotalSousTraitant[]) {
  return {
    prestations: t.reduce((a, l) => a + l.prestations, 0),
    heures: somme(t.map((l) => l.heures)),
    payeHt: somme(t.map((l) => l.payeHt)),
    retenues: somme(t.map((l) => l.retenues)),
    verse: somme(t.map((l) => l.verse)),
  };
}

export type LigneJournal = {
  date: string;
  sousTraitant: string;
  description: string;
  heures: number | null;
  ouvriers: Ouvrier[];
  presence: boolean;
  valideLe: string | null;
};

/** Lignes du journal, par date croissante puis sous-traitant. */
export function lignesJournal(
  contrats: ContratChantier[],
  prestations: PrestationChantier[],
  noms: Map<string, string>,
): LigneJournal[] {
  const st = new Map(contrats.map((c) => [c.id, c.sous_traitant_id]));
  return prestations
    .map((p) => ({
      date: p.date_prestation,
      sousTraitant: noms.get(st.get(p.contrat_id) ?? "") ?? "",
      description: p.description ?? "",
      heures: p.heures == null ? null : Number(p.heures),
      ouvriers: ouvriersDe(p.ouvriers),
      presence: p.presence_enregistree,
      valideLe: p.valide_le,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sousTraitant.localeCompare(b.sousTraitant));
}
