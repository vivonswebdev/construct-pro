/**
 * Registre des modèles de contrat. Chaque demande de signature enregistre le code du modèle
 * utilisé à l'envoi (`contrat_signatures.modele`) : elle est TOUJOURS rendue, vérifiée et
 * imprimée avec ce modèle-là, jamais avec le modèle courant. Ainsi un lien v1 reste signable et
 * un contrat v1 signé reste imprimé en v1 après la publication d'une v2.
 *
 * Fonctions pures (ni React ni i18n) : testées dans scripts/tests/modeles-contrat.check.ts.
 *
 * Ajouter une version : nouveau fichier de texte (ne jamais modifier un texte publié), nouvelle
 * entrée dans MODELES, puis MODELE_COURANT pointe sur elle.
 */
import {
  MODELE_SOUS_TRAITANCE_V1,
  appliquerChamps,
  faitA as faitAV1,
  rendreContrat as rendreV1,
  sha256Hex,
  texteContrat,
  type Bloc,
  type ChampsSousTraitant,
  type DonneesContrat,
} from "./sous-traitance";

export type ModeleContrat = {
  code: string;
  /** Corps du contrat (la zone de signature est rendue à part). */
  rendre: (d: DonneesContrat) => Bloc[];
  /** Mention « Fait à …, le … » (fait partie de l'empreinte signée). */
  faitA: (lieu: string | null | undefined, date: string | null | undefined) => string;
};
export type RegistreModeles = Readonly<Record<string, ModeleContrat>>;

export const MODELES: RegistreModeles = {
  [MODELE_SOUS_TRAITANCE_V1]: { code: MODELE_SOUS_TRAITANCE_V1, rendre: rendreV1, faitA: faitAV1 },
};

/** Modèle des NOUVEAUX envois uniquement. */
export const MODELE_COURANT = MODELE_SOUS_TRAITANCE_V1;

/** Code de modèle absent ou inconnu : on refuse plutôt que d'afficher un autre texte. */
export class ModeleInconnuError extends Error {
  constructor(public readonly modele: string | null | undefined) {
    super("modele_inconnu");
    this.name = "ModeleInconnuError";
  }
}

export function modeleContrat(
  code: string | null | undefined,
  registre: RegistreModeles = MODELES,
): ModeleContrat {
  const m = code && Object.hasOwn(registre, code) ? registre[code] : undefined;
  if (!m) throw new ModeleInconnuError(code);
  return m;
}

export const modeleConnu = (code: string | null | undefined, registre: RegistreModeles = MODELES) =>
  !!code && Object.hasOwn(registre, code);

/** Empreinte du document tel qu'envoyé (sans les corrections du sous-traitant). */
export const empreinteEnvoi = (
  code: string,
  d: DonneesContrat,
  registre: RegistreModeles = MODELES,
) => sha256Hex(texteContrat(modeleContrat(code, registre).rendre(d)));

/** Empreinte du document final signé (corrections, lieu et date compris). */
export function empreinteSignee(
  code: string,
  d: DonneesContrat,
  champs: Partial<ChampsSousTraitant>,
  lieu: string,
  date: string,
  registre: RegistreModeles = MODELES,
) {
  const m = modeleContrat(code, registre);
  return sha256Hex(`${texteContrat(m.rendre(appliquerChamps(d, champs)))}\n${m.faitA(lieu, date)}`);
}

/** Demande de signature : champs nécessaires au rendu. */
export type DemandeRendu = {
  modele: string;
  donnees: unknown;
  signataire_champs: unknown;
  signe_lieu: string | null;
  signe_le: string | null;
};

/**
 * Document d'une demande, dans SON modèle, avec les corrections du sous-traitant : page « contrat
 * signé » et PDF (les deux côtés).
 */
export function documentDemande(s: DemandeRendu, registre: RegistreModeles = MODELES) {
  const m = modeleContrat(s.modele, registre);
  const donnees = appliquerChamps(
    s.donnees as DonneesContrat,
    (s.signataire_champs ?? null) as Partial<ChampsSousTraitant> | null,
  );
  return { donnees, blocs: m.rendre(donnees), faitA: m.faitA(s.signe_lieu, s.signe_le) };
}
