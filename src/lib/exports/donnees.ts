import { supabase } from "@/integrations/supabase/client";
import type { LigneConformite } from "@/lib/conformite";
import type {
  ChantierSrc,
  ContratSrc,
  PaiementSrc,
  PrestationSrc,
  SousTraitantSrc,
  VerificationSrc,
} from "./registre";

const PAQUET = 1000;

/** Lit toutes les lignes d'une requête, par paquets (Supabase renvoie 1 000 lignes au plus). */
async function toutLire<T>(
  requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const tout: T[] = [];
  for (let de = 0; ; de += PAQUET) {
    const { data, error } = await requete(de, de + PAQUET - 1);
    if (error) throw error;
    tout.push(...(data ?? []));
    if (!data || data.length < PAQUET) return tout;
  }
}

/** Données de sous-traitance d'une période (RLS : société de l'utilisateur uniquement). */
export async function chargerSourcesSousTraitance(periode: { du: string; au: string }) {
  const [paiements, prestations, contrats, sousTraitants, chantiers, conformite] =
    await Promise.all([
      toutLire<PaiementSrc>((de, a) =>
        supabase
          .from("achat_paiements")
          .select(
            "id, contrat_id, date_paiement, montant_ht, montant_tva, retenue_onss, retenue_spf, montant_verse, reference, verification_30bis_id, annule_le",
          )
          .gte("date_paiement", periode.du)
          .lte("date_paiement", periode.au)
          .order("date_paiement")
          .range(de, a),
      ),
      toutLire<PrestationSrc>((de, a) =>
        supabase
          .from("sous_traitant_prestations")
          .select("contrat_id, date_prestation, heures")
          .gte("date_prestation", periode.du)
          .lte("date_prestation", periode.au)
          .order("date_prestation")
          .range(de, a),
      ),
      toutLire<ContratSrc>((de, a) =>
        supabase
          .from("sous_traitant_contrats")
          .select("id, sous_traitant_id, chantier_id")
          .order("id")
          .range(de, a),
      ),
      toutLire<SousTraitantSrc>((de, a) =>
        supabase
          .from("sous_traitants")
          .select("id, raison_sociale, numero_bce, statut")
          .order("raison_sociale")
          .range(de, a),
      ),
      toutLire<ChantierSrc>((de, a) =>
        supabase.from("chantiers").select("id, name, client_name").order("name").range(de, a),
      ),
      supabase.rpc("conformite_sous_traitants"),
    ]);

  const idsVerif = [
    ...new Set(paiements.map((p) => p.verification_30bis_id).filter((x): x is string => !!x)),
  ];
  const verifications: VerificationSrc[] = [];
  for (let i = 0; i < idsVerif.length; i += 200) {
    const { data, error } = await supabase
      .from("verifications_30bis")
      .select("id, verifie_le, dette_sociale, dette_fiscale")
      .in("id", idsVerif.slice(i, i + 200));
    if (error) throw error;
    verifications.push(...(data ?? []));
  }
  if (conformite.error) throw conformite.error;

  return {
    paiements,
    prestations,
    contrats,
    sousTraitants,
    chantiers,
    verifications,
    conformite: new Map(
      ((conformite.data ?? []) as LigneConformite[]).map((l) => [l.sous_traitant_id, l]),
    ),
  };
}
