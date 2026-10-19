-- Vérification FONCTIONNELLE de la migration 20261017090000_backoffice_admin.sql, à exécuter dans
-- l'éditeur SQL Supabase APRÈS l'avoir appliquée.
--
-- AUCUNE MODIFICATION N'EST CONSERVÉE : le bloc se termine volontairement par une erreur qui annule
-- tout (compte fictif, erreur fictive, entrées de journal). Le message d'erreur affiche un résultat
-- court : « VERIF 1:OK 2:OK … » (KO = échec, NT = non testé).
-- Légende : 1 création de société journalisée · 2 non-administrateur refusé · 3 signalement
-- d'erreur enregistré · 4 statistiques (7 indicateurs) · 5 aucun e-mail ni nom de client réel
-- (utilisateurs) · 6 aucun e-mail ni message de client réel (activité).
DO $$
DECLARE
  adm uuid;
  autre uuid;
  n integer;
  ok boolean;
  res text := '';
  fictif uuid := gen_random_uuid();
BEGIN
  SELECT id INTO adm FROM auth.users
  WHERE lower(email) = 'kaillaniyoussef@gmail.com' AND email_confirmed_at IS NOT NULL;
  SELECT p.id INTO autre FROM public.profiles p WHERE p.id <> coalesce(adm, gen_random_uuid()) LIMIT 1;

  -- 1. Création d'un compte fictif : journalisée.
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (fictif, 'verification-' || fictif || '@example.invalid', '{"company_name": "Société fictive de vérification"}');
  SELECT count(*) INTO n FROM public.journal_plateforme j
  JOIN public.profiles p ON p.company_id = j.company_id
  WHERE p.id = fictif AND j.type = 'societe_creee';
  res := res || format(' 1:%s', CASE WHEN n = 1 THEN 'OK' ELSE 'KO' END);

  -- 2. Un utilisateur non administrateur est refusé.
  IF autre IS NULL THEN
    res := res || ' 2:NT';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', autre::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', autre, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      PERFORM * FROM public.admin_statistiques();
      ok := false;
    EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%acces_reserve_admin_plateforme%';
    END;
    -- 3. Signalement d'une erreur par cet utilisateur.
    PERFORM public.signaler_erreur('VerificationTest', 'message fictif', '/verification', 'script');
    EXECUTE 'RESET ROLE';
    res := res || format(' 2:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);
    SELECT count(*) INTO n FROM public.erreurs_application WHERE code = 'VerificationTest';
    res := res || format(' 3:%s', CASE WHEN n = 1 THEN 'OK' ELSE 'KO' END);
  END IF;

  -- 4 à 6. L'administrateur : statistiques, utilisateurs, activité sans donnée de client réel.
  IF adm IS NULL THEN
    res := res || ' 4:NT 5:NT 6:NT';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', adm::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.admin_statistiques();
    res := res || format(' 4:%s', CASE WHEN n = 7 THEN 'OK' ELSE format('KO(%s)', n) END);
    SELECT count(*) INTO n FROM public.admin_utilisateurs() u
    WHERE NOT u.est_demo AND (u.email IS NOT NULL OR u.nom IS NOT NULL);
    res := res || format(' 5:%s', CASE WHEN n = 0 THEN 'OK' ELSE format('KO(%s)', n) END);
    SELECT count(*) INTO n FROM public.admin_activite(NULL, 1000) a
    WHERE NOT a.est_demo AND (a.email IS NOT NULL OR (a.details IS NOT NULL AND a.details ? 'message'));
    res := res || format(' 6:%s', CASE WHEN n = 0 THEN 'OK' ELSE format('KO(%s)', n) END);
    EXECUTE 'RESET ROLE';
  END IF;

  RAISE EXCEPTION 'VERIF%', res;
END $$;
