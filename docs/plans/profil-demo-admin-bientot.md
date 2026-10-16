# Plan — logo, comptes sans démo, administrateur de la plateforme, « Bientôt disponible »

État au 16/10/2026. Deux PR, aucune fusionnée par Claude. Migrations à appliquer par Youssef
(Lovable), chacune avec un contrôle SQL en lecture seule. Aucune action sur la base de production.

## 0. PR de sécurité préalable (séparée, prioritaire) — faille existante

**Constat** : la policy `Users update own profile` (migration d'origine Lovable) autorise chaque
utilisateur à modifier **toutes** les colonnes de son profil, y compris `company_id` et `role`.
Démontré sur base simulée (PGlite, migrations de `main`) : l'utilisateur A remplace son
`company_id` par celui de la société B, puis lit les chantiers de B. Il peut aussi se donner le
rôle `admin`. Il suffit de connaître l'identifiant (UUID) de la société visée.

**Correction** (migration `20261016090000_profils_champs_proteges.sql`) :

- trigger `BEFORE UPDATE` sur `profiles` : pour les rôles `authenticated` / `anon`, refus
  (`profil_champ_protege`) si `id`, `company_id` ou `role` changent. L'application ne modifie que
  `full_name`, `avatar_url` et `langue`. Les fonctions `security definer` (création de compte)
  ne sont pas concernées ;
- trigger `BEFORE INSERT` : un profil n'est créé que par `handle_new_user()` (création de compte) ;
  insertion directe refusée pour `authenticated` / `anon`.

**Contrôle SQL** : présence des triggers et de la fonction ; recherche des profils dont la société
n'a jamais été créée pour eux (indice d'une exploitation passée).

**Tests PGlite** : avant/après, changement de nom ou de langue toujours possible, création de compte
toujours fonctionnelle.

Le mode administrateur ci-dessous s'appuie sur cette correction : sans elle, l'isolation entre
sociétés ne tient pas.

## 1. Logo d'entreprise

- **Base** (migration `20261016100000_logos_entreprise.sql`) :
  - colonne `companies.logo_chemin` (chemin Storage) avec contrainte de format
    `<company_id>/logo-<uuid>.(jpg|png|webp)` ;
  - bucket **privé** `logos`, 2 Mo, `image/jpeg`, `image/png`, `image/webp` (limites appliquées par
    Supabase) ;
  - 4 policies sur `storage.objects` limitées au dossier de la société (règle existante
    `get_user_company_id`).
  - L'ancienne colonne `logo_url` (URL saisie à la main, jamais utilisée dans les documents) n'est
    pas supprimée ; son champ disparaît du profil.
- **Profil** : aperçu du logo, boutons Charger / Remplacer / Supprimer. Contrôle zod côté client :
  type et taille (2 Mo). Remplacer = nouveau fichier puis suppression de l'ancien. Sans logo : logo
  par défaut, à savoir les initiales de la société sur fond de couleur, comme les avatars.
- **Documents** :
  - devis et factures : logo en haut à gauche (fond blanc) ;
  - rapports internes (`header()` : chantiers, présences, registre 30bis, dossier de conformité,
    journal de chantier) : logo dans le bandeau.
  - Sans logo : rendu actuel inchangé.
  - Le logo est converti en PNG pour le PDF, car jsPDF ne lit pas le WebP.
  - **Contrats de sous-traitance : pas de logo.** Le PDF d'un contrat signé reste identique ;
    à ajouter plus tard, si vous le souhaitez, dans une version de modèle.

## 2. Plus de chantiers de démonstration pour les nouveaux clients

**Constat** : à la première connexion, l'application peuple **chaque** nouvelle société avec des
données de démonstration :

- `src/lib/seed.ts` : chantiers « Villa Rénovation Namur », « Extension maison Collignon »…,
  clients, personnel, véhicules, factures, sous-traitants… ;
- verrou `seed_lock()` qui bascule `companies.demo_seeded`.

Ces données sont mélangées aux vraies données de la société (même `company_id`).

**Mécanisme** (migration `20261016110000_demo_et_admin_plateforme.sql`) :

- `companies.est_demo boolean NOT NULL DEFAULT false` : une société de démonstration est une
  société à part entière, marquée comme telle ;
- `seed_lock()` ne déclenche plus le peuplement que si `est_demo = true`. **Un nouveau compte
  démarre donc vide** ; le code de peuplement reste disponible pour les sociétés de démonstration ;
- un utilisateur ne peut pas modifier `est_demo` lui-même (trigger) ; seul l'administrateur de la
  plateforme le peut, via une fonction dédiée.
- **Rien n'est supprimé.** Les sociétés déjà peuplées gardent leurs données ; l'administrateur
  marque comme « démo » ses comptes de test existants.
- **Contrôle SQL** : liste des sociétés déjà peuplées (`demo_seeded`), avec le nombre de chantiers
  portant un nom du jeu de démonstration, pour identifier les comptes de test avant de les marquer.

## 3. Administrateur de la plateforme

Le rôle `admin` existe déjà : c'est l'administrateur **d'une société**. Le nouveau rôle s'appelle
donc **« administrateur de la plateforme »** pour éviter toute confusion.

- **Base** (même migration) :
  - `est_admin_plateforme()` (`security definer`) renvoie vrai uniquement pour l'utilisateur
    courant dont l'e-mail est `kaillaniyoussef@gmail.com` **et confirmé** (`email_confirmed_at`).
  - Le contrôle est fait en base. L'interface ne fait qu'afficher ou masquer.
  - Droits : `REVOKE` à `PUBLIC` et `anon`, `GRANT` à `authenticated`.
- **Lecture des données de démonstration** : une policy `SELECT` supplémentaire sur chaque table
  ayant `company_id` (et sur `companies`) :
  `est_admin_plateforme() AND est_societe_demo(company_id)`.
  - Lecture seule.
  - **Aucun accès aux sociétés non « démo »** : les policies existantes restent la seule voie, et
    elles sont limitées à la propre société de l'administrateur.
- **Comptes** (`admin_comptes()`, réservé à l'administrateur) :
  - pour **toutes** les sociétés : nom, date de création, démo oui/non, peuplée oui/non, nombre
    d'utilisateurs ;
  - pour les sociétés **démo** uniquement : e-mails des utilisateurs et nombre de chantiers.
  - Aucune donnée métier des clients réels (chantiers, clients, factures…).
- **`admin_definir_demo(société, oui/non)`** : réservé à l'administrateur ; c'est lui qui décide.
  Marquer une société « démo » rend ses données lisibles par l'administrateur : à réserver aux
  comptes de test.
- **Interface** :
  - page `/admin`, sans entrée dans le menu ; lien discret dans le profil, visible seulement pour
    l'administrateur ;
  - onglet « Comptes » : liste, bascule démo ;
  - onglet « Démonstration » : chantiers des sociétés démo.
- **Contrôle SQL** : liste des utilisateurs pour lesquels `est_admin_plateforme` serait vrai. Le
  résultat attendu est **une seule ligne**, `kaillaniyoussef@gmail.com`, e-mail confirmé.
  S'ajoutent la vérification des droits d'exécution et des policies créées.

## 4. « Bientôt disponible »

- Page `/bientot-disponible`, **hors menu principal**. On y accède par un lien dans le profil et par
  un lien discret en bas du tableau de bord.
- Fonctionnalités annoncées, sans date, chacune avec le badge « Bientôt disponible » :
  - Module Achats (factures fournisseurs, frais, livre de caisse) ;
  - Facturation électronique Peppol (le périmètre indique « Bientôt » pour les factures de vente) ;
  - Signature itsme ou eID ;
  - Signature séparée de chaque fiche chantier ;
  - Versions NL et EN du contrat faisant foi ;
  - autres fonctionnalités prévues (feuille de route) : site web, avis clients, e-mails et agenda,
    estimation et planning, journal de chantier mobile, matériel et déchets, primes rénovation,
    rapport mensuel.
- Nouveau namespace i18n `bientot` dans les 5 langues (déclaré dans `src/i18next.d.ts`).

## Tests

- **PGlite** (`supabase/tests/plateforme.check.ts`), sur base simulée en mémoire avec toutes les
  migrations :
  - un nouveau compte démarre avec 0 chantier et `seed_lock` ne renvoie rien ;
  - un utilisateur ne peut pas se marquer « démo » ;
  - l'administrateur avec e-mail confirmé est reconnu ; le même e-mail non confirmé ne l'est pas,
    un autre e-mail non plus ;
  - l'administrateur lit les chantiers d'une société démo, pas ceux d'une société réelle ;
    `admin_comptes` et `admin_definir_demo` sont refusés aux autres utilisateurs ;
  - logos : cloisonnement par société, bucket privé, limites (2 Mo, 3 types).
- **Droits des fonctions** : le contrôle existant (`controle_droits_fonctions.sql`) reste vert ;
  aucune nouvelle fonction n'est ouverte à `anon`.
- **Contrôles** : `tsc`, lint, `i18n:check`, build.
- **Navigateur** (serveur de dev, sans base) : pages `/bientot-disponible` et rendu des en-têtes PDF
  avec un logo fictif.

## Hors périmètre

Données de démonstration dans une base séparée ; journal d'audit des actions de l'administrateur
(à prévoir si d'autres administrateurs sont ajoutés) ; logo dans les e-mails (phase 7).
