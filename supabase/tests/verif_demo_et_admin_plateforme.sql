-- Vérification FONCTIONNELLE des migrations 20261016100000_logos_entreprise.sql et
-- 20261016110000_demo_et_admin_plateforme.sql, à exécuter dans l'éditeur SQL Supabase APRÈS les
-- avoir appliquées.
--
-- AUCUNE MODIFICATION N'EST CONSERVÉE : tout se passe dans un seul bloc qui se termine
-- volontairement par une erreur ; PostgreSQL annule alors tout (y compris le compte fictif).
-- Le message d'erreur affiche un résultat court : « VERIF 1:OK 2:OK … » (KO = échec, NT = non testé).
-- Légende : 1 compte administrateur existant et confirmé · 2 seul administrateur de la plateforme
-- · 3 nouveau compte vide (pas de démo, 0 chantier) · 4 un utilisateur ne peut pas se marquer démo
-- · 5 l'administrateur ne voit aucun chantier de client réel.
DO $$
DECLARE
  u record;
  admins text[] := '{}';
  adm uuid;
  n integer;
  ok boolean;
  r uuid;
  res text := '';
  fictif uuid := gen_random_uuid();
  societe uuid;
BEGIN
  -- 1. Le compte administrateur existe, e-mail confirmé.
  SELECT count(*) INTO n FROM auth.users
  WHERE lower(email) = 'kaillaniyoussef@gmail.com' AND email_confirmed_at IS NOT NULL;
  res := res || format(' 1:%s',
    CASE WHEN n = 1 THEN 'OK' ELSE format('KO(%s)', n) END);

  -- 2. est_admin_plateforme() n'est vraie que pour ce compte (évaluée pour chaque utilisateur).
  FOR u IN SELECT id, email FROM auth.users LOOP
    PERFORM set_config('request.jwt.claim.sub', u.id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u.id)::text, true);
    IF public.est_admin_plateforme() THEN
      admins := admins || u.email;
      adm := u.id;
    END IF;
  END LOOP;
  res := res || format(' 2:%s',
    CASE WHEN admins = ARRAY['kaillaniyoussef@gmail.com'] THEN 'OK'
    ELSE 'KO(' || coalesce(nullif(array_to_string(admins, ','), ''), 'aucun') || ')' END);

  -- 3. Un nouveau compte démarre vide (compte fictif, annulé à la fin).
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (fictif, 'verification-' || fictif || '@example.invalid',
          '{"company_name": "Société fictive de vérification"}');
  SELECT company_id INTO societe FROM public.profiles WHERE id = fictif;
  PERFORM set_config('request.jwt.claim.sub', fictif::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', fictif, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.seed_lock(societe);
  SELECT count(*) INTO n FROM public.chantiers;
  res := res || format(' 3:%s',
    CASE WHEN r IS NULL AND n = 0 THEN 'OK' ELSE format('KO(%s,%s)', r IS NOT NULL, n) END);

  -- 4. Un utilisateur ne peut pas se déclarer « démo ».
  BEGIN
    UPDATE public.companies SET est_demo = true WHERE id = societe;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%est_demo_reserve_admin%';
  END;
  res := res || format(' 4:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);
  EXECUTE 'RESET ROLE';

  -- 5. L'administrateur ne voit aucun chantier d'une société non « démo » autre que la sienne.
  IF adm IS NULL THEN
    res := res || ' 5:NT';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', adm::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', adm, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.chantiers ch
    WHERE ch.company_id <> public.get_user_company_id(adm)
      AND NOT public.est_societe_demo(ch.company_id);
    EXECUTE 'RESET ROLE';
    res := res || format(' 5:%s',
      CASE WHEN n = 0 THEN 'OK' ELSE format('KO(%s)', n) END);
  END IF;

  RAISE EXCEPTION 'VERIF%', res;
END $$;
