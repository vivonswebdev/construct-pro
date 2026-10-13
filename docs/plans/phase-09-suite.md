# Phase 9 — suite : plan (13/10/2026)

Déjà en place : fiches sous-traitants, vérifications 30bis datées, contrats (création simple),
signature par lien. Tables `sous_traitant_prestations` et `achat_paiements` (avec le trigger
`check_paiement_30bis`) existent en base mais n'ont pas encore d'écran.

Découpage proposé : **4 PR**, dans cet ordre. Chacune est testable seule.

---

## PR A — Taux 30bis paramétrés (petite, sans migration)

- `conformite-tva.tsx` : supprimer `TAUX_RETENUE_SPF = 0.15` ; lire le taux en vigueur dans
  `parametres_30bis` (ligne la plus récente avec `date_debut <= aujourd'hui`).
- Hook partagé `useParametres30bis(date)` dans `src/lib/sous-traitants.ts` (réutilisé par la PR B).
- Affichage « Taux indicatif — à valider par votre comptable », avec la source et la date de
  vérification (`parametres_30bis.source`, `date_verification`).
- Prompt de l'assistant IA : remplacer « 15 % » écrit en dur par les taux lus en base.
- Tests : calcul identique au trigger (arrondi au cent).

## PR B — Saisie des contrats, prestations et paiements + calcul de la retenue

- **Contrats** : modification d'un contrat non signé ; un contrat avec une signature signée
  n'est plus modifiable (avenant = nouveau contrat).
- **Journal des prestations** (fiche sous-traitant et fiche chantier) : date, description,
  heures, ouvriers présents (nom, fonction, heures), Checkinatwork enregistré, validation par
  un gérant (`valide_par` / `valide_le`).
- **Paiement** (formulaire sur la fiche) :
  1. contrat, date (aujourd'hui par défaut), montant HTVA, TVA (0 si autoliquidation) ;
  2. **vérification 30bis du jour** : si absente, le bouton « Vérifier maintenant » ouvre le
     service officiel et l'enregistrement du résultat, sans quitter le formulaire ;
  3. **retenues calculées automatiquement** (ONSS 35 %, SPF 15 %, taux lus dans
     `parametres_30bis`) et affichées : « Montant HTVA − retenues = à verser au sous-traitant » ;
     « à verser à l'ONSS / au SPF Finances » ;
  4. le trigger en base refuse toute incohérence (déjà en place) : codes d'erreur traduits.
- KPI de la fiche : total facturé, retenu, versé ; reste à payer par contrat.
- **Pas de migration** (tables existantes), sauf si la question 1 ci-dessous change le calcul.

## PR C — Capture de la vérification 30bis (migration Storage)

- Migration : bucket privé `documents` + 4 policies `storage.objects` limitées au dossier
  `<company_id>/…` (`(storage.foldername(name))[1] = get_user_company_id(auth.uid())::text`).
  Premier bucket du projet : il servira aussi aux documents de conformité.
- Formulaire de vérification : dépôt d'une capture (image ou PDF, 5 Mo max) → chemin dans
  `verifications_30bis.preuve_fichier`. La preuve reste immuable (pas de remplacement).
- Affichage par URL signée temporaire (bucket privé).
- Rétention : `company_settings.duree_conservation_ouvriers_ans` (déjà en base).

## PR D — Documents de conformité et alertes (migration)

- Table `documents_conformite` (annexe A de PASSATION) : `entite_type` (personnel /
  sous_traitant / dirigeant / societe), `entite_id`, `type_document`, fichier, `date_emission`,
  `date_expiration`. Le statut (`valide`, `expire_bientot` à 30 jours, `expire`, `manquant`) est
  **calculé**, pas stocké.
- Table `checklists_conformite` : documents attendus par statut (indépendant, associé actif,
  dirigeant, salarié, sous-traitant, société), pré-remplie avec une liste par défaut,
  modifiable par la société.
- Écrans : onglet « Documents » sur la fiche sous-traitant et la fiche personnel ; tableau de
  bord tricolore (vert / orange / rouge) ; alertes à 30 jours sur le dashboard.
- Options : blocage d'affectation à un chantier si un document obligatoire est expiré ;
  rappel Checkinatwork (seuil `company_settings.seuil_checkinatwork`) ; avertissement « faux
  indépendant » (critères à définir).
- Démo : 1 document expiré, comme prévu par PASSATION.

---

## Questions à trancher avant de coder

1. **Plafond de la retenue** : la retenue (35 % ONSS / 15 % SPF du montant HTVA) doit-elle être
   plafonnée au montant de la dette communiqué par le service officiel ? Aujourd'hui : non
   plafonnée (le trigger exige le montant plein).
2. **Paiement partiel d'une facture** : un paiement fractionné nécessite-t-il une vérification
   à chaque versement ? (Proposé : oui, c'est la règle « vérification du jour du paiement ».)
3. **Documents obligatoires par défaut** (PR D) : valider la liste de départ — BCE, caisse
   d'assurances sociales, accès à la profession, RC, décennale, VCA, Limosa, Dimona, permis,
   examen médical, ConstruBadge — et lesquels sont **bloquants**.
4. **Blocage d'affectation** (PR D) : activé par défaut ou option désactivée par défaut ?
5. **Taille et formats des captures** (PR C) : 5 Mo, images + PDF, d'accord ?
