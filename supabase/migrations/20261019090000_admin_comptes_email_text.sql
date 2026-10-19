-- Correctif : admin_comptes() échouait sur Supabase (« structure of query does not match function
-- result type ») car auth.users.email est en varchar(255) alors que la fonction annonce text[].
-- Conséquence : l'onglet « Clients » de /admin restait vide. Seule la conversion explicite
-- u.email::text change ; règles d'accès identiques (administrateur uniquement, e-mails et nombre de
-- chantiers pour les sociétés démo seulement).
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  id uuid, nom text, cree_le timestamptz, est_demo boolean, demo_seeded boolean,
  nb_utilisateurs integer, emails text[], nb_chantiers integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin_plateforme() THEN
    RAISE EXCEPTION 'acces_reserve_admin_plateforme' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  SELECT c.id, c.name, c.created_at, c.est_demo, c.demo_seeded,
    (SELECT count(*)::integer FROM public.profiles p WHERE p.company_id = c.id),
    CASE WHEN c.est_demo THEN
      (SELECT array_agg(u.email::text ORDER BY u.email) FROM public.profiles p
       JOIN auth.users u ON u.id = p.id WHERE p.company_id = c.id)
    END,
    CASE WHEN c.est_demo THEN
      (SELECT count(*)::integer FROM public.chantiers ch WHERE ch.company_id = c.id)
    END
  FROM public.companies c
  ORDER BY c.created_at DESC;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated;

-- ROLLBACK : rétablir la version de 20261016110000_demo_et_admin_plateforme.sql (sans ::text),
-- c'est-à-dire réexécuter la section « 5. Comptes et bascule » de cette migration.
