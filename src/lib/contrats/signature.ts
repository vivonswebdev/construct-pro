import type { Json } from "@/integrations/supabase/types";
import { exportContratPDF } from "./pdf";
import {
  appliquerChamps,
  faitA,
  rendreContrat,
  type ChampsSousTraitant,
  type DonneesContrat,
} from "./sous-traitance";
import { langueDocument } from "@/lib/invoice-pdf";

/** Lien public de signature (page /signer/$token). */
export const lienSignature = (token: string) => `${window.location.origin}/signer/${token}`;

/** Demande de signature telle que renvoyée par contrat_a_signer (et sous-ensemble de la table). */
export type SignatureContrat = {
  langue: string;
  donnees: Json;
  document_hash: string;
  statut: string;
  expire_le: string;
  entreprise_signataire_nom: string;
  entreprise_signataire_qualite: string;
  entreprise_signature: string;
  entreprise_signe_le: string;
  signataire_nom: string | null;
  signataire_qualite: string | null;
  signataire_champs: Json | null;
  signe_lieu: string | null;
  signature: string | null;
  signe_le: string | null;
  signe_ip: string | null;
  signe_hash: string | null;
  consulte_le?: string | null;
  signe_user_agent?: string | null;
};

export const donneesDe = (s: Pick<SignatureContrat, "donnees">) =>
  s.donnees as unknown as DonneesContrat;
export const champsDe = (s: Pick<SignatureContrat, "signataire_champs">) =>
  (s.signataire_champs ?? null) as Partial<ChampsSousTraitant> | null;

/** État affiché : un lien non signé dont la date est dépassée est « expiré ». */
export function etatSignature(s: Pick<SignatureContrat, "statut" | "expire_le">) {
  if (s.statut === "envoye" && new Date(s.expire_le) < new Date()) return "expire";
  return s.statut as "envoye" | "signe" | "annule";
}

export function telechargerContratPDF(s: SignatureContrat): Promise<void> {
  const d = appliquerChamps(donneesDe(s), champsDe(s));
  return exportContratPDF({
    blocs: rendreContrat(d),
    faitA: faitA(s.signe_lieu, s.signe_le),
    entrepriseNom: d.entreprise.denomination,
    entreprise: {
      nom: s.entreprise_signataire_nom,
      qualite: s.entreprise_signataire_qualite,
      image: s.entreprise_signature,
      le: s.entreprise_signe_le,
    },
    sousTraitant: {
      nom: s.signataire_nom,
      qualite: s.signataire_qualite,
      image: s.signature,
      le: s.signe_le,
    },
    audit: {
      envoyeLe: s.entreprise_signe_le,
      consulteLe: s.consulte_le ?? null,
      signeLe: s.signe_le,
      ip: s.signe_ip,
      userAgent: s.signe_user_agent ?? null,
      hashEnvoi: s.document_hash,
      hashSigne: s.signe_hash,
    },
    lang: langueDocument(s.langue),
    fichier: `Contrat-sous-traitance-${d.fiche.reference}-${d.sousTraitant.denomination}`
      .replace(/[^\p{L}\p{N}-]+/gu, "-")
      .slice(0, 100),
  });
}
