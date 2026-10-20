# Plan — Équipe interne, timesheet, scans et dossiers

Branche : `equipe-timesheet-dossiers`. Statut : **plan validé le 20/10/2026** (décisions au § 8) ; PR A fusionnée (timesheet) ; PR B ouverte (scans RH).
Rien n'est appliqué à la base de production : les migrations seront remises à Youssef avec leur
contrôle SQL et leur vérification sans trace.

## 0. Constat sur l'existant

| Élément                                                                               | État                                                                  | Conséquence                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `personnel` (nom, téléphone, e-mail, `status`, `contract_type`, `hourly_rate`, `nrn`) | Équipe **interne**, distincte de `sous_traitants`                     | On l'enrichit (pas de nouvelle table « travailleurs »).                      |
| `presence` (jour, statut, heures)                                                     | **Pas de `company_id`** ; RLS par jointure sur `personnel`            | Pas de place pour arrivée / départ / pause ; ne suit pas la règle du projet. |
| `affectations` (travailleur ↔ chantier)                                               | Pas de `company_id`                                                   | Réutilisée telle quelle (lecture).                                           |
| Bucket `documents`                                                                    | Privé ; **tout utilisateur de la société** lit tout                   | Insuffisant pour les cartes d'identité.                                      |
| Rôles `profiles.role`                                                                 | `admin`, `gerant`, `ouvrier` ; `est_gestionnaire()` = admin ou gérant | Base des droits « utilisateurs autorisés ».                                  |
| `sous_traitant_prestations`                                                           | Prestations des **sous-traitants**                                    | Le timesheet interne s'affiche à côté, sans les mélanger.                    |

## 1. Timesheet de l'équipe (priorité absolue) — PR A

### Base (migration `…_equipe_pointages.sql`)

- `personnel` : + `fonction text`, + `date_entree date`, + `date_sortie date` (sert au délai de
  conservation RGPD). `status` (actif / inactif) existe déjà.
- **Nouvelle table `pointages`** : `id`, `company_id`, `personnel_id`, `chantier_id`, `date`,
  `arrivee time`, `depart time`, `pause_minutes int` (défaut 0), `minutes_travaillees`
  (colonne générée : départ − arrivée − pause), `note`, `created_by`, `created_at`, `modifie_le`.
  Contraintes : départ > arrivée, pause ≥ 0 et < durée, travailleur et chantier de **la même
  société** (trigger), pas de chevauchement pour un même travailleur le même jour.
- **`pointage_corrections`** (historique, jamais modifiable) : `pointage_id`, `company_id`,
  `action` (`modification` / `suppression`), `avant jsonb`, `apres jsonb`, `motif` (obligatoire),
  `par`, `le`. Rempli par **trigger** : toute modification ou suppression d'un pointage exige un
  motif (passé par une RPC `corriger_pointage(id, valeurs, motif)` /
  `supprimer_pointage(id, motif)`) ; un `UPDATE` direct sans motif est refusé.
- RLS standard 4 policies + `admin_plateforme_demo_select` ; corrections : select + insert par
  trigger uniquement (aucun update / delete).
- Droits : saisie et correction par **gestionnaires** (admin, gérant). Rôle `ouvrier` : lecture de
  ses propres pointages seulement si un lien profil ↔ personnel existe (sinon pas d'accès) — à
  confirmer (question 3).
- `presence` : **conservée** pour les absences (congé, maladie, intempéries…) ; aucune donnée
  migrée ni supprimée.

### Écrans

- Nouvelle page **`/timesheet`** (menu Équipe) : sélecteur jour / semaine / mois, filtres
  travailleur et chantier.
  - **Jour** : liste des pointages, saisie rapide (travailleur, chantier, arrivée, départ, pause).
  - **Semaine** : grille travailleurs × jours, total par ligne et colonne.
  - **Mois** : totaux par travailleur et par chantier.
- Correction : dialogue avec motif obligatoire ; historique affiché sous le pointage.
- **Exports** CSV (séparateur `;`, décimales `,`, pour Excel belge) et PDF paginé (période,
  totaux, mention « indicatif — la paie reste au secrétariat social »).
- **Liens** : fiche chantier → onglet « Heures équipe » (totaux, à côté des prestations des
  sous-traitants, clairement séparées) ; fiche travailleur → ses pointages.
- i18n 5 langues ; formats belges ; utilisable sur tablette.

## 2. Scan de carte d'identité — PR B

- **Nouveau bucket privé `rh`** (5 Mo, JPG / PNG / PDF), chemins `<company_id>/identite/<uuid>`.
  **Aucune policy `SELECT` pour `authenticated`** : impossible de lire le fichier en contournant
  l'application.
- Accès uniquement par **server functions** (`requireSupabaseAuth` + client service role) qui :
  1. vérifient que l'utilisateur est gestionnaire de la société du travailleur ;
  2. écrivent une ligne dans **`journal_acces_documents`** (qui, quoi, quand, action :
     `depot`, `consultation`, `telechargement`, `suppression`) ;
  3. renvoient une URL signée de **60 secondes**.
- Table **`documents_rh`** : `company_id`, `personnel_id`, `type` (`carte_identite`), `fichier`,
  `consentement_le`, `base_legale` (texte), `conserver_jusqu_au`, `supprime_le`, `supprime_par`,
  `motif_suppression`, `depose_par`, `created_at`.
- **RGPD** : finalité unique « dossier RH » affichée au dépôt ; aucune lecture OCR, aucune
  extraction de données, aucune utilisation par l'IA ; date de fin de conservation calculée
  (question 1) ; liste « documents à supprimer » sur le tableau de bord ; suppression = fichier
  effacé du stockage + ligne conservée sans fichier (trace) ; jamais dans le site public, jamais
  dans les fonctions `admin_*`, jamais visible par l'administrateur plateforme (même en démo).
- Prise de vue : `<input type="file" accept="image/*,application/pdf" capture="environment">`
  (appareil photo sur téléphone / tablette).

### Réalisé (PR B, 20/10/2026)

Pour garantir « aucune lecture directe » **et** un journal de chaque consultation sans dépendre
de la clé de service, la lecture passe par un ticket de 60 s en base : `ouvrir_document_rh()`
écrit dans le journal, crée le ticket, puis l'application demande une URL signée de 60 s. Le
stockage refuse toute lecture sans ticket. Supabase interdisant d'effacer un fichier en SQL,
l'échéance « sortie + 1 an » produit une alerte au tableau de bord et la suppression se fait en
un clic (avec motif) depuis la fiche du travailleur.

## 3. Scan de contrat papier — PR B

- Même table `documents_rh` élargie en **`documents_scannes`** : `type`
  (`carte_identite`, `contrat_travail`, `contrat_sous_traitance`, `autre_contractuel`),
  rattachement **au moins un** parmi `personnel_id`, `sous_traitant_id`, `chantier_id`,
  `client_id` (contrainte CHECK + trigger « même société »).
- Contrats : bucket `documents`, chemin `<company_id>/scans/<uuid>` (lisibles par la société),
  sauf contrat de travail → bucket `rh` (données RH, accès gestionnaires + journal).
- **Remplacer** = nouvelle version (`remplace_id`), l'ancienne passe en « remplacée » ;
  **supprimer** = motif obligatoire, trace conservée ; historique visible.
- Les modèles de contrat électroniques (`src/lib/contrats/`) **ne sont pas touchés** ; les scans
  sont un dépôt de fichiers, sans signature.

## 4. Dossier client — PR C

- Page `/clients/$id` enrichie en **« Dossier client »** (onglets) : coordonnées, chantiers,
  contrats (signés et scannés), prestations des sous-traitants sur ses chantiers, sous-traitants
  intervenus, documents, heures de l'équipe sur ses chantiers, devis, factures et paiements
  disponibles.
- **PDF du dossier** (jsPDF, comme les devis) : page de garde, sommaire, sections, pagination
  « page X / Y », date de génération ; liste des documents (nom, date) sans y intégrer les
  fichiers ; **jamais de carte d'identité** dans un dossier client.

## 5. Dossier équipe — PR C

- Page `/personnel/$id` enrichie en **« Dossier travailleur »** : coordonnées, fonction, statut,
  contrats et documents, carte d'identité (présence, date de dépôt, fin de conservation ;
  consultation journalisée), pointages, chantiers travaillés, totaux d'heures par période.
- **PDF du travailleur** : même gabarit ; la carte d'identité y figure seulement comme mention
  « déposée le … » (image exclue par défaut — question 2).

## 6. Sécurité et contrôles (toutes les PR)

- Chaque migration : idempotente, `-- ROLLBACK :` entièrement commenté, `REVOKE … FROM PUBLIC,
anon` sur les fonctions, index `company_id` + FK, policy démo, types `types.ts` à jour.
- Contrôle `supabase/tests/controle_*.sql` (une ligne `ok` / `ko`) + `verif_*.sql` sans trace :
  société B ne lit ni pointage, ni correction, ni document, ni objet du bucket `rh` de la société
  A ; un `ouvrier` ne lit pas les cartes d'identité ; correction sans motif refusée ; corrections
  non modifiables ; aucun accès `anon`.
- Tests PGlite (`supabase_simule.ts`) avant remise ; tests de calcul des totaux
  (`scripts/tests/timesheet.check.ts`).
- Variables serveur : le client service role (`client.server.ts`) exige
  `SUPABASE_SERVICE_ROLE_KEY` côté serveur Lovable — **à vérifier** avant la PR B (jamais côté
  front).

## 7. Découpage proposé

| PR  | Contenu                                                                                                                         | Migration              |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A   | Timesheet : pointages, corrections tracées, vues jour / semaine / mois, totaux, exports CSV / PDF, liens chantier / travailleur | `equipe_pointages`     |
| B   | Scans : bucket `rh`, `documents_scannes`, journal d'accès, carte d'identité, contrats papier                                    | `documents_scannes_rh` |
| C   | Dossier client et dossier travailleur + PDF                                                                                     | aucune (lecture seule) |

Une PR à la fois, sans fusion ; la suivante démarre après validation des CA de la précédente.

## 8. Décisions (Youssef, 20/10/2026)

1. **Découpage** : 3 PR successives, timesheet d'abord.
2. **Conservation** de la copie de carte d'identité : **date de sortie + 1 an**, puis suppression
   proposée (alerte au tableau de bord).
3. **PDF du dossier travailleur** : mention « carte d'identité déposée le … » seulement, jamais
   l'image.
4. **Rôle `ouvrier`** : lecture de **ses propres heures** — nouveau lien `personnel.profile_id`
   (compte utilisateur ↔ fiche travailleur), défini par un gestionnaire.
5. **Base légale** de la copie de la carte (loi du 19 juillet 1991, art. 6 ; recommandation APD
   n° 03/2011) : à faire valider par un juriste ; l'application enregistre le consentement du
   travailleur à chaque dépôt.
