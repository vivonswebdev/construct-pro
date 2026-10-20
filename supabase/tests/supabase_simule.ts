// Environnement Supabase minimal pour les tests PGlite : rôles, schéma auth (auth.uid() lu
// dans request.jwt.claim.sub), droits par défaut de Supabase (tables et fonctions), et
// schéma storage (buckets, objects, foldername) avec RLS, comme sur Supabase.

import type { PGlite } from "@electric-sql/pglite";

export const SQL_SUPABASE_SIMULE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY, email varchar(255), raw_user_meta_data jsonb, -- varchar comme Supabase
    email_confirmed_at timestamptz, created_at timestamptz DEFAULT now(),
    last_sign_in_at timestamptz
  );
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
  GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets (id),
    name text NOT NULL, owner uuid, created_at timestamptz DEFAULT now(), metadata jsonb,
    UNIQUE (bucket_id, name)
  );
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE _parts text[];
  BEGIN
    _parts := string_to_array(name, '/');
    RETURN _parts[1:array_length(_parts, 1) - 1];
  END $$;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO authenticated, anon;
  GRANT ALL ON storage.objects TO authenticated, anon;
  GRANT SELECT ON storage.buckets TO authenticated, anon;
`;

export async function initSupabaseSimule(db: PGlite) {
  await db.exec(SQL_SUPABASE_SIMULE);
}
