/**
 * Retenues 30bis (ONSS, art. 30bis loi du 27/06/1969) et 402 CIR (SPF Finances).
 *
 * Les taux ne sont JAMAIS écrits en dur : ils viennent de la table datée `parametres_30bis`
 * (globale, lecture seule pour les utilisateurs). Valeurs indicatives, à valider par le comptable.
 * Module sans dépendance (testable hors navigateur) ; le calcul reproduit exactement le trigger
 * SQL `check_paiement_30bis` : montant HTVA × taux, arrondi au cent.
 */

export type Parametres30bis = {
  date_debut: string;
  taux_retenue_onss: number;
  taux_retenue_spf: number;
  date_verification: string | null;
  source: string | null;
};

/** Paramètres en vigueur à une date (AAAA-MM-JJ) : la ligne la plus récente avec date_debut <= date. */
export function tauxEnVigueur(
  lignes: readonly Parametres30bis[] | null | undefined,
  date: string,
): Parametres30bis | null {
  let retenu: Parametres30bis | null = null;
  for (const l of lignes ?? []) {
    if (l.date_debut <= date && (!retenu || l.date_debut > retenu.date_debut)) retenu = l;
  }
  return retenu;
}

/** Décimal exact : 51383.7 -> { n: 513837n, echelle: 1 } (les flottants ne sont pas exacts). */
function versDecimal(x: number): { n: bigint; echelle: number } {
  const s = x.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  const [ent, dec = ""] = s.split(".");
  return { n: BigInt(ent + dec), echelle: dec.length };
}

/**
 * montant × taux arrondi au cent « half away from zero », exactement comme
 * round(montant * taux, 2) en numeric PostgreSQL. Calcul en entiers (BigInt) : en flottant,
 * 51383.7 × 0.35 = 17984.294999… arrondirait à 17984.29 au lieu de 17984.30.
 */
export function produitArrondiCent(montant: number, taux: number): number {
  const a = versDecimal(montant);
  const b = versDecimal(taux);
  const p = a.n * b.n; // valeur × 10^(ea+eb)
  const echelle = a.echelle + b.echelle;
  const neg = p < 0n;
  const abs = neg ? -p : p;
  let cents: bigint;
  if (echelle <= 2) cents = abs * 10n ** BigInt(2 - echelle);
  else {
    const div = 10n ** BigInt(echelle - 2);
    cents = (abs + div / 2n) / div;
  }
  return (neg ? -1 : 1) * (Number(cents) / 100);
}

export function calculerRetenues(
  montantHt: number,
  dettes: { sociale: boolean; fiscale: boolean },
  taux: Pick<Parametres30bis, "taux_retenue_onss" | "taux_retenue_spf">,
) {
  const onss = dettes.sociale ? produitArrondiCent(montantHt, Number(taux.taux_retenue_onss)) : 0;
  const spf = dettes.fiscale ? produitArrondiCent(montantHt, Number(taux.taux_retenue_spf)) : 0;
  return { onss, spf, total: produitArrondiCent(onss + spf, 1) };
}

/** 0.15 -> 15 ; 0.0725 -> 7.25 (pour l'affichage « 15 % »). */
export const enPourcent = (taux: number) => Number((Number(taux) * 100).toFixed(4));

/**
 * Retenues d'un paiement avec plafonds (règles du 14/10/2026), identique au trigger SQL
 * check_paiement_30bis : par type, min(HTVA × taux, dette saisie à la vérification − retenues de
 * ce type déjà appliquées sur les paiements non annulés liés à la même vérification). Dette non
 * saisie = pas de plafond. Enfin, total ≤ HTVA (SPF réduit d'abord, puis ONSS).
 */
export function calculerRetenuesPlafonnees(o: {
  montantHt: number;
  verification: {
    dette_sociale: boolean;
    dette_fiscale: boolean;
    montant_dette_onss: number | null;
    montant_dette_spf: number | null;
  };
  dejaRetenu: { onss: number; spf: number };
  taux: Pick<Parametres30bis, "taux_retenue_onss" | "taux_retenue_spf">;
}) {
  const v = o.verification;
  const plein = calculerRetenues(
    o.montantHt,
    { sociale: v.dette_sociale, fiscale: v.dette_fiscale },
    o.taux,
  );
  const reste = (dette: number | null, deja: number) =>
    dette == null ? null : Math.max(produitArrondiCent(Number(dette) - deja, 1), 0);
  const resteOnss = reste(v.montant_dette_onss, o.dejaRetenu.onss);
  const resteSpf = reste(v.montant_dette_spf, o.dejaRetenu.spf);
  let onss = resteOnss == null ? plein.onss : Math.min(plein.onss, resteOnss);
  let spf = resteSpf == null ? plein.spf : Math.min(plein.spf, resteSpf);
  // Total retenu ≤ HTVA du paiement : réduire d'abord le SPF, puis l'ONSS (règle du 15/10/2026).
  const plafondTotal = produitArrondiCent(onss + spf, 1) > o.montantHt;
  if (plafondTotal) {
    spf = Math.max(produitArrondiCent(o.montantHt - onss, 1), 0);
    onss = Math.min(onss, o.montantHt);
  }
  return {
    onss,
    spf,
    total: produitArrondiCent(onss + spf, 1),
    plafondOnss: onss < plein.onss,
    plafondSpf: spf < plein.spf,
    plafondTotal,
    resteOnss,
    resteSpf,
  };
}
