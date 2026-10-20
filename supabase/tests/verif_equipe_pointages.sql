-- Vérification FONCTIONNELLE de la migration 20261020090000_equipe_pointages.sql,
-- à exécuter dans l'éditeur SQL Supabase APRÈS l'avoir appliquée.
--
-- AUCUNE MODIFICATION N'EST CONSERVÉE : tout se passe dans un seul bloc qui se termine
-- volontairement par une erreur ; PostgreSQL annule alors tout ce que le bloc a fait (travailleur,
-- chantier et pointages fictifs compris). Le message d'erreur affiche un résultat court :
-- « VERIF 1:OK 2:OK … » (KO = échec).
--
-- Tests, en se faisant passer pour un administrateur ou gérant existant (rôle authenticated) :
--   1. il pointe un travailleur fictif sur un chantier fictif ; durée calculée (8 h) ;
--   2. un chevauchement le même jour est refusé ;
--   3. une modification sans motif est refusée ;
--   4. une correction avec motif est acceptée et tracée (avant / après / motif) ;
--   5. une suppression sans motif est refusée ; avec motif, elle est tracée ;
--   6. l'historique ne peut être ni modifié ni supprimé ;
--   7. il ne voit aucun pointage d'une autre société.
DO $$
DECLARE
  uid uuid;
  soc uuid;
  w uuid;
  c uuid;
  p uuid;
  ok boolean;
  n integer;
  res text := '';
BEGIN
  SELECT pr.id, pr.company_id INTO uid, soc FROM public.profiles pr
  WHERE pr.company_id IS NOT NULL AND pr.role IN ('admin', 'gerant')
  ORDER BY pr.created_at LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Aucun administrateur ou gérant pour tester.';
  END IF;
  INSERT INTO public.personnel (company_id, full_name, status)
  VALUES (soc, 'Travailleur fictif (vérification)', 'actif') RETURNING id INTO w;
  INSERT INTO public.chantiers (company_id, name)
  VALUES (soc, 'Chantier fictif (vérification)') RETURNING id INTO c;

  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    INSERT INTO public.pointages (company_id, personnel_id, chantier_id, date, arrivee, depart, pause_minutes)
    VALUES (soc, w, c, current_date, '07:30', '16:00', 30) RETURNING id INTO p;
    SELECT minutes_travaillees = 480 INTO ok FROM public.pointages WHERE id = p;
  EXCEPTION WHEN others THEN ok := false;
  END;
  res := res || format(' 1:%s', CASE WHEN coalesce(ok, false) THEN 'OK' ELSE 'KO' END);

  BEGIN
    INSERT INTO public.pointages (company_id, personnel_id, chantier_id, date, arrivee, depart)
    VALUES (soc, w, c, current_date, '15:00', '17:00');
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%pointage_chevauchement%';
  END;
  res := res || format(' 2:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    UPDATE public.pointages SET depart = '17:00' WHERE id = p;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%pointage_motif_obligatoire%';
  END;
  res := res || format(' 3:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    PERFORM public.corriger_pointage(p, c, current_date, '07:30', '16:30', 30, NULL, 'Vérification');
    SELECT count(*) INTO n FROM public.pointage_corrections
    WHERE pointage_id = p AND action = 'modification' AND motif = 'Vérification'
      AND avant->>'depart' = '16:00:00' AND apres->>'depart' = '16:30:00' AND par = uid;
    ok := n = 1;
  EXCEPTION WHEN others THEN ok := false;
  END;
  res := res || format(' 4:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    DELETE FROM public.pointages WHERE id = p;
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%pointage_motif_obligatoire%';
  END;
  IF ok THEN
    BEGIN
      PERFORM public.supprimer_pointage(p, 'Vérification');
      SELECT count(*) INTO n FROM public.pointage_corrections
      WHERE pointage_id = p AND action = 'suppression';
      ok := n = 1 AND NOT EXISTS (SELECT 1 FROM public.pointages WHERE id = p);
    EXCEPTION WHEN others THEN ok := false;
    END;
  END IF;
  res := res || format(' 5:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    UPDATE public.pointage_corrections SET motif = 'falsifié' WHERE pointage_id = p;
    GET DIAGNOSTICS n = ROW_COUNT;
    ok := n = 0;
  EXCEPTION WHEN others THEN ok := true;
  END;
  IF ok THEN
    BEGIN
      DELETE FROM public.pointage_corrections WHERE pointage_id = p;
      GET DIAGNOSTICS n = ROW_COUNT;
      ok := n = 0;
    EXCEPTION WHEN others THEN ok := true;
    END;
  END IF;
  res := res || format(' 6:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  SELECT count(*) INTO n FROM public.pointages WHERE company_id <> soc;
  res := res || format(' 7:%s', CASE WHEN n = 0 THEN 'OK' ELSE 'KO' END);

  RAISE EXCEPTION 'VERIF%', res;
END $$;
