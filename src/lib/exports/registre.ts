/**
 * Registre des retenues 30bis, dossier de conformité et export comptable : fonctions PURES
 * (aucun accès réseau, aucune dépendance au navigateur), testées dans scripts/tests.
 */
import { produitArrondiCent } from "../retenue-30bis";

// --- Données sources (sous-ensembles des tables Supabase) ------------------------------------
export type PaiementSrc = {
  id: string;
  contrat_id: string;
  date_paiement: string;
  montant_ht: number;
  montant_tva: number;
  retenue_onss: number;
  retenue_spf: number;
  montant_verse: number | null;
  reference: string | null;
  verification_30bis_id: string | null;
  annule_le: string | null;
};
export type ContratSrc = { id: string; sous_traitant_id: string; chantier_id: string | null };
export type SousTraitantSrc = {
  id: string;
  raison_sociale: string;
  numero_bce: string | null;
  statut: string;
};
export type ChantierSrc = { id: string; name: string; client_name: string | null };
export type VerificationSrc = {
  id: string;
  verifie_le: string;
  dette_sociale: boolean;
  dette_fiscale: boolean;
};
export type PrestationSrc = {
  contrat_id: string;
  date_prestation: string;
  heures: number | null;
};

export type StatutVerification =
  | "aucune_dette"
  | "dette_sociale"
  | "dette_fiscale"
  | "dettes"
  | "absente";

export const statutVerification = (v: VerificationSrc | null | undefined): StatutVerification =>
  !v
    ? "absente"
    : v.dette_sociale && v.dette_fiscale
      ? "dettes"
      : v.dette_sociale
        ? "dette_sociale"
        : v.dette_fiscale
          ? "dette_fiscale"
          : "aucune_dette";

// --- Registre ---------------------------------------------------------------------------------
export type FiltresRegistre = {
  du: string; // AAAA-MM-JJ inclus
  au: string; // AAAA-MM-JJ inclus
  sousTraitantId?: string;
  chantierId?: string;
  statut30bis?: "tous" | "dette" | "sans_dette";
  inclureAnnules?: boolean;
};

export type LigneRegistre = {
  paiementId: string;
  datePaiement: string;
  sousTraitantId: string;
  sousTraitant: string;
  bce: string | null;
  facture: string | null;
  ht: number;
  onss: number;
  spf: number;
  totalRetenu: number;
  verse: number;
  verifieLe: string | null;
  statutVerification: StatutVerification;
  chantierId: string | null;
  chantier: string | null;
  client: string | null;
  annule: boolean;
};

export function construireRegistre(
  src: {
    paiements: PaiementSrc[];
    contrats: ContratSrc[];
    sousTraitants: SousTraitantSrc[];
    chantiers: ChantierSrc[];
    verifications: VerificationSrc[];
  },
  f: FiltresRegistre,
): LigneRegistre[] {
  const contrat = new Map(src.contrats.map((c) => [c.id, c]));
  const st = new Map(src.sousTraitants.map((s) => [s.id, s]));
  const ch = new Map(src.chantiers.map((c) => [c.id, c]));
  const verif = new Map(src.verifications.map((v) => [v.id, v]));

  return src.paiements
    .filter((p) => p.date_paiement >= f.du && p.date_paiement <= f.au)
    .filter((p) => f.inclureAnnules || !p.annule_le)
    .map((p): LigneRegistre | null => {
      const c = contrat.get(p.contrat_id);
      if (!c) return null;
      const s = st.get(c.sous_traitant_id);
      const chantier = c.chantier_id ? ch.get(c.chantier_id) : undefined;
      const v = p.verification_30bis_id ? verif.get(p.verification_30bis_id) : undefined;
      const onss = Number(p.retenue_onss);
      const spf = Number(p.retenue_spf);
      return {
        paiementId: p.id,
        datePaiement: p.date_paiement,
        sousTraitantId: c.sous_traitant_id,
        sousTraitant: s?.raison_sociale ?? "",
        bce: s?.numero_bce ?? null,
        facture: p.reference,
        ht: Number(p.montant_ht),
        onss,
        spf,
        totalRetenu: produitArrondiCent(onss + spf, 1),
        verse: Number(
          p.montant_verse ??
            produitArrondiCent(Number(p.montant_ht) + Number(p.montant_tva) - onss - spf, 1),
        ),
        verifieLe: v?.verifie_le ?? null,
        statutVerification: statutVerification(v),
        chantierId: c.chantier_id,
        chantier: chantier?.name ?? null,
        client: chantier?.client_name ?? null,
        annule: !!p.annule_le,
      };
    })
    .filter((l): l is LigneRegistre => l !== null)
    .filter((l) => !f.sousTraitantId || l.sousTraitantId === f.sousTraitantId)
    .filter((l) => !f.chantierId || l.chantierId === f.chantierId)
    .filter((l) => {
      if (!f.statut30bis || f.statut30bis === "tous") return true;
      const dette = ["dette_sociale", "dette_fiscale", "dettes"].includes(l.statutVerification);
      return f.statut30bis === "dette" ? dette : !dette;
    })
    .sort(
      (a, b) =>
        a.datePaiement.localeCompare(b.datePaiement) ||
        a.sousTraitant.localeCompare(b.sousTraitant),
    );
}

/** Totaux hors paiements annulés. */
export function totauxRegistre(lignes: LigneRegistre[]) {
  const somme = (k: "ht" | "onss" | "spf" | "totalRetenu" | "verse") =>
    produitArrondiCent(
      lignes.filter((l) => !l.annule).reduce((s, l) => s + l[k], 0),
      1,
    );
  return {
    nombre: lignes.filter((l) => !l.annule).length,
    ht: somme("ht"),
    onss: somme("onss"),
    spf: somme("spf"),
    totalRetenu: somme("totalRetenu"),
    verse: somme("verse"),
  };
}

// --- Synthèse de conformité -------------------------------------------------------------------
export type SyntheseConformite = "conforme" | "a_verifier" | "bloque";
const OK = ["valide", "expire_bientot"];

export function syntheseConformite(l: {
  attestation_30bis: string;
  attestation_tva: string;
  iban: string;
  contrat: string;
  bloque: boolean;
}): SyntheseConformite {
  if (l.bloque) return "bloque";
  return [l.attestation_30bis, l.attestation_tva, l.iban, l.contrat].every((s) => OK.includes(s))
    ? "conforme"
    : "a_verifier";
}

export type Exigence = "attestation_30bis" | "attestation_tva" | "iban" | "contrat";

export const exigencesManquantes = (l: {
  attestation_30bis: string;
  attestation_tva: string;
  iban: string;
  contrat: string;
}) =>
  (["attestation_30bis", "attestation_tva", "iban", "contrat"] as const).filter(
    (e) => !OK.includes(l[e]),
  );

// --- Export comptable ---------------------------------------------------------------------------
export type LigneComptable = {
  sousTraitantId: string;
  sousTraitant: string;
  bce: string | null;
  prestations: number;
  heures: number;
  ht: number;
  onss: number;
  spf: number;
  totalRetenu: number;
  verse: number;
  paiements: number;
  synthese: SyntheseConformite | null;
  manquants: Exigence[];
};

export function construireComptable(
  src: {
    paiements: PaiementSrc[];
    prestations: PrestationSrc[];
    contrats: ContratSrc[];
    sousTraitants: SousTraitantSrc[];
    conformite: Map<
      string,
      {
        attestation_30bis: string;
        attestation_tva: string;
        iban: string;
        contrat: string;
        bloque: boolean;
      }
    >;
  },
  periode: { du: string; au: string },
  inclureTous = false,
): LigneComptable[] {
  const stDuContrat = new Map(src.contrats.map((c) => [c.id, c.sous_traitant_id]));
  const dans = (d: string) => d >= periode.du && d <= periode.au;
  const paiements = src.paiements.filter((p) => !p.annule_le && dans(p.date_paiement));
  const prestations = src.prestations.filter((p) => dans(p.date_prestation));

  return src.sousTraitants
    .map((s): LigneComptable => {
      const ps = paiements.filter((p) => stDuContrat.get(p.contrat_id) === s.id);
      const pr = prestations.filter((p) => stDuContrat.get(p.contrat_id) === s.id);
      const somme = (f: (p: PaiementSrc) => number) =>
        produitArrondiCent(
          ps.reduce((t, p) => t + f(p), 0),
          1,
        );
      const onss = somme((p) => Number(p.retenue_onss));
      const spf = somme((p) => Number(p.retenue_spf));
      const c = src.conformite.get(s.id);
      return {
        sousTraitantId: s.id,
        sousTraitant: s.raison_sociale,
        bce: s.numero_bce,
        prestations: pr.length,
        heures: produitArrondiCent(
          pr.reduce((t, p) => t + Number(p.heures ?? 0), 0),
          1,
        ),
        ht: somme((p) => Number(p.montant_ht)),
        onss,
        spf,
        totalRetenu: produitArrondiCent(onss + spf, 1),
        verse: somme((p) =>
          Number(
            p.montant_verse ??
              Number(p.montant_ht) +
                Number(p.montant_tva) -
                Number(p.retenue_onss) -
                Number(p.retenue_spf),
          ),
        ),
        paiements: ps.length,
        synthese: c ? syntheseConformite(c) : null,
        manquants: c ? exigencesManquantes(c) : [],
      };
    })
    .filter((l) => inclureTous || l.paiements > 0 || l.prestations > 0)
    .sort((a, b) => a.sousTraitant.localeCompare(b.sousTraitant));
}
