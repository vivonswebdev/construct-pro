# Journal — ConstructFlow

Fait, décidé, reste à faire. Entrées les plus récentes en haut.

---

## 2026-10-19 — Tableau de bord : liens « Voir » des alertes

Branche : `fix-alertes-dashboard`. **Aucune migration.**

- Les boutons « Voir » des alertes (code d'origine) n'avaient aucune action. Chaque alerte ouvre
  désormais la page où la traiter : fiche du chantier, de l'ouvrier ou du véhicule s'il n'y en a
  qu'un, sinon la liste ; module Précompte & ONSS pour les salaires, le précompte et l'ONSS.
- Recherche des autres boutons sans action dans l'application : aucun (le seul autre est
  volontairement désactivé, module Précompte).

---

## 2026-10-19 — Scripts de contrôle et de vérification compacts

Branche : `scripts-controle-compacts`. **Aucune migration.**

- Les résultats étaient coupés dans l'éditeur Supabase (longs messages d'erreur, plusieurs requêtes
  dont seule la dernière s'affiche). Les 4 contrôles récents (`controle_profils_champs_proteges`,
  `controle_logos_entreprise`, `controle_demo_et_admin_plateforme`, `controle_backoffice_admin`)
  renvoient désormais **une ligne** : `ok`, `ko`, `en_echec`, `informations` ; les 3 vérifications
  renvoient `VERIF 1:OK 2:OK …` (légende en tête de fichier). Requête d'identification des comptes
  de démo passée en facultative (commentée).
- **Incohérence corrigée** : depuis le back-office, le contrôle « policy de lecture démo sur chaque
  table à company_id » échouait à cause des tables de plateforme (`journal_plateforme`,
  `erreurs_application`, sans policy par conception) : elles sont exclues.
- Les 7 scripts testés sur base simulée (rien n'est conservé) ; convention ajoutée à `CLAUDE.md`.

---

## 2026-10-19 — Correctif : onglet « Clients » du back-office vide

Branche : `fix-admin-comptes-email`. **Migration à appliquer :**
`20261019090000_admin_comptes_email_text.sql`.

- **Cause** : `admin_comptes()` renvoyait `array_agg(u.email)` ; sur Supabase `auth.users.email`
  est en `varchar(255)`, la fonction annonce `text[]` → erreur « structure of query does not
  match function result type ». La vue d'ensemble (3 clients) fonctionnait, la liste non.
- **Correction** : conversion `u.email::text` (règles d'accès inchangées).
- **Écrans** : les onglets et la fiche client affichent désormais l'erreur de chargement au lieu
  d'une liste vide silencieuse.
- **Tests** : base simulée alignée sur Supabase (`email varchar(255)`) — le test échoue sans le
  correctif et passe avec ; `plateforme.check.ts` rejoue les migrations plus récentes après son
  contrôle d'idempotence.

---

## 2026-10-16 — Back-office administrateur (lecture seule)

Branche : `backoffice-admin`. Plan : `docs/plans/backoffice-admin.md`. **Migration à appliquer :**
`20261017090000_backoffice_admin.sql` ; contrôle `supabase/tests/controle_backoffice_admin.sql` ;
vérification sans trace `supabase/tests/verif_backoffice_admin.sql`.

- `/admin` en 4 onglets : vue d'ensemble (totaux réel / démo : clients, utilisateurs, chantiers,
  sous-traitants, contrats, prestations, vérifications 30bis), clients (fiche
  `/admin/clients/$id`), utilisateurs (rôle, société, création, dernière connexion), activité
  (connexions, créations de comptes, changements importants, erreurs).
- **Clients réels** : métadonnées de compte uniquement (aucun chantier, contrat, montant, e-mail
  ni nom) ; **démos** : détail complet en lecture seule, conformité via `admin_conformite`
  (security invoker). Contradiction de la demande tranchée dans ce sens (voir le plan).
- `journal_plateforme` (triggers : société créée, démo activée/retirée, rôle ou société modifié,
  contrat envoyé/signé/annulé, document invalidé, dérogation accordée/révoquée, paiement annulé) et
  `erreurs_application` (`signaler_erreur`, gestionnaires globaux côté application, 20 / 10 min,
  purge 90 jours) : RLS sans policy, lecture par fonctions `admin_*` uniquement.
- Bascule démo : validation par saisie du nom de la société, action journalisée.
- **Tests** : `supabase/tests/backoffice.check.ts` (refus non-admin et anon, aucune fuite de
  données réelles dans aucune fonction, journal, limites et purge des erreurs, connexions via
  `auth.audit_log_entries`) ; toutes les suites vertes ; scripts de contrôle et de vérification
  testés sur base simulée (rien n'est conservé).

---

## 2026-10-16 — Marque ZidarPro : logo et renommage progressif

Branche : `marque-zidarpro`. Plan : `docs/plans/marque-zidarpro.md`. **Aucune migration.**

- **Logo** : Z en briques (`src/lib/marque.ts`), versions claire, sombre et icône simplifiée ;
  composant `ZidarProLogo` ; fichiers `docs/marque/*.svg` et favicon (`public/`) générés par
  `bun scripts/marque/generer.ts` (rastérisation et PNG/ICO sans dépendance) ; charte
  `docs/marque/README.md`.
- **Renommage** : `appName`, titres, copyright, pied des PDF, avertissement des exports, note
  d'audit des contrats (5 langues) ; prompt de l'assistant ; User-Agent TVA. Barre latérale et
  connexion avec le logo sombre, fond bleu de marque `#0F2A43`.
- **PDF** : en-tête des rapports en version claire (logo de la société sinon ZidarPro vectoriel,
  filet orange). Devis et factures : identité de la société (inchangé). **Contrats : aucun logo**
  (vérifié : 0 image même avec un logo de société chargé) ; texte et empreintes inchangés.
- **Inchangés** : nom du dépôt, migrations, historique, compte `demo@constructflow.be`.
- **Domaines et réseaux** (rien de réservé) : `zidarpro.be`, `.com`, `.eu` disponibles (WHOIS
  officiels) ; aucun compte « zidarpro » sur GitHub, Instagram, TikTok, YouTube, X, LinkedIn ;
  aucune marque ZIDARPRO dans TMview (des marques ZIDAR existent : avis d'un conseil en marques).
- À suivre : couleur principale des boutons vers le bleu de marque ; e-mails d'authentification à
  renommer dans Supabase / Lovable.

---

## 2026-10-16 — Logo, comptes sans démo, administrateur de la plateforme, « Bientôt disponible »

Branche : `profil-logo-demo-admin`. Plan : `docs/plans/profil-demo-admin-bientot.md`.
**Migrations à appliquer** (après la PR de sécurité des profils) :
`20261016100000_logos_entreprise.sql`, `20261016110000_demo_et_admin_plateforme.sql` ;
contrôles : `supabase/tests/controle_logos_entreprise.sql`,
`supabase/tests/controle_demo_et_admin_plateforme.sql`.

- **Logo** : bucket privé `logos` (2 Mo, JPG / PNG / WebP), `companies.logo_chemin`, cloisonnement
  par société ; profil : charger, remplacer, supprimer ; logo par défaut = initiales. Affiché dans
  les devis, factures et rapports internes (converti en PNG pour jsPDF) ; pas dans les contrats.
- **Démonstration** : `companies.est_demo` (faux par défaut, non modifiable par l'API) ;
  `seed_lock()` ne peuple plus que les sociétés démo → un nouveau compte démarre vide. Rien n'est
  supprimé ; requête d'identification des comptes déjà peuplés dans le contrôle SQL.
- **Administrateur de la plateforme** (distinct du rôle `admin` d'une société) :
  `est_admin_plateforme()` = e-mail `kaillaniyoussef@gmail.com` confirmé, contrôlé en base ; lecture
  seule des sociétés démo (policy ajoutée sur chaque table à `company_id`) ; `admin_comptes()`
  (e-mails et chantiers uniquement pour les sociétés démo) ; `admin_definir_demo()`. Page `/admin`
  hors menu, lien dans le profil pour l'administrateur.
- **« Bientôt disponible »** : page `/bientot-disponible` hors menu (liens dans le profil et en bas
  du tableau de bord), 5 fonctionnalités demandées + 8 de la feuille de route, sans date ;
  namespaces `admin` et `bientot` dans les 5 langues.
- **Tests** : `supabase/tests/plateforme.check.ts` (32 tests : nouveau compte vide, démo non
  modifiable, reconnaissance de l'administrateur, lecture seule des démos, aucun accès aux
  clients réels, logos cloisonnés, droits anon) ; toutes les suites PGlite vertes, y compris avec
  la migration de sécurité des profils. Navigateur (sans base) : logo WebP converti, présent dans
  l'en-tête des rapports et des devis, absent sans logo.
- **Vérification sur la base réelle sans rien y laisser** : `supabase/tests/verif_profils_champs_proteges.sql`
  (PR #22) et `supabase/tests/verif_demo_et_admin_plateforme.sql` ; chaque script teste comme un
  utilisateur puis se termine par une erreur volontaire qui annule tout et affiche les résultats.
  Testés sur base simulée (avec et sans correctif ; rien n'est conservé).
- Chargement de la société en `select("*")` : l'application reste utilisable si elle est publiée
  avant la migration du logo (logo par défaut).

---

## 2026-10-16 — Sécurité : champs protégés du profil (faille existante corrigée)

Branche : `securite-profils-champs-proteges`. **Migration à appliquer :**
`20261016090000_profils_champs_proteges.sql` ; contrôle : `supabase/tests/controle_profils_champs_proteges.sql`.

- **Faille** (policy d'origine « Users update own profile ») : chaque utilisateur pouvait modifier
  toutes les colonnes de son profil, dont `company_id` (accès complet aux données d'une autre
  société dont il connaît l'identifiant) et `role` (se donner le rôle admin). Démontrée sur base
  simulée avec les migrations de `main`.
- **Correction** : trigger `proteger_profil()` — par l'API, `id`, `company_id` et `role` ne
  changent plus et un profil ne s'insère plus directement ; la création de compte
  (`handle_new_user`, security definer) est inchangée ; nom, avatar et langue restent modifiables.
- **Tests** : `supabase/tests/profils_champs_proteges.check.ts` (faille avant, fermée après,
  création de compte, idempotence, droits anon) ; toutes les suites PGlite vertes.

---

## 2026-10-15 — Contrats : rendu dans la version de modèle de l'envoi

Branche : `contrat-rendu-par-modele`. Plan : `docs/plans/contrat-rendu-par-modele.md`. **Aucune
migration, texte v1 inchangé** (`src/lib/contrats/sous-traitance.ts` identique octet pour octet),
aucune écriture en base.

- `src/lib/contrats/modeles.ts` : registre `code → rendu + « Fait à … »` (v1 seul aujourd'hui),
  `MODELE_COURANT` pour les nouveaux envois uniquement, erreur `modele_inconnu` sans repli,
  empreintes et document calculés avec le `modele` de la demande.
- Branché partout où le contrat était rendu en v1 en dur : envoi (`ContratSignatureModal`), page
  `/signer/$token` (formulaire et contrat signé), PDF des deux côtés, export pour le juriste
  (`exporter_contrat.ts [code]`, sortie v1 identique).
- Page de signature : modèle inconnu → message traduit (5 langues) au lieu d'une erreur.
- **Tests** (données fictives) : `bun scripts/tests/modeles-contrat.check.ts` (20 tests :
  instantané du texte v1 et empreintes de référence capturés sur `main` avant la refonte, lien v1
  ouvert avec une fausse v2 courante, contrat v2, PDF v1 signé, modèles inconnus). Contre-épreuve :
  un caractère modifié dans le texte v1 fait échouer 7 tests. PGlite : `contrat_a_signer` renvoie
  le `modele`. Navigateur (sans base) : le PDF d'un contrat v1 signé fictif contient les 102 blocs
  du texte v1 et aucun texte v2.

---

## 2026-10-15 — Contrat v2 : suivi des retours attendus

Branche : `docs-suivi-contrat-v2`. Documentation uniquement : aucun code, aucune migration.

- `docs/juridique/suivi-retours-contrat-v2.md` : état des 4 retours (relecture NL / RO / PL, note
  juridique, réponses aux 23 points, corrections v2), impact possible de chaque point (texte,
  logiciel, migration), décisions revenant à Youssef, procédure de rédaction de la v2.
- **Constat** : `rendreContrat` ignore la colonne `modele` et rend toujours la v1. Avant toute v2,
  il faut un rendu par code de modèle, sinon les liens v1 ouverts seraient refusés à la signature
  (empreinte différente) et les PDF v1 régénérés avec le mauvais texte. Prévu en PR distincte,
  sans changement de texte.
- La v2 elle-même attend les réponses du juriste.

---

## 2026-10-15 — Phase 9 : journal de chantier (saisie, blocage, totaux, exports)

Branche : `phase-09-journal-chantier`. **Aucune migration, aucune écriture en base hors saisie
normale** (la prestation passe par les mêmes contrôles RLS et triggers qu'avant).

- **Saisie depuis la fiche chantier** : bouton « Nouvelle prestation » dans la section
  « Sous-traitants et prestations » ; le formulaire (`PrestationFormModal`, désormais exporté)
  propose les contrats du chantier préfixés par le nom du sous-traitant.
- **Blocage de conformité affiché à la saisie** : si l'attestation 30bis du sous-traitant bloque
  l'affectation (et sans dérogation active), bandeau rouge avec le statut, lien vers la fiche
  conformité, bouton Enregistrer désactivé ; dérogation active → bandeau d'information. La base
  reste le contrôle de référence (`conformite_30bis_bloquante`, message traduit au lieu du texte
  brut de l'erreur).
- **Totaux par sous-traitant** (`src/lib/exports/journal.ts`, fonctions pures) : prestations
  (dont validées), heures, forfait HTVA, valeur horaire estimée (heures × prix horaire du contrat),
  payé HTVA, retenues 30bis, versé, reste du forfait ; paiements annulés exclus ; total chantier.
- **Journal complet** : plus de limite à 100 lignes (lecture paginée `toutLire`).
- **Exports** (`src/lib/exports/journal-rendu.ts`, langue de l'interface) : CSV (date,
  sous-traitant, description, heures, ouvriers, Checkinatwork, validée le) et PDF paysage
  (totaux + journal, pied de page commun).
- `pdfSafe` : translittération des lettres sans décomposition Unicode (Ł, đ, ı…) — « Ł. Kowalski »
  sortait « ?. Kowalski » ; sans effet sur l'empreinte des contrats (calculée sur le texte).
- **Tests** : `bun scripts/tests/journal.check.ts` (9 tests) ; rendu PDF vérifié dans le navigateur
  avec des données fictives (aucune donnée de production).

---

## 2026-10-15 — Dossier de relecture NL / RO / PL et note pour le juriste

Branche : `docs-relecture-juridique`. Documentation uniquement : aucun code applicatif, aucune
migration.

- **Relecture native** : `docs/relecture/relecture-nl-ro-pl.xlsx`, généré par
  `scripts/relecture/exporter_relecture.py` à partir des fichiers de traduction (2 025 lignes) :
  langue, écran ou document, texte français, traduction actuelle, contexte, statut (liste : à
  valider / correction proposée / validé), traduction corrigée, commentaire, clé technique.
  Priorité 1 : mentions légales des PDF (autoliquidation, TVA 6 %, conditions, piste d'audit) ;
  priorité 2 : page de signature et message au sous-traitant ; priorité 3 : écrans. Variables
  `{{…}}` et formes plurielles signalées. Les PDF clients n'existant qu'en FR / NL / EN, les
  mentions de priorité 1 en RO / PL sont signalées comme moins urgentes.
- **Note juridique** : `docs/juridique/note-juriste-contrat-sous-traitance.md` — sans avis
  juridique ; fonctionnement du logiciel (pré-remplissage, signature, piste d'audit, 30bis) ;
  5 points à valider (pénalités, délais de paiement / loi du 2 août 2002, 30bis et responsabilité
  solidaire, signature électronique simple, versions NL / EN) et 3 points facultatifs ; tableau de
  réponses (23 lignes) ; texte exact du modèle v1 en annexe, généré par
  `scripts/juridique/exporter_contrat.ts`.
- Constat signalé au juriste : le délai de paiement saisi peut aller jusqu'à 365 jours dans le
  logiciel ; un plafond sera ajouté selon sa réponse.

---

## 2026-10-15 — Phase 9 : exports de conformité (registre 30bis, dossier PDF, export comptable)

Branche : `phase-09-exports`. Plan : `docs/plans/phase-09-exports.md`. **Aucune migration, aucune
écriture en base** : tout est calculé dans le navigateur (RLS de la société).

- Page `/sous-traitants/exports` (bouton « Exports » de la liste) :
  - **Registre des retenues 30bis** : période, filtres sous-traitant / chantier / statut 30bis,
    paiements annulés sur demande (hors totaux) ; une ligne par paiement (date, sous-traitant, BCE,
    n° de facture = référence du paiement, HTVA, ONSS, SPF, total retenu, versé, vérification
    30bis date et heure de Bruxelles, statut, chantier, client final) ; totaux ; CSV et PDF paysage.
  - **Export comptable** (CSV) : une ligne par sous-traitant actif sur la période (prestations,
    heures, HTVA, retenues, versé, nombre de paiements, synthèse de conformité, documents manquants).
- Fiche sous-traitant : **« Dossier de conformité (PDF) »** — synthèse conforme / à vérifier /
  bloqué, exigences, coordonnées, attestations, vérifications (captures JPG / PNG en annexe, 20
  maximum ; PDF signalés), contrats (lien vers le contrat **signé** uniquement : le lien d'un
  contrat seulement envoyé permettrait de le signer), paiements et retenues, dérogations.
- CSV pour Excel belge (`;`, BOM UTF-8, virgule décimale, JJ/MM/AAAA) ; lecture des données par
  paquets de 1 000 lignes (limite Supabase).
- Tests : `scripts/tests/exports.check.ts` 21 OK (registre, filtres, totaux, synthèse, comptable,
  CSV). PDF du registre et du dossier générés dans l'aperçu avec des données fictives et contrôlés
  visuellement.
- Hors périmètre : formats de déclaration officiels ONSS / SPF (aucun fourni) ; n° de facture
  d'achat dédié (phase 12).

---

## 2026-10-15 — Durcissement : exécution des fonctions retirée à anon

Branche : `phase-09-droits-fonctions`.

- Constat après la PR D : `anon` pouvait appeler `conformite_sous_traitants()` et
  `est_gestionnaire()` (aucune donnée obtenue, mais surface inutile). Cause : EXECUTE accordé par
  défaut à `anon` (Supabase) et à `PUBLIC` (PostgreSQL) ; le `REVOKE … FROM PUBLIC` de la PR D ne
  retirait pas l'octroi direct à `anon`.
- Migration `20261015140000_droits_fonctions_anon.sql` (idempotente, rollback commenté) : pour
  chaque fonction de `public` (hors extensions), `REVOKE EXECUTE FROM PUBLIC, anon` et
  `GRANT EXECUTE TO authenticated, service_role` ; `contrat_a_signer` et `signer_contrat` restent
  accordées à `anon` (signature publique). Droits par défaut futurs retirés (si le rôle le permet).
- Tests : environnement simulé enrichi (EXECUTE par défaut sur les fonctions, comme Supabase) ;
  `supabase/tests/droits_fonctions.check.ts` 9 OK (22 fonctions exécutables par anon avant, 2
  après ; signature publique, RLS et RPC des utilisateurs connectés intacts) ; toutes les autres
  suites OK. Contrôle : `supabase/tests/controle_droits_fonctions.sql` (7 lignes).
- Règle ajoutée dans CLAUDE.md.
- Vérifications du 15/10 : aucune copie Lovable des migrations sur `main` ; types à jour
  (`documents_conformite`, `derogations_conformite`, champs IBAN).

---

## 2026-10-15 — Phase 9, PR D : conformité des sous-traitants, alertes, blocage d'affectation

Branche : `phase-09-conformite` (depuis `main`, après les PR #12 et #13). Règles validées par
Youssef les 14 et 15/10.

### Migration `20261015090000_phase9_conformite.sql` (idempotente, rollback commenté complet)

- `documents_conformite` (attestation 30bis — expiration obligatoire —, attestation TVA —
  expiration facultative) : fichier dans `<société>/conformite/`, preuve jamais modifiée ni
  supprimée ; invalidation seulement (admin / gérant, motif, auteur et date imposés).
- Statut calculé (`statut_document_conformite`) : valide / expire_bientot (≤ 30 jours) / expire
  / manquant / invalide ; `statut_attestation` retient le meilleur document non invalidé ;
  `conformite_sous_traitants()` donne les 4 exigences et `bloque` pour toute la société.
- IBAN : `iban_valide_le`, `iban_valide_par` ; validation par admin / gérant ; toute
  modification de l'IBAN annule la validation.
- Contrat : valide si signé ou envoyé en signature avec un lien actif.
- `derogations_conformite` : admin / gérant, justification, échéance obligatoire ≤ 30 jours,
  révocable (auteur, date), jamais supprimée.
- Blocage (trigger) : rattacher un contrat ou une prestation à un chantier est refusé si
  l'attestation 30bis est absente, expirée ou invalide, sauf dérogation active ; modifier un
  contrat sans changer de chantier reste possible. Pas de désactivation globale.
- Paiements : total retenu = min(ONSS + SPF, HTVA), SPF réduit d'abord, puis ONSS (même règle
  dans `calculerRetenuesPlafonnees`).
- Storage : un fichier cité par un document de conformité (ou une vérification) n'est ni
  remplacé ni supprimé.
- Droits par défaut de Supabase retirés sur les deux nouvelles tables.

### Écrans

- Fiche sous-traitant : section « Conformité » (4 exigences, dépôt d'attestation, invalidation,
  validation de l'IBAN, bandeau de blocage, dérogation et révocation, historique).
- Liste : colonne « Conformité » (pire statut + « Bloqué ») et filtre « Affectation bloquée ».
- Tableau de bord : alertes (bloqués, expirées / invalides, expirent dans les 30 jours).
- Fiche chantier : « Sous-traitants et prestations » (contrats rattachés, journal).
- Formulaire sous-traitant : avertissement quand un IBAN validé est modifié.
- Démo : attestations avant les contrats ; Peeters expire dans 18 jours (alerte), Ionescu
  expirée + dérogation de 14 jours ; IBAN de Lambert validé.

### Tests

- `supabase/tests/phase9_conformite.check.ts` : 47 OK (bornes J−1 / J0 / J+30 / J+31, documents,
  invalidation, IBAN, blocage, dérogations, isolation, storage, plafond total, parité du statut
  JS / SQL sur 162 cas). Autres suites : OK (deux anciens tests reçoivent une attestation).
- Contrôle en lecture seule : `supabase/tests/controle_conformite.sql` (11 lignes).
- Non testé connecté (identifiants requis).

### Attention à l'application de la migration

- Les sous-traitants existants n'ont aucune attestation : ils seront **bloqués** pour toute
  nouvelle affectation à un chantier jusqu'au dépôt d'une attestation 30bis (ou une dérogation).

---

## 2026-10-14 — Phase 9, PR C : captures des vérifications 30bis (stockage privé)

Branche : `phase-09-captures` (part de `phase-09-paiements`, PR #12 : même fenêtre de
vérification). Fusionner la PR B d'abord.

- Migration `20261014120000_storage_documents_30bis.sql` (idempotente, rollback commenté) :
  - premier bucket du projet, **`documents`, privé**, 5 Mo maximum, JPG / PNG / PDF (limites
    imposées par Supabase, contrôlées aussi dans le navigateur) ;
  - policies `storage.objects` : chemin `<company_id>/…` obligatoire (lecture, dépôt) ; dans
    `<company_id>/30bis/`, **aucun remplacement**, suppression seulement d'un fichier qu'aucune
    vérification ne cite (orphelin) ; autres dossiers de la société : remplacement et suppression
    permis (documents de conformité, PR D) ;
  - `verifications_30bis.preuve_fichier` : contrainte de chemin (`<company_id>/30bis/<uuid>.ext`
    de la même société) ;
  - droits par défaut de Supabase retirés sur `verifications_30bis` (pas d'UPDATE / DELETE pour
    `authenticated`, aucun accès `anon`) : la vérification et le lien vers sa capture sont
    réellement immuables (avant, une modification était sans effet mais sans erreur).
- Fenêtre « Enregistrer le résultat » : dépôt facultatif de la capture **avant**
  l'enregistrement (la vérification est immuable) ; si l'enregistrement échoue, le fichier
  orphelin est supprimé. Historique : « Voir la capture » (URL signée, 5 minutes).
- Tests : environnement Supabase simulé partagé (`supabase/tests/supabase_simule.ts` : auth,
  droits par défaut, storage avec RLS) ; `phase9_captures.check.ts` 12 OK ; les autres suites
  rejouées dans cet environnement (OK). Contrôle en lecture seule :
  `supabase/tests/controle_captures_30bis.sql`.
- Non testé connecté (identifiants requis) ; le dépôt réel dans Supabase Storage sera à vérifier
  après application de la migration.

---

## 2026-10-14 — Phase 9, PR B : contrats, prestations, paiements, retenue plafonnée

Branche : `phase-09-paiements`. Règles validées par Youssef le 14/10 (plan :
`docs/plans/phase-09-suite.md`).

### Migration `20261014090000_phase9_paiements_plafond.sql` (idempotente, rollback commenté)

- `verifications_30bis` + `montant_dette_onss`, `montant_dette_spf` : dettes affichées par le
  service officiel, saisies à chaque vérification (contrainte : pas de montant sans dette).
- `check_paiement_30bis` remplacé : retenue par type = min(HTVA × taux, dette du type − retenues
  du même type déjà appliquées sur les paiements non annulés liés à la même vérification). Dette
  non saisie (anciennes vérifications) = retenue pleine. Verrou par vérification (paiements
  simultanés). Le total retenu reste ≤ montant du paiement (CHECK `montant_verse >= 0`).
- `achat_paiements` + `annule_le`, `annule_par`, `motif_annulation` ; garde : suppression le jour
  même uniquement ; ensuite annulation avec motif (auteur et date imposés, rien d'autre ne
  change, ligne figée et conservée) ; modification interdite après le jour de saisie ; une
  annulation ne peut pas être pré-remplie à l'insertion.
- Contrat dont une demande de signature est signée : non modifiable.
- `est_gestionnaire()` (rôles `admin`, `gerant`) ; validation d'une prestation réservée aux
  gestionnaires, auteur et date imposés.

### Écrans (fiche sous-traitant)

- Vérification : montants de dette ONSS / SPF (obligatoires si dette cochée), affichés dans
  l'historique.
- Contrats : modification tant que non signé ; payé / reste à payer (forfait).
- Journal des prestations : date, heures, description, ouvriers (nom, fonction, heures),
  Checkinatwork ; validation par admin / gérant ; suppression tant que non validée.
- Paiement : vérification du jour obligatoire (« Vérifier maintenant » sans quitter le
  formulaire) ; retenues ONSS / SPF calculées et plafonnées, montant à verser au sous-traitant,
  à l'ONSS, au SPF ; erreurs de la base traduites. Liste : suppression le jour même, annulation
  avec motif ensuite (ligne barrée, motif visible) ; KPI hors paiements annulés.
- Démo : Nowak, dette ONSS 3 000 € → retenue plafonnée (au lieu de 4 900 €).

### Tests

- PGlite `supabase/tests/phase9_paiements.check.ts` : 21 OK (dont migration rejouée deux fois,
  plafond ONSS / SPF, plafond partagé entre deux paiements, annulation qui libère le plafond,
  gardes, contrat signé, validation par rôle), avec les droits par défaut de Supabase simulés.
- Parité JS / SQL du calcul plafonné : 2 000 cas aléatoires, 0 écart.
- Contrôle en lecture seule : `supabase/tests/controle_paiements_plafond.sql`.
- Non testé connecté (identifiants requis).

### Reste à faire

- Prestations visibles aussi sur la fiche chantier.
- PR C (captures), PR D (conformité, blocage d'affectation).

---

## 2026-10-14 — Phase 9, PR A : taux 30bis paramétrés (sans migration)

Branche : `phase-09-taux-30bis`.

- `src/lib/retenue-30bis.ts` : `tauxEnVigueur()` (ligne de `parametres_30bis` la plus récente avec
  `date_debut <= date`), `calculerRetenues()` (montant HTVA × taux, arrondi au cent) et
  `produitArrondiCent()`. Hook `useParametres30bis()`.
- **Arrondi exact** : calcul en entiers (BigInt). En flottant, 51 383,70 × 35 % = 17 984,2949…
  arrondissait à 17 984,29 € au lieu de 17 984,30 € comme PostgreSQL : le trigger
  `check_paiement_30bis` aurait refusé le paiement. Test de parité JS / SQL sur 12 044 cas
  (`supabase/tests/retenue_30bis_parite.check.ts`, PGlite, sans base réelle).
- Conformité TVA : le 15 % écrit en dur est supprimé ; taux SPF lu dans `parametres_30bis`, avec
  date d'entrée en vigueur, source, date de vérification et mention « indicatif ». Sans taux
  chargé, aucun calcul n'est affiché.
- Assistant IA : les taux ONSS / SPF du prompt viennent de `parametres_30bis` (présentés comme
  indicatifs) ; sans paramètres, consigne de n'en citer aucun.
- Démo : même fonction de calcul que l'écran et le trigger.
- Règles métier provisoires reçues pour les PR B à D (plafond au montant restant dû, vérification
  à chaque versement, documents obligatoires, blocage d'affectation, captures 5 Mo JPG/PNG/PDF) :
  voir `docs/plans/phase-09-suite.md`.

---

## 2026-10-13 (nuit) — Mise en production phase 9, nettoyage Vercel, plan de la suite

- La PR #8 avait été fusionnée dans la branche de la #7 (déjà fusionnée) : son code n'était pas
  sur `main`. Rattrapé par la PR #9 (fusionnée). `main` : build, types, i18n OK ; types Supabase
  avec `contrat_signatures`, `contrat_a_signer`, `signer_contrat`.
- Migration `20261013160000_phase9_contrat_signatures.sql` appliquée (vérifié : RPC présente,
  table refusée à `anon`).
- Vercel : projet supprimé et dépôt retiré de l'application GitHub (Youssef) ; aucun contrôle ni
  déploiement sur la fusion de la #9 ; environnements GitHub « Production » et « Preview »
  supprimés. Hébergement : Lovable uniquement.
- Leçon : une PR « empilée » doit viser `main` dès que la PR de base est fusionnée.
- Suite de la phase 9 planifiée : [docs/plans/phase-09-suite.md](plans/phase-09-suite.md)
  (4 PR, 5 questions ouvertes).

---

## 2026-10-13 (soir) — Phase 9 : contrat de sous-traitance signé par lien

Branche : `phase-09-contrat-signature` (part de `phase-09-sous-traitants-ui`, PR #7).

### Fait

- **Modèle** `sous_traitance_cadre_v1` (`src/lib/contrats/sous-traitance.ts`) : texte intégral du
  modèle générique fourni par Youssef (19 articles, annexe 1 fiche de commande, annexe 2 liste de
  contrôle, références juridiques). « [ENTREPRENEUR PRINCIPAL] » et les pointillés sont remplacés
  par les données ; un champ vide reste en pointillés. Le document est en **français** (seule version
  qui fait foi) ; l'interface autour est traduite en 5 langues.
- **Pré-remplissage** depuis la société, le profil, la fiche sous-traitant, le contrat et le chantier
  (maître d'ouvrage, adresse, prix, délai, autoliquidation…) ; tout est modifiable avant l'envoi.
- **Circuit** : fiche sous-traitant → « Nouveau contrat » (mission) → « Contrat à signer » →
  données → relecture + signature manuscrite de l'entrepreneur → lien unique (validité 1 à 90 jours)
  à copier, envoyer par e-mail (mailto) ou WhatsApp. Suivi : en attente / consulté / signé /
  annulé / expiré ; annulation ; PDF.
- **Page publique** `/signer/$token` (sans compte, `noindex`) : contrat pré-rempli, le sous-traitant
  corrige représentant, qualité, contact, IBAN, indique le lieu, coche l'acceptation et signe au
  doigt ou à la souris ; PDF signé téléchargeable ensuite.
- **Migration** `20261013160000_phase9_contrat_signatures.sql` : table `contrat_signatures`
  (données figées à l'envoi, empreinte SHA-256 du texte envoyé), RPC `security definer`
  `contrat_a_signer` / `signer_contrat` (seuls accès anonymes), trigger de garde (jeton imposé,
  pas de création « déjà signée », demande signée ou annulée figée), pas de suppression, contrat
  signé non supprimable. Signature refusée si le texte présenté diffère de celui envoyé
  (`document_modifie`). IP et navigateur du signataire enregistrés (piste d'audit).
- Droits par défaut de Supabase (ALL pour anon/authenticated sur les nouvelles tables) retirés
  explicitement ; le test PGlite les simule.
- **PDF** (jsPDF, compressé) : contrat complet, zone de signatures (images), piste d'audit
  (dates, IP, navigateur, empreintes, mention eIDAS). Lettres hors WinAnsi translittérées
  (Wiśniewski → Wisniewski) ; signatures converties en JPEG (le PNG sortait sur fond noir).
- Tests PGlite : 20 OK (`supabase/tests/phase9_contrat_signatures.check.ts`) ; contrôle en lecture
  seule `supabase/tests/controle_contrat_signatures.sql`. Parcours de signature testé dans le
  navigateur avec une réponse simulée de la base (empreinte vérifiée, champs transmis).

### Points d'attention

- Signature électronique **simple** (eIDAS) : valable entre professionnels, force probante à
  apprécier ; pour une signature qualifiée (itsme, eID), passer par un prestataire (à décider).
- Le modèle est un **modèle générique à faire valider par un juriste**. Toute modification du texte
  = nouvelle version (`sous_traitance_cadre_v2`), sinon les liens déjà envoyés deviennent
  insignables (empreinte différente).
- Versions NL / EN du contrat : à rédiger et faire valider.
- Envoi automatique par e-mail (sans passer par la messagerie de l'utilisateur) : nécessite un
  fournisseur d'e-mails (à choisir).

---

## 2026-10-13 — Migrations appliquées ; phase 9 : écrans sous-traitants (1re partie)

Branche : `phase-09-sous-traitants-ui`.

### État de la base (vérifié le 13/10)

- Migrations **phase 1 et phase 9 appliquées** par Youssef (éditeur SQL Supabase, pas via Lovable :
  aucune copie Lovable à supprimer). L'erreur `chantiers_id_company_uniq already exists` vient de la
  **phase 9** (et non de la phase 1) : elle avait déjà été exécutée. L'éditeur SQL exécute un
  fichier en une transaction : l'existence des tables prouve que le fichier est passé en entier.
- Contrôle en lecture via l'API REST (clé publique) : colonnes `langue` (profiles, personnel,
  clients), table `traductions`, fonction `to_code`, les 6 tables de la phase 9 et **toutes** leurs
  colonnes, `company_settings.duree_conservation_ouvriers_ans` : présents. Pas de migration corrective.
- Contraintes, triggers et policies non visibles avec la clé publique : requête de contrôle à
  exécuter dans l'éditeur SQL fournie dans le résumé de PR.

### Fait

- `types.ts` : 6 tables de la phase 9 + `company_settings.duree_conservation_ouvriers_ans`
  (format `supabase gen types`, FK composites comprises).
- `/sous-traitants` : liste (recherche, filtres métier/statut, feu tricolore 30bis, compteur « à
  vérifier avant paiement »), bouton « Charger des sous-traitants de démonstration » si la liste est vide.
- `/sous-traitants/$id` : fiche (coordonnées, contact, métiers, IBAN, conditions et note interne
  traduisibles), KPI (contrats, total versé, retenues 30bis), bloquer/débloquer, suppression refusée
  avec message clair si des preuves 30bis existent (FK RESTRICT).
- **Vérification 30bis** : lien vers le service officiel (n° prérempli) + enregistrement manuel
  daté du résultat (dette sociale / fiscale), historique immuable. État : « vérifié aujourd'hui »,
  « à vérifier », « dette constatée » (date de Bruxelles, comme le trigger).
- Formulaire (zod) : n° BCE contrôlé (modulo 97), TVA belge, emails, unicité BCE (erreur 23505
  traduite), formes juridiques en codes (jamais « SPRL »), métiers multiples.
- Contrats et paiements affichés en lecture sur la fiche.
- i18n : namespace `sousTraitants` + statuts (`sousTraitant`, `formeJuridique`, `metier`,
  `typePrix`, `unite`, `frequencePaiement`, `modePaiement`) en FR/NL/EN/RO/PL ; `i18n:check` ✓.
- Démo (`seedSousTraitants`) : 5 sous-traitants (1 dette sociale constatée avec retenue appliquée,
  1 bloqué, 1 jamais vérifié), 5 contrats, 3 prestations, 6 vérifications, 5 paiements cohérents
  avec le trigger (retenue = HTVA × taux lu dans `parametres_30bis`, TVA 0 : autoliquidation).
  Appelée à la création d'une société de démo et depuis la liste vide.
- Tests PGlite : 20 OK (+ paiement de démo daté du passé, création client FR/NL, ouvrier RO/CDI,
  refus des anciens libellés).

### Reste à faire (phase 9)

- Saisie des contrats, du journal des prestations et des paiements (avec calcul de la retenue).
- Dépôt de la capture d'écran de la vérification (bucket `documents`).
- `documents_conformite`, checklists par statut, alertes à 30 jours, tableau de bord tricolore.
- « 1 document expiré » de la démo : dépend de `documents_conformite`.
- Relecture native NL/RO/PL des nouveaux libellés.

---

## 2026-10-06 — Phase 9 : migration préparée (non appliquée)

Branche : `phase-09-sous-traitants` (préparée pendant que la phase 1 est terminée par Youssef).

- Migration `20261006120000_phase9_sous_traitants.sql` : `sous_traitants`, `parametres_30bis`
  (taux de retenue datés, globaux, indicatifs 35 % / 15 %), `verifications_30bis` (preuve datée,
  **ni modifiable ni supprimable**), `sous_traitant_contrats`, `sous_traitant_prestations`,
  `achat_paiements` (liés au contrat ; `achat_id` ajouté en phase 12).
- Règles en base (trigger) : paiement refusé sans vérification 30bis **du jour** et **du même
  sous-traitant** ; si dette, retenue exacte exigée (taux en vigueur à la date du paiement) ;
  `montant_verse` calculé (colonne générée).
- Isolation entre sociétés : RLS + clés étrangères composites `(id, company_id)` — impossible de
  rattacher un contrat au chantier d'une autre société, même en connaissant son identifiant.
- Formes juridiques en codes (`srl`, `sa`, `sc`, `scomm`, `independant`, `autre`) ; « sprl » refusé.
- **Testé** sur PostgreSQL en mémoire (PGlite) : les 13 migrations du dépôt rejouées sur base vide,
  13 tests OK (30bis, contraintes, RLS, FK composites), rollback vérifié puis migration rejouée.
  Script : `supabase/tests/phase9_sous_traitants.check.ts` (prérequis : `bun add -d @electric-sql/pglite`).
- Pas encore fait (à la reprise de la phase 9) : `types.ts`, `documents_conformite` et checklists,
  écrans, i18n, données de démo.
- Corrections du 06/10 (soir) : un sous-traitant ayant une vérification 30bis ne peut plus être
  supprimé (la suppression en cascade aurait effacé la preuve) → statut « bloque » ;
  `company_settings.duree_conservation_ouvriers_ans` (défaut 10, à confirmer). 15 tests OK.
- Question ouverte : plafond éventuel de la retenue au montant de la dette. Rappel : la base de
  calcul est le montant HTVA **du paiement** (35 % / 15 % de la facture), pas la dette.

---

## 2026-10-06 — Phase 1 : multilingue (FR / NL / EN / RO / PL)

Branche : `phase-01-i18n` (inclut le correctif `fix/fermeture-modales`).

### Fait

- **i18next** (`src/lib/i18n.ts`) : français par défaut et secours ; premier rendu en français
  (identique au rendu serveur), puis langue du profil > langue mémorisée sur l'appareil > navigateur.
  Sélecteur à drapeaux dans le menu, sur la connexion et dans Mon profil ; changement instantané.
- **16 namespaces × 5 langues**, clés typées (`src/i18next.d.ts`). Toutes les pages, fenêtres,
  toasts, confirmations, exports CSV et rapports PDF traduits ; pluriels par langue.
- **Statuts en codes neutres** (`en_cours`, `accepte`, `present`, `cdi`, `camionnette`…) : code,
  données de démo et migration. Comparaisons via `toCode()`, qui tolère les anciens libellés français
  tant que la migration n'est pas appliquée (aucune rupture pendant la transition).
- **Documents** : PDF du devis dans la langue du client (FR/NL/EN), mentions légales comprises ;
  conditions par défaut d'un nouveau devis dans la langue du client. Rapports internes (liste des
  chantiers, présences) dans la langue de l'interface.
- **Langues en base** : `profiles.langue`, `personnel.langue` (5 langues), `clients.langue` passé en
  minuscules + `en` (documents FR/NL/EN).
- **Traduction du contenu saisi** : `translateText()` (serveur, IA via `ai.server.ts`, cache par
  société dans `traductions`, clé SHA-256) + composant `TranslatableText` (notes client, description
  de chantier ; servira au journal de chantier en phase 11).
- **Assistant IA** : répond dans la langue de l'utilisateur ; erreurs IA en codes traduits.
- **Contrôle** `bun run i18n:check` (`scripts/check-i18n.ts`) : clés et variables `{{…}}` identiques
  dans les 5 langues, formes plurielles requises par langue, aucune chaîne visible en dur (analyse
  TypeScript du JSX, attributs visibles, toasts/confirm/prompt). Résultat : ✓.
- Migration `20260925090000_phase1_i18n.sql` **testée sur PGlite** : conversion des libellés existants,
  contraintes (un libellé français est refusé), valeurs par défaut, langues ; migration phase 9 rejouée
  après. Bloc ROLLBACK commenté.
- Corrigé au passage : rapport de présences et page Précompte qui comparaient des libellés français
  (auraient affiché 0 après migration) ; coût/km « 0 € » et « entretien il y a -41 j » (fiche véhicule) ;
  sous-titre du dashboard « +12 % vs mois dernier » (valeur fictive) remplacé par le nombre de chantiers.
- Vérifié dans l'app : FR → NL → PL (menu, dashboard, chantiers, devis, véhicules, précompte, fiche
  devis avec bouton « PDF (FR) »), pluriels polonais corrects, aucune erreur après rechargement.

### Décidé

- Codes de langue en minuscules partout (`fr`, `nl`…), comme i18next.
- NL : « offerte » pour devis (usage courant en Belgique) plutôt que « bestek » cité dans la passation ;
  « werf », « oplevering », « bedrijfsvoorheffing », « RSZ », « KBO/ondernemingsnummer », « btw ».
- RO/PL : institutions belges gardées telles quelles (ONSS, SPF Finances) pour les ouvriers en Belgique.

### À faire / points ouverts

- [ ] **Appliquer la migration** `20260925090000_phase1_i18n.sql` juste après la fusion (le code
      tolère l'ancien état, mais la création d'un client ou d'un ouvrier avec une langue échoue tant
      qu'elle n'est pas appliquée). Puis supprimer la copie éventuelle créée par Lovable.
- [ ] **Relecture native** NL / RO / PL (§8.6), en priorité les **mentions légales** NL/EN du PDF
      (autoliquidation, TVA 6 %) et la terminologie chantier.
- [ ] Calculateur de la page Conformité TVA : taux 15 % encore en constante → `parametres_30bis`
      quand la phase 9 sera fusionnée.
- [ ] Le choix de langue n'est enregistré dans le profil qu'après la migration (colonne `langue`).

---

## 2026-10-06 — Compléments de périmètre (PASSATION §10.6)

- Schémas reçus intégrés aux phases 9, 12, 13 et à l'annexe A : `sous_traitant_contrats`,
  `sous_traitant_prestations`, liens achats ↔ sous-traitance (`achat_prestations`,
  `achat_paiements`), `livre_caisse`, enrichissement de `equipements` pour l'inventaire.
- Corrections principales : 30bis vérifié et daté **à chaque paiement** (pas un booléen sur la
  fiche) ; chantier obligatoire seulement pour la sous-traitance ; solde de caisse calculé, jamais
  stocké ; pas de tables `inventaire_*` séparées (double saisie) ; rien côté factures de vente
  (hors périmètre) ; prix « % du CA » remplacé par « unitaire ».
- Nouveaux CA : solde de caisse exact après correction ; paiement de sous-traitance refusé sans
  vérification 30bis du jour.

---

## 2026-09-29 — Mise à jour du périmètre (PASSATION §10)

- Proposition externe examinée (sous-traitants, associés actifs « loi 2027 », frais de restaurant,
  inventaire). Schéma proposé non retenu tel quel (tables en anglais, `projects`/`users`/
  `user_companies` inexistants, « SPRL », TVA restaurant « 50 % déductible »).
- **Retenu** : phase 9 + contrats et journal de prestations des sous-traitants (factures via la
  phase 12) ; phase 12 + catégorie « Frais de restaurant » ; phase 13 + export « Inventaire à date »
  sans amortissements. Taux restaurant indicatifs (69 % impôt, TVA 0 %) en table de paramètres.
- **En attente** : feuilles de temps des associés actifs, tant qu'aucune source officielle n'est
  fournie. NISS non stocké sauf obligation légale.
- Corrections apportées à la note reçue :
  - RLS via `get_user_company_id()` (pas de table `user_companies`) ;
  - forme juridique de la société dans `companies`, pas dans `company_settings` ;
  - **pas de section `-- migrate:down` exécutable** : Supabase/Lovable exécutent le fichier entier,
    le retour arrière serait appliqué aussitôt. Convention : bloc `-- ROLLBACK` entièrement
    commenté en fin de migration (appliquée à la migration de phase 1).
- Ordre des phases maintenu ; phases 9 et 12 avançables après la phase 3.

---

## 2026-09-24 (nuit) — Migrations phase 0 appliquées, nettoyage

Branche : `phase-00-suivi`.

- PR #2 fusionnée ; Lovable a exécuté les 3 migrations, mais en les **recopiant** sous ses propres
  noms (`20260924174657_…`, `…174711_…`, `…175000_…`, contenu identique), en laissant les originaux.
  Rejouer les migrations sur une base neuve aurait créé `company_settings` deux fois (échec).
  → Originaux supprimés (`…130000_phase0_dedoublonnage_demo`, `…130100_phase0_company_settings`,
  `…180000_phase0_taux_vers_company_settings`) : les copies Lovable sont celles enregistrées comme
  appliquées, dans un ordre cohérent (173652 → 174657 → 174711 → 175000).
- Vérifié par Lovable en base : 2 sociétés × 1 jeu de démo, aucun doublon ; 2 lignes
  `company_settings` ; colonnes de taux retirées de `companies`.
- Vérifié dans l'app : page Précompte → lecture `company_settings` (200), modification d'un taux →
  upsert (200) + « Taux enregistrés », valeur relue après rechargement. Valeur d'origine remise.
- `types.ts` et `previewAuthStorage.ts` sont régénérés par Lovable dans son propre format :
  exclus de Prettier/ESLint (`.prettierignore`, `eslint.config.js`) pour que le lint reste stable.
- Leçon pour la suite : **Lovable ne voit que `main`** et recopie les migrations qu'on lui fait
  exécuter. Procédure retenue : fusionner la PR, puis demander à Lovable d'exécuter la migration ;
  ensuite supprimer l'original s'il a été recopié (ou, mieux, laisser Lovable appliquer et garder
  sa copie uniquement).
- Avertissements de sécurité Supabase (5) : Lovable indique des fonctions `security definer`
  appelables par `authenticated` (vérifient la société en interne) + protection des mots de passe
  divulgués désactivée. À traiter dans une migration dédiée — liste exacte à récupérer.

---

## 2026-09-24 (soir) — Réconciliation avec les commits Lovable sur `main`

- Lovable ne lit que `main` : la PR #2 n'étant pas fusionnée, il n'a **pas** appliqué les
  migrations de phase 0. À la place, il a créé `20260924173652_…` (3 colonnes de taux sur
  `companies`) et branché `precompte.tsx` dessus (chargement + enregistrement automatique).
- `main` fusionnée dans `phase-00-mise-en-place`. Conflits (dus au formatage Prettier) résolus.
- **Décision** : une seule source pour les paramètres → `company_settings`. La fonctionnalité de
  Lovable est conservée (taux chargés depuis la base, enregistrés automatiquement après 600 ms),
  mais sur `company_settings`. Nouvelle migration `20260924180000_phase0_taux_vers_company_settings.sql` :
  recopie les taux saisis dans `companies` vers `company_settings`, puis supprime les 3 colonnes.
- Ordre d'application en base : `…130000` (dédoublonnage) → `…130100` (company_settings) →
  `…173652` (déjà appliquée par Lovable) → `…180000` (réconciliation).
- Avant application, la page Précompte fonctionne avec les taux par défaut (404 sur
  `company_settings`, sans effet visible).

---

## 2026-09-24 — Phase 0 : mise en place et corrections

Branche : `phase-00-mise-en-place`.

### Fait

- **Outillage** : `CLAUDE.md`, `PASSATION.md` à la racine, ce journal, `.gitattributes` (LF),
  `.env.example`. Formatage Prettier de tout l'existant (commit séparé, sans changement fonctionnel).
- **Lint** : `bun run lint` passe (0 erreur ; 13 avertissements restants : `react-refresh`
  dans les composants shadcn/ui et `exhaustive-deps` dans `stock.index`). `bunx tsc --noEmit` passe.
- **B1 — doublons de la démo**
  - Le correctif de Lovable (`seed_lock` + `useRef`) était déjà présent.
  - Faille restante corrigée : `companies.demo_seeded` avait été ajouté à `false` pour les sociétés
    déjà peuplées → elles auraient reçu un second seed. Migration
    `20260924130000_phase0_dedoublonnage_demo.sql` : `demo_seeded = true` pour toute société ayant des
    chantiers.
  - Même migration : fonction `dedupe_demo_data(company_id)` (copies exactes par clés naturelles,
    ligne la plus ancienne conservée, références rattachées), exécutée pour toutes les sociétés.
- **B2** : « TechLog BVBA » → « TechLog BV » (BVBA = SPRL en néerlandais). Aucun « SPRL » restant.
  Compte démo : « Démo Construction SRL ».
- **B3** : statuts démo déjà variés (2 en cours, 1 en retard, 1 terminé, 1 en attente) — vérifié.
- **B5** : plus aucun `as any` / `: any` dans `src` (hors `routeTree.gen.ts` généré). Typage via
  `Tables<>` / `TablesInsert<>` / `TablesUpdate<>`.
- **B6** : `.env` ne contient que l'URL Supabase et la clé publiable (JWT vérifié : rôle `anon`).
  Il reste versionné (requis par Lovable). Les secrets serveur vont dans `.env.local` (ignoré) ou
  dans les secrets de l'hébergeur — voir `.env.example`.
- **`company_settings`** (migration `20260924130100_phase0_company_settings.sql`) : une ligne par
  société, créée par trigger et rétroactivement ; taux indicatifs (précompte, ONSS perso/patronal,
  base ouvrier 108 %, date de vérification), marge cible, coefficient coût chargé, heures/jour,
  marge intempéries, seuil Checkinatwork, couleur, IBAN/BIC ; RLS 4 policies. Types ajoutés.
- **`src/lib/ai.server.ts`** : `chat()` indépendant du fournisseur (`AI_PROVIDER` = `lovable` par
  défaut | `anthropic`, `AI_MODEL`). L'assistant l'utilise.
- **Vérifié dans l'app (localhost, compte démo)** : dashboard, chantiers (5), fiche chantier,
  véhicules (7), fiche véhicule, devis (8), fiche devis — aucun doublon, aucune erreur console.
- **Bugs corrigés au passage**
  - Assistant : le contexte envoyé à l'IA lisait des champs inexistants (`spent`, `ct_expiry`,
    `insurance_expiry`, `v.name`, `p.role`) → l'IA voyait « ? » au lieu des dépenses et échéances.
  - Fiche véhicule : le kilométrage de départ d'une affectation était enregistré comme chaîne.
  - `catch` : `err.message` sur des `PostgrestError` → helper `errorMessage()`.

### Décidé (par défaut, en attente de confirmation de Youssef)

- **IA** : gateway Lovable conservé ; bascule Anthropic possible par variable d'environnement.
- **Hébergement** : reste sur Lovable (sync GitHub) ; `.env` public versionné.
- **Supabase** : Claude Code n'a pas d'accès CLI ; migrations écrites ici, appliquées par Youssef ;
  `types.ts` maintenu à la main au format généré.
- **Coefficient coût horaire chargé** par défaut : **1,8** (hypothèse à valider — §8 point 5).
- `chatWithTools()` reporté à la phase 4 (les schémas d'outils y sont définis).

### À faire / points ouverts

- [ ] **Appliquer les 2 migrations** de la phase 0 sur Supabase, puis vérifier : plus de doublons,
      une ligne `company_settings` par société.
- [ ] CA « aucun doublon après 10 rechargements » : à vérifier sur l'environnement Lovable après
      application des migrations.
- [ ] Valider les taux indicatifs par défaut de `company_settings` (§8 point 4) et le coefficient 1,8.
- [ ] Répondre aux questions §8 (fournisseur IA, hébergement, domaine, etc.).
- [ ] Vitest pas encore installé : à ajouter en phase 3 (premiers tests métier : ATN).
- [ ] `precompte.tsx` utilise encore les `DEFAULTS` de `belgian.ts` en `useState` : refonte phase 3 (B4).
- [ ] Bugs d'affichage existants relevés (non corrigés, hors périmètre phase 0) :
      fiche véhicule « 0 € / km » (`formatEUR` arrondit 0,42 €) ; « Dernier entretien … il y a
      -41 j » (le seed place `maintenance_date` dans le futur).
- [ ] Pas d'accès GitHub en écriture depuis le poste de dev (push/PR à faire par Youssef ou via
      `gh auth login`).
