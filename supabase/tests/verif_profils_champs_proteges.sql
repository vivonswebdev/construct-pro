-- Vérification FONCTIONNELLE de la migration 20261016090000_profils_champs_proteges.sql,
-- à exécuter dans l'éditeur SQL Supabase APRÈS l'avoir appliquée.
--
-- AUCUNE MODIFICATION N'EST CONSERVÉE : tout se passe dans un seul bloc qui se termine
-- volontairement par une erreur ; PostgreSQL annule alors tout ce que le bloc a fait (y compris
-- le compte fictif). Le message d'erreur affiche un résultat court :
-- « VERIF 1:OK 2:OK … » (KO = échec, NT = non testé).
--
-- Tests, en se faisant passer pour un utilisateur existant (rôle authenticated, comme l'API) :
--   1. il ne peut pas changer son company_id ;
--   2. il ne peut pas changer son rôle ;
--   3. il peut toujours changer son nom, son avatar et sa langue ;
--   4. la création d'un compte crée toujours sa société et son profil (compte fictif).
DO $$
DECLARE
  uid uuid;
  autre uuid;
  ok boolean;
  n integer;
  res text := '';
  fictif uuid := gen_random_uuid();
BEGIN
  SELECT p.id INTO uid FROM public.profiles p WHERE p.company_id IS NOT NULL
  ORDER BY p.created_at LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Aucun profil pour tester.';
  END IF;
  SELECT c.id INTO autre FROM public.companies c
  WHERE c.id <> (SELECT company_id FROM public.profiles WHERE id = uid) LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    UPDATE public.profiles SET company_id = coalesce(autre, gen_random_uuid()) WHERE id = uid;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%profil_champ_protege%';
  END;
  res := res || format(' 1:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    UPDATE public.profiles SET role = CASE WHEN role = 'admin' THEN 'gerant' ELSE 'admin' END
    WHERE id = uid;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%profil_champ_protege%';
  END;
  res := res || format(' 2:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    UPDATE public.profiles
      SET full_name = coalesce(full_name, '') || ' (test)', avatar_url = avatar_url,
          langue = CASE WHEN langue = 'fr' THEN 'nl' ELSE 'fr' END
    WHERE id = uid;
    GET DIAGNOSTICS n = ROW_COUNT;
    ok := n = 1;
  EXCEPTION WHEN others THEN ok := false;
  END;
  res := res || format(' 3:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  EXECUTE 'RESET ROLE';
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (fictif, 'verification-' || fictif || '@example.invalid',
          '{"company_name": "Société fictive de vérification"}');
  SELECT count(*) INTO n FROM public.profiles p JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = fictif AND p.role = 'admin' AND c.name = 'Société fictive de vérification';
  res := res || format(' 4:%s', CASE WHEN n = 1 THEN 'OK' ELSE 'KO' END);

  RAISE EXCEPTION 'VERIF%', res;
END $$;
