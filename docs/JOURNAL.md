# Journal — ConstructFlow

Fait, décidé, reste à faire. Entrées les plus récentes en haut.

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
