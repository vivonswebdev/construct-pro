-- Phase 9, PR C — Stockage privé des documents ; capture de la vérification 30bis.
--
--  * Bucket PRIVÉ `documents` (premier bucket du projet) : 5 Mo maximum, JPG / PNG / PDF.
--  * Chemins obligatoirement préfixés par la société : `<company_id>/…` (cloisonnement).
--  * Captures 30bis : `<company_id>/30bis/<uuid>.<ext>`, référencées par
--    verifications_30bis.preuve_fichier. Une capture liée à une vérification ne peut être ni
--    remplacée ni supprimée (preuve) ; un fichier orphelin (vérification non enregistrée) peut
--    être supprimé par la société.
--  * Les autres dossiers de la société (documents de conformité, PR D) : lecture, ajout,
--    remplacement, suppression.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Policies sur storage.objects (bucket documents uniquement)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
CREATE POLICY "documents_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
CREATE POLICY "documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

-- Remplacement : jamais dans le dossier 30bis (preuves).
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND coalesce((storage.foldername(name))[2], '') <> '30bis'
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND coalesce((storage.foldername(name))[2], '') <> '30bis'
  );

-- Suppression : dossier 30bis seulement si le fichier n'est lié à aucune vérification.
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND (
      coalesce((storage.foldername(name))[2], '') <> '30bis'
      OR NOT EXISTS (
        SELECT 1 FROM public.verifications_30bis v WHERE v.preuve_fichier = storage.objects.name
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. La capture d'une vérification est dans le dossier 30bis de SA société
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_30bis_preuve_chk') THEN
    ALTER TABLE public.verifications_30bis ADD CONSTRAINT verifications_30bis_preuve_chk CHECK (
      preuve_fichier IS NULL
      OR preuve_fichier ~ ('^' || company_id::text || '/30bis/[0-9a-f-]{36}\.(jpg|png|pdf)$')
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Vérification immuable même face aux droits par défaut de Supabase
--    (ALL accordé à anon / authenticated sur les nouvelles tables) : la vérification et le lien
--    vers sa capture ne peuvent être ni modifiés ni supprimés, et anon n'y a aucun accès.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.verifications_30bis FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.verifications_30bis FROM authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- -- (Les REVOKE de la section 4 ne sont pas à annuler : la phase 9 n'accordait que SELECT, INSERT.)
-- ALTER TABLE public.verifications_30bis DROP CONSTRAINT IF EXISTS verifications_30bis_preuve_chk;
-- DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "documents_update" ON storage.objects;
-- DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "documents_select" ON storage.objects;
-- -- Le bucket ne peut être supprimé que vide (les captures sont des preuves : les exporter avant).
-- -- DELETE FROM storage.buckets WHERE id = 'documents';
