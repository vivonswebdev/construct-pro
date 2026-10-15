-- Contrôle en LECTURE SEULE de la migration 20261014120000_storage_documents_30bis.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
SELECT 'bucket documents privé' AS objet,
  coalesce((SELECT NOT public FROM storage.buckets WHERE id = 'documents'), false) AS ok
UNION ALL
SELECT 'limite 5 Mo',
  coalesce((SELECT file_size_limit = 5242880 FROM storage.buckets WHERE id = 'documents'), false)
UNION ALL
SELECT 'formats JPG / PNG / PDF',
  coalesce((SELECT allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'application/pdf']
                   AND cardinality(allowed_mime_types) = 3
            FROM storage.buckets WHERE id = 'documents'), false)
UNION ALL
SELECT '4 policies du bucket documents',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('documents_select', 'documents_insert', 'documents_update', 'documents_delete')) = 4
UNION ALL
SELECT 'chemin de capture contrôlé', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_30bis_preuve_chk')
UNION ALL
SELECT 'vérifications non modifiables (droits)',
  NOT has_table_privilege('authenticated', 'public.verifications_30bis', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.verifications_30bis', 'DELETE')
UNION ALL
SELECT 'vérifications inaccessibles à anon',
  NOT has_table_privilege('anon', 'public.verifications_30bis', 'SELECT');
