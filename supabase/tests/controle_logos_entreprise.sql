-- Contrôle en LECTURE SEULE de la migration 20261016100000_logos_entreprise.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
SELECT 'colonne companies.logo_chemin' AS objet,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'companies'
            AND column_name = 'logo_chemin') AS ok
UNION ALL
SELECT 'contrainte de format du chemin du logo',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_logo_chemin_chk')
UNION ALL
SELECT 'bucket logos privé, 2 Mo, JPG / PNG / WebP',
  EXISTS (SELECT 1 FROM storage.buckets
          WHERE id = 'logos' AND public = false AND file_size_limit = 2097152
            AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']
            AND cardinality(allowed_mime_types) = 3)
UNION ALL
SELECT '4 policies logos (lecture, ajout, remplacement, suppression)',
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('logos_select', 'logos_insert', 'logos_update', 'logos_delete')) = 4
UNION ALL
SELECT 'aucune policy logos pour anon',
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'storage' AND tablename = 'objects'
                AND policyname LIKE 'logos_%' AND 'anon' = ANY (roles))
UNION ALL
SELECT 'logos existants dans le dossier de leur société',
  NOT EXISTS (SELECT 1 FROM public.companies
              WHERE logo_chemin IS NOT NULL AND split_part(logo_chemin, '/', 1) <> id::text);
