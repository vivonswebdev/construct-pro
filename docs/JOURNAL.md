# Journal — ConstructFlow

Fait, décidé, reste à faire. Entrées les plus récentes en haut.

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
