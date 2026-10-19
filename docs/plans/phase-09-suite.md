# Phase 9 — suite : plan (mis à jour le 14/10/2026)

Déjà en place : fiches sous-traitants, vérifications 30bis datées, contrats (création simple),
signature par lien. `sous_traitant_prestations` et `achat_paiements` (trigger
`check_paiement_30bis`) existent en base sans écran.

Ordre : **A → B → C → D**, une PR chacune, testable seule.

## Règles métier provisoires (Youssef, 14/10/2026)

1. **Retenue 30bis** : base = montant HTVA du paiement ; ONSS 35 %, SPF 15 % (taux lus dans
   `parametres_30bis`). Total retenu **plafonné au montant restant dû** :
   `min(total_retenue, montant_restant_du)`. L'excédent de dette reste dû et sera retenu sur un
   paiement suivant.
2. **Paiement fractionné** : chaque versement est un paiement distinct et exige une vérification
   30bis **datée du jour**.
3. **Documents obligatoires par défaut** (sous-traitant) : attestation de conformité sociale /
   30bis valide ; attestation ou preuve de régularité TVA ; coordonnées bancaires validées ;
   contrat de sous-traitance signé, ou au moins envoyé en signature.
4. **Blocage d'affectation sur chantier** : activé par défaut si l'attestation 30bis est absente,
   expirée ou invalide. Message clair ; levée uniquement par un utilisateur autorisé, avec
   justification.
5. **Captures** : 5 Mo maximum ; JPG, PNG, PDF ; stockage privé cloisonné par société.

---

## PR A — Taux 30bis paramétrés — **faite** (PR #11, sans migration)

---

## PR B — Contrats, prestations, paiements + calcul de la retenue

**Migration** `…_phase9_retenue_plafond.sql` (nécessaire pour la règle 1) :

- `verifications_30bis` + `montant_dette_sociale`, `montant_dette_fiscale` (numeric, facultatifs) :
  montants lus sur le service officiel et saisis avec le résultat. Vide = non communiqué → pas de
  plafond (retenue pleine).
- `check_paiement_30bis` remplacé : retenue attendue par type =
  `min(montant HTVA × taux, dette du type − retenues de ce type déjà appliquées sur les paiements
liés à la même vérification)`. Les autres contrôles (vérification du jour, même
  sous-traitant) sont inchangés.
- Rollback commenté (rétablit l'ancienne fonction).

**Écrans** (fiche sous-traitant) :

1. **Contrats** : modification tant qu'aucune demande de signature n'est signée ; ensuite,
   lecture seule (un changement = nouveau contrat / avenant).
2. **Journal des prestations** : date, description, heures, ouvriers présents (nom, fonction,
   heures), Checkinatwork enregistré ; validation par un gérant (`valide_par`, `valide_le`).
   Aussi visible sur la fiche chantier.
3. **Paiement** (formulaire) :
   - contrat, date (aujourd'hui), montant HTVA, TVA (0 par défaut : autoliquidation), mode,
     référence ;
   - **vérification du jour** : si absente → bouton « Vérifier maintenant » (service officiel +
     saisie du résultat et des montants de dette) sans quitter le formulaire ;
   - **calcul automatique** affiché : retenue ONSS, retenue SPF, plafond appliqué (« dette
     restante : X € ») , « à verser au sous-traitant », « à verser à l'ONSS / au SPF » ;
   - les erreurs du trigger sont traduites (`verification_30bis_pas_du_jour`, etc.).
4. KPI : facturé, retenu, versé, reste à payer par contrat.
5. Démo : un paiement plafonné (dette sociale inférieure à 35 % du montant).

**Tests** : PGlite (plafond, dette non communiquée, deux paiements le même jour sur la même
vérification, parité JS / SQL du calcul plafonné).

## PR C — Captures de vérification (Storage)

**Migration** `…_storage_documents.sql` :

- bucket **privé** `documents` : `file_size_limit` 5 Mo, `allowed_mime_types` JPEG, PNG, PDF ;
- policies `storage.objects` : chemin `<company_id>/…` obligatoire
  (`(storage.foldername(name))[1] = get_user_company_id(auth.uid())::text`) ; dossier
  `<company_id>/30bis/` en **lecture et ajout seulement** (preuve immuable) ; autres dossiers
  (documents de conformité, PR D) en lecture / ajout / suppression.

**Écrans** : dépôt de la capture dans la fenêtre « Enregistrer le résultat » (vérification) et,
facultatif, de la preuve de paiement ; contrôle taille / format côté navigateur ; ouverture par
URL signée temporaire. Fichier déposé **avant** l'enregistrement (la vérification est immuable) ;
en cas d'échec, le fichier orphelin est supprimé.

**Tests** : policies Storage simulées sur PGlite (autre société refusée, suppression d'une
preuve 30bis refusée).

## PR D — Documents de conformité, alertes, blocage

**Migration** `…_phase9_conformite.sql` :

- `documents_conformite` (générique : `entite_type` sous_traitant / personnel / dirigeant /
  société, `entite_id`, `type_document`, fichier, `date_emission`, `date_expiration`,
  `valide_par`, `valide_le`). Statut **calculé** : valide / expire bientôt (≤ 30 jours) / expiré /
  manquant / invalide.
- `sous_traitants` + `iban_valide_par`, `iban_valide_le` ; trigger : toute modification de
  l'IBAN annule la validation (protection contre la fraude au changement d'IBAN).
- `derogations_conformite` : levée du blocage (sous-traitant, motif obligatoire, accordée par,
  date, échéance facultative) ; insertion réservée aux rôles autorisés (RLS sur
  `profiles.role`).
- Blocage en base : trigger sur `sous_traitant_contrats` et `sous_traitant_prestations`
  (rattachement à un chantier) refusant si l'attestation 30bis n'est pas valide et qu'aucune
  dérogation n'est active ; erreur `conformite_30bis_bloquante` traduite.

**Documents obligatoires par défaut** (règle 3) : attestation 30bis, attestation TVA
(documents déposés), IBAN validé (champ), contrat envoyé ou signé (déduit de
`contrat_signatures`).

**Écrans** : onglet « Conformité » de la fiche (liste, dépôt, validation, statut) ; colonne
tricolore dans la liste ; tableau de bord : alertes à 30 jours et sous-traitants bloqués ;
message de blocage avec bouton « Lever le blocage » (rôles autorisés, motif).

**Démo** : 1 document expiré (blocage visible), 1 dérogation.

---

## Questions encore ouvertes

1. **Montant restant dû** : le saisir lors de chaque vérification (montant affiché par le
   service officiel), **par type** (ONSS / SPF), et plafonner chaque retenue à sa propre dette ?
   (Proposé : oui.)
2. **« Attestation 30bis valide »** (blocage) : document déposé avec date d'expiration, ou
   déduit de la dernière vérification sans dette datant de moins de N jours ? (Proposé :
   document déposé ; la vérification du jour reste exigée pour payer.)
3. **Utilisateurs autorisés** à lever un blocage et à valider un IBAN : rôles `admin` et
   `gerant` ? (Proposé : oui.)
4. **Paiement saisi par erreur** : suppression permise (admin / gérant, avec confirmation) ou
   jamais (écriture de correction) ? (Proposé : suppression le jour même uniquement.)
