# Plan — back-office administrateur de la plateforme

État au 16/10/2026. Branche `backoffice-admin`, une PR non fusionnée. Une migration à appliquer par
Youssef (avec contrôle SQL et script de vérification sans trace). Aucune action sur la base de
production.

Le back-office prolonge la page `/admin` existante (PR #23). Elle est volontairement absente du
menu principal ; le lien n'apparaît que pour l'administrateur, dans le profil. Elle n'est visible
sur le site qu'après publication dans Lovable.

## Principe de sécurité (rappel de la demande, point 5)

- **Administrateur** : uniquement `kaillaniyoussef@gmail.com`, e-mail confirmé, contrôle en base
  (`est_admin_plateforme`).
- **Clients réels** :
  - **aucune donnée métier** (chantiers, sous-traitants, contrats, prestations, conformité,
    montants, contenus, e-mails, noms des personnes) ;
  - seules restent visibles les **métadonnées de compte** : nom de la société, dates, rôles,
    dernière connexion, nombre d'utilisateurs, types d'événements ;
  - les statistiques globales sont des **totaux agrégés** sur toute la plateforme, jamais par
    client réel.
- **Sociétés de démonstration** : lecture complète, **en lecture seule** (policies déjà en place
  depuis la PR #23).
- **Écritures** : la seule action est « marquer / retirer démo ». Elle exige une **validation
  explicite** (saisie du nom de la société) et elle est **journalisée**.
- **RLS stricte** :
  - les nouvelles tables (journal, erreurs) ont la RLS activée **sans aucune policy** et des droits
    retirés à `anon` et `authenticated` ;
  - la lecture passe uniquement par des fonctions `security definer` qui vérifient
    l'administrateur ;
  - la conformité des sociétés démo est calculée en `security invoker`, donc soumise à la RLS.

> **Contradiction tranchée** : la « vue par client » demande chantiers, sous-traitants, contrats,
> prestations et conformité, alors que le point 5 interdit tout accès aux données des clients
> réels. Le **détail complet est donc réservé aux sociétés démo** ; un client réel n'affiche que sa
> fiche de compte. À changer seulement sur décision explicite, par exemple pour voir les volumes
> d'utilisation par client (et vérifier alors la compatibilité avec vos conditions d'utilisation
> et le RGPD).

## 1. Statistiques globales

`admin_statistiques()` renvoie, pour chaque indicateur, le total **clients réels** et le total
**démo** : sociétés, chantiers, sous-traitants, contrats, prestations, vérifications 30bis
(plus utilisateurs).

## 2. Vue par client

- **Liste** (`admin_comptes`, existant) : nom, création, démo, nombre d'utilisateurs ; un clic
  ouvre la fiche.
- **Fiche `/admin/clients/$id`** :
  - **société démo** : chantiers, sous-traitants avec leur statut de conformité
    (`admin_conformite`, security invoker), contrats et prestations, en lecture seule ;
  - **client réel** : fiche de compte uniquement (création, utilisateurs et rôles, dernière
    connexion), avec la mention « données du client non accessibles ».

## 3. Utilisateurs

`admin_utilisateurs()` renvoie, pour chaque utilisateur : rôle, société, démo, date de création,
dernière connexion (`auth.users.last_sign_in_at`). L'e-mail et le nom ne sont fournis que pour les
sociétés démo.

## 4. Journal d'activité

`admin_activite(categorie, limite)` regroupe quatre sources :

| Catégorie              | Source                                                                              | Clients réels       | Démo      |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------- | --------- |
| Connexions             | `auth.audit_log_entries` (événements `login` de Supabase), sinon dernière connexion | date, société       | + e-mail  |
| Créations de comptes   | `auth.users`                                                                        | date, société       | + e-mail  |
| Changements importants | nouvelle table `journal_plateforme` (triggers)                                      | date, type, société | + détails |
| Erreurs récentes       | nouvelle table `erreurs_application`                                                | date, code, page    | + message |

- **Changements journalisés** (triggers `security definer` ; seulement des identifiants, aucun
  contenu métier) :
  - société créée ;
  - démo activée ou retirée (avec l'auteur) ;
  - rôle ou société d'un profil modifié (par le tableau de bord ou une fonction) ;
  - contrat envoyé en signature, signé ou annulé ;
  - document de conformité invalidé ;
  - dérogation accordée ou révoquée ;
  - paiement annulé.
- **Erreurs** :
  - `signaler_erreur(code, message, page)` est appelée par l'application en cas d'erreur non gérée
    (gestionnaires globaux) ;
  - la société et l'utilisateur sont déduits de la session ;
  - textes tronqués ; au plus 20 erreurs par utilisateur sur 10 minutes ;
  - purge automatique après 90 jours.

## Migration `20261017090000_backoffice_admin.sql`

- **Tables** : `journal_plateforme` et `erreurs_application`.
  - Tables de **plateforme**, exception documentée à la règle « 4 policies par société » :
    lecture uniquement par les fonctions administrateur.
  - RLS active, aucune policy, `REVOKE ALL` à `anon` et `authenticated`.
  - Index sur la date.
- **Triggers** de journalisation, listés au point 4.
- **Fonctions** : `admin_statistiques`, `admin_utilisateurs`, `admin_activite`, `admin_conformite`,
  `signaler_erreur`. `REVOKE` à `PUBLIC` et `anon` ; `GRANT` à `authenticated`.
- **Contrôle SQL** `controle_backoffice_admin.sql` (lecture seule) et **vérification sans trace**
  `verif_backoffice_admin.sql`.

## Interface `/admin`

- Onglets :
  - **Vue d'ensemble** : cartes réel / démo ;
  - **Clients** : liste, puis fiche ;
  - **Utilisateurs** ;
  - **Activité** : filtre par catégorie.
- Bascule démo : fenêtre de confirmation avec saisie du nom de la société.
- Nouvelles clés dans le namespace `admin`, dans les 5 langues.

## Tests

- **PGlite** (`supabase/tests/backoffice.check.ts`) :
  - les statistiques séparent réel et démo ;
  - aucune donnée métier ni e-mail de client réel dans aucune fonction ;
  - non-administrateur et `anon` refusés ;
  - journal alimenté par les triggers ;
  - erreurs limitées et purgées ;
  - conformité démo seulement ;
  - tables inaccessibles en direct.
- Toutes les suites existantes ; `tsc`, lint, `i18n:check`, build.

## Hors périmètre (étapes suivantes possibles)

Volumes d'utilisation par client réel (sur décision) ; alertes par e-mail sur les erreurs ;
export du journal ; erreurs côté serveur (server functions).
