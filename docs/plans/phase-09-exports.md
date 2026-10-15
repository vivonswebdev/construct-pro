# Phase 9 — Exports de conformité (plan, 15/10/2026)

Demande de Youssef du 15/10 : registre des retenues 30bis, dossier de conformité PDF par
sous-traitant, export CSV pour le comptable. **Aucune migration, aucune écriture en base** : tout
est calculé dans le navigateur à partir des données lisibles par l'utilisateur (RLS de sa
société). Rapports internes → langue de l'interface (namespace i18n `exports`).

## Principes communs

- Page **`/sous-traitants/exports`** (bouton « Exports » dans la liste des sous-traitants), deux
  onglets : « Registre des retenues » et « Export comptable ». Le dossier PDF se lance depuis la
  fiche du sous-traitant.
- Code des exports dans `src/lib/exports/` : **fonctions pures** (données → lignes → CSV) testées
  hors navigateur ; chargement Supabase et rendu PDF séparés.
- **CSV** : séparateur `;`, UTF-8 avec BOM, décimales à virgule sans symbole € (ouverture directe
  dans Excel belge), dates JJ/MM/AAAA, une ligne d'en-tête traduite, valeurs échappées.
- **PDF** : jsPDF + autotable, en-tête ConstructFlow existant, société, période et filtres
  rappelés, pied de page « indicatif — à valider par votre comptable », numéros de page.
- Paiements **annulés** : exclus par défaut ; case « inclure les paiements annulés » (ligne
  marquée « annulé », hors totaux).

## 1. Registre des retenues 30bis

**Filtres** : période (du / au, mois en cours par défaut), sous-traitant, chantier, statut 30bis
(tous / avec dette constatée / sans dette).

**Une ligne par paiement**, colonnes :
date du paiement · sous-traitant · n° BCE · n° de facture d'achat (champ « référence » du
paiement, si renseigné) · montant HTVA · retenue ONSS · retenue SPF · total retenu · montant
versé · date et heure de la vérification 30bis (heure de Bruxelles) · statut de la vérification
(aucune dette / dette sociale / dette fiscale / dettes sociale et fiscale) · chantier · client
final (chantier).

**Écran** : aperçu du tableau, totaux (HTVA, ONSS, SPF, total retenu, versé), boutons CSV et
PDF. **PDF** paysage avec totaux en bas.

## 2. Dossier de conformité PDF (par sous-traitant)

1. **Synthèse** : **conforme** (4 exigences valides ou expirant bientôt, non bloqué) /
   **à vérifier** (une exigence manquante, expirée ou invalide, sans blocage) / **bloqué**
   (attestation 30bis non valide sans dérogation) ; tableau des 4 exigences et de leurs statuts ;
   dérogation active éventuelle ; date d'édition.
2. **Coordonnées** : raison sociale, forme, BCE, TVA, adresse, contact, IBAN (validé ou non).
3. **Attestations 30bis et TVA** : tous les documents, dates, statut calculé, invalidations.
4. **Vérifications 30bis** : date et heure, résultat, dettes ONSS / SPF saisies, capture
   (« jointe » ou « absente ») ; **annexe** avec les captures JPG / PNG intégrées (20 maximum ;
   les captures PDF sont signalées, à ouvrir depuis l'application).
5. **Contrats** : descriptif, chantier, prix, statut de signature, date de signature et **lien**
   vers la page de signature (qui affiche le contrat signé et permet de télécharger le PDF).
6. **Paiements et retenues** : même colonnes que le registre, avec totaux.
7. **Dérogations** : période, justification, révocation.

## 3. Export CSV pour le comptable

**Période** sélectionnable ; **une ligne par sous-traitant** ayant une activité sur la période
(case « inclure tous les sous-traitants ») :
sous-traitant · n° BCE · période · nombre de prestations · heures · montant HTVA payé ·
retenue ONSS · retenue SPF · total retenu · montant versé · nombre de paiements · statut de
conformité (synthèse) · documents manquants (liste des exigences non valides).

## Tests

- Fonctions pures (lignes, totaux, synthèse, CSV) : `scripts/tests/exports.check.ts` (Bun).
- Rendu PDF vérifié dans l'aperçu du navigateur avec des données fictives (aucune donnée de
  production).
- Build, types, lint, i18n.

## Hors périmètre

- Formats de déclaration officiels ONSS / SPF : aucun format imposé fourni ; à ajouter si
  Youssef en communique un.
- Numéro de facture d'achat dédié : arrivera avec la phase 12 (achats) ; d'ici là, la référence
  du paiement en tient lieu.
