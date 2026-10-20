-- Contrôle en LECTURE SEULE de la migration 20261020120000_documents_rh.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée.
-- Résultat : UNE ligne (l'éditeur Supabase n'affiche que la dernière requête) ; attendu ko = 0.
-- En cas d'échec, « en_echec » nomme les contrôles concernés.
WITH controles (objet, ok) AS (
SELECT 'bucket rh privé, 5 Mo, JPG / PNG / PDF' AS objet,
  EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'rh' AND NOT b.public
          AND b.file_size_limit = 5242880
          AND b.allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'application/pdf']
          AND cardinality(b.allowed_mime_types) = 3) AS ok
UNION ALL
SELECT 'stockage rh : policies insert, select, delete ; aucune policy update',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname IN ('rh_insert', 'rh_select', 'rh_delete')) = 3
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                  AND cmd = 'UPDATE' AND qual LIKE '%''rh''%')
UNION ALL
SELECT 'lecture rh uniquement sur ticket',
  (SELECT qual FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'rh_select')
    LIKE '%ticket_fichier_rh_valide%'
UNION ALL
SELECT 'tables documents_rh, journal_acces_rh, tickets_fichiers_rh avec RLS',
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('documents_rh', 'journal_acces_rh', 'tickets_fichiers_rh')) = 3
UNION ALL
SELECT 'aucune écriture directe par l''API (documents, journal, tickets)',
  NOT has_table_privilege('authenticated', 'public.documents_rh', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.documents_rh', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.documents_rh', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.journal_acces_rh', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.journal_acces_rh', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.tickets_fichiers_rh', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.tickets_fichiers_rh', 'INSERT')
UNION ALL
SELECT 'anon : aucun droit',
  NOT has_table_privilege('anon', 'public.documents_rh', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.journal_acces_rh', 'SELECT')
  AND NOT has_function_privilege('anon', 'public.ouvrir_document_rh(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.supprimer_document_rh(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.preparer_depot_rh(text, text, text, uuid, uuid, uuid, uuid, boolean, text, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.ticket_fichier_rh_valide(text, text)', 'EXECUTE')
UNION ALL
SELECT 'fonctions internes non exécutables par l''API',
  NOT has_function_privilege('authenticated', 'public.rh_exiger_gestionnaire(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rh_echeance_carte(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rh_journaliser(public.documents_rh, text, jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.personnel_echeance_rh()', 'EXECUTE')
UNION ALL
SELECT 'métadonnées : lecture gestionnaires + policy démo',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
     AND tablename IN ('documents_rh', 'journal_acces_rh')
     AND policyname IN ('documents_rh_select', 'journal_acces_rh_select', 'admin_plateforme_demo_select')) = 4
UNION ALL
SELECT 'consentement obligatoire et une seule carte active par travailleur',
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_rh_consentement_chk')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_rh_carte_active')
UNION ALL
SELECT 'échéance recalculée à la date de sortie (trigger actif)',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_personnel_echeance_rh' AND tgenabled <> 'D')
UNION ALL
SELECT 'clés composites (rattachements de la même société)',
  (SELECT count(*) FROM pg_constraint WHERE conname IN (
     'documents_rh_personnel_fk', 'documents_rh_sous_traitant_fk', 'documents_rh_chantier_fk',
     'documents_rh_client_fk', 'clients_id_company_uniq')) = 5
)
SELECT count(*) FILTER (WHERE ok) AS ok,
  count(*) FILTER (WHERE NOT ok) AS ko,
  string_agg(objet, ' | ') FILTER (WHERE NOT ok) AS en_echec,
  (SELECT count(*) FROM public.documents_rh WHERE statut <> 'supprime') || ' document(s), '
    || (SELECT count(*) FROM storage.objects WHERE bucket_id = 'rh') || ' fichier(s) rh' AS informations
FROM controles;
