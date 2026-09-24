# ConstructFlow — consignes pour Claude Code

SaaS de gestion pour PME belges de la construction. Spécification complète et plan par phases :
[PASSATION.md](PASSATION.md). Journal des décisions et de l'avancement : [docs/JOURNAL.md](docs/JOURNAL.md).
Langue de travail : **français**.

## Commandes

- `bun install` — dépendances
- `bun run dev` — serveur de dev (port 5173)
- `bun run build` — build (Vite + Nitro, cible Cloudflare)
- `bun run lint` — ESLint + Prettier (doit passer sans erreur)
- `bunx tsc --noEmit` — vérification des types (le build ne type-check pas)
- `bunx prettier --write src` — formatage

## Méthode

- Une phase de PASSATION.md = une branche `phase-XX-nom`. Plan court en début de phase ; question
  à Youssef si un choix structurant n'est pas tranché. Pas de phase suivante avant les CA.
- Après chaque phase : `bun run build`, `bun run lint`, `bunx tsc --noEmit` OK ; JOURNAL.md à jour.
- En cas de doute métier : poser la question plutôt qu'inventer.

## Base de données (Supabase)

- Tout changement de schéma = **nouvelle** migration dans `supabase/migrations/`
  (`AAAAMMJJHHMMSS_description.sql`). Ne jamais modifier une migration existante.
- Chaque table : `company_id` (FK `companies`, `ON DELETE CASCADE`), RLS activée, 4 policies
  select/insert/update/delete sur `company_id = public.get_user_company_id(auth.uid())`, index sur
  `company_id` et les clés étrangères.
- Ressources publiques : policies `anon` strictement limitées ou RPC `security definer`.
- Tenir `src/integrations/supabase/types.ts` à jour après chaque migration (régénération Supabase,
  ou à la main au même format). **Pas de `as any`** : utiliser `Tables<"x">`, `TablesInsert<"x">`,
  `TablesUpdate<"x">`.
- Les migrations sont appliquées par Youssef (Lovable / tableau de bord Supabase) : les signaler
  clairement dans le résumé de PR.

## Conventions de code

- Tables et colonnes en français snake_case ; code TypeScript en camelCase.
- Énumérations : codes neutres en base (`en_cours`, `accepte`), libellés via i18n (phase 1).
- Formats belges : montants via `formatEURBE` (`245 000,00 €`), dates JJ/MM/AAAA, TVA `BE0123 456 789`.
- Validation zod sur toutes les entrées serveur et formulaires.
- Erreurs dans les `catch` : `errorMessage(err)` (`src/lib/utils.ts`), jamais `err.message` sur `unknown`.
- Aucune chaîne visible en dur une fois l'i18n en place (phase 1).
- Pages utilisables sur tablette ; `/m` pensé pour téléphone.

## Règles fiscales et sociales belges

- Jamais de taux légal en dur dans un composant : paramètres en base (`company_settings`, tables de
  paramètres datées), affichés avec « indicatif — à valider par votre comptable / secrétariat social ».
- L'application suit des échéances ; elle ne remplace ni la paie (secrétariat social) ni le conseil
  juridique (CG = modèles à faire valider).

## Serveur, secrets, IA

- Aucune clé secrète côté front : seules les clés publiques Supabase (`VITE_*`) sont dans `.env`.
- IA, emails, webhooks : server functions (`createServerFn` + `requireSupabaseAuth`) ou routes serveur.
- IA uniquement via `src/lib/ai.server.ts` (`chat()`) ; fournisseur par `AI_PROVIDER`
  (`lovable` par défaut, ou `anthropic`) et `AI_MODEL`.
- L'IA n'écrit jamais en base : elle produit un brouillon que l'utilisateur confirme.

## Fichiers

- Supabase Storage, un bucket par usage (`logos`, `sites`, `chantiers`, `documents`, `achats`),
  chemins préfixés par `company_id`.

## Git (poste Windows)

- Fins de ligne LF : `core.autocrlf false`, `core.eol lf` dans ce dépôt (sinon Prettier échoue).
