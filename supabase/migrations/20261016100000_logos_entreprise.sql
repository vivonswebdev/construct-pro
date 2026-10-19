-- Logo d'entreprise dans Supabase Storage.
--
--  * Bucket PRIVÉ `logos` : 2 Mo maximum, JPG / PNG / WebP (limites appliquées par Supabase).
--  * Un fichier par logo : `<company_id>/logo-<uuid>.<jpg|png|webp>` ; le chemin du logo courant
--    est dans companies.logo_chemin. Remplacer = nouveau fichier puis suppression de l'ancien.
--  * Cloisonnement : chaque société ne lit et n'écrit que son dossier (get_user_company_id).
--  * companies.logo_url (URL saisie à la main, jamais utilisée dans les documents) est conservée.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

-- ---------------------------------------------------------------------------
-- 1. Colonne du logo courant
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_chemin text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_logo_chemin_chk') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_logo_chemin_chk CHECK (
      logo_chemin IS NULL
      OR logo_chemin ~ ('^' || id::text || '/logo-[0-9a-f-]{36}\.(jpg|png|webp)$')
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Policies sur storage.objects (bucket logos uniquement)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "logos_select" ON storage.objects;
CREATE POLICY "logos_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "logos_insert" ON storage.objects;
CREATE POLICY "logos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND name ~ '^[0-9a-f-]{36}/logo-[0-9a-f-]{36}\.(jpg|png|webp)$'
  );

DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND name ~ '^[0-9a-f-]{36}/logo-[0-9a-f-]{36}\.(jpg|png|webp)$'
  );

DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

-- ROLLBACK :
-- DROP POLICY IF EXISTS "logos_select" ON storage.objects;
-- DROP POLICY IF EXISTS "logos_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "logos_update" ON storage.objects;
-- DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
-- -- Le bucket ne peut être supprimé que vide (vider le dossier logos depuis le tableau de bord) :
-- DELETE FROM storage.buckets WHERE id = 'logos';
-- ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_logo_chemin_chk;
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS logo_chemin;
