-- Vérification FONCTIONNELLE de la migration 20261020120000_documents_rh.sql,
-- à exécuter dans l'éditeur SQL Supabase APRÈS l'avoir appliquée.
--
-- AUCUNE MODIFICATION N'EST CONSERVÉE : tout se passe dans un seul bloc qui se termine
-- volontairement par une erreur ; PostgreSQL annule alors tout ce que le bloc a fait
-- (travailleur fictif, document fictif, ligne de fichier fictive, journal). Aucun vrai fichier
-- n'est téléversé ni lu. Le message d'erreur affiche un résultat court : « VERIF 1:OK … ».
--
-- Tests, en se faisant passer pour un administrateur ou gérant existant (rôle authenticated) :
--   1. une carte d'identité sans consentement est refusée ;
--   2. dépôt préparé, fichier enregistré, dépôt confirmé et journalisé ;
--   3. le fichier n'est pas lisible directement ;
--   4. après ouverture (ticket), il est lisible pendant 60 s ; consultation journalisée ;
--   5. suppression : refusée sans motif ; avec motif, tracée et journalisée ;
--   6. aucun document d'une autre société n'est visible ;
--   7. aucune écriture directe dans documents_rh.
DO $$
DECLARE
  uid uuid;
  soc uuid;
  w uuid;
  d record;
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

  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    PERFORM * FROM public.preparer_depot_rh('carte_identite', 'jpg', NULL, w, NULL, NULL, NULL,
                                            false, NULL, NULL);
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%rh_consentement_obligatoire%';
  END;
  res := res || format(' 1:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    SELECT * INTO d FROM public.preparer_depot_rh('carte_identite', 'jpg', NULL, w, NULL, NULL,
                                                  NULL, true, 'Vérification', NULL);
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('rh', d.fichier, '{"size": 1000}'::jsonb);
    PERFORM public.confirmer_depot_rh(d.id);
    SELECT count(*) INTO n FROM public.journal_acces_rh
    WHERE document_id = d.id AND action = 'depot' AND par = uid;
    ok := n = 1 AND EXISTS (SELECT 1 FROM public.documents_rh x WHERE x.id = d.id AND x.statut = 'actif');
  EXCEPTION WHEN others THEN ok := false;
  END;
  res := res || format(' 2:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'rh' AND name = d.fichier;
  res := res || format(' 3:%s', CASE WHEN n = 0 THEN 'OK' ELSE 'KO' END);

  BEGIN
    PERFORM public.ouvrir_document_rh(d.id);
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'rh' AND name = d.fichier;
    ok := n = 1 AND EXISTS (SELECT 1 FROM public.journal_acces_rh j
                            WHERE j.document_id = d.id AND j.action = 'consultation');
  EXCEPTION WHEN others THEN ok := false;
  END;
  res := res || format(' 4:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  BEGIN
    PERFORM public.supprimer_document_rh(d.id, '  ');
    ok := false;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%rh_motif_obligatoire%';
  END;
  IF ok THEN
    BEGIN
      PERFORM public.supprimer_document_rh(d.id, 'Vérification');
      ok := EXISTS (SELECT 1 FROM public.documents_rh x WHERE x.id = d.id AND x.statut = 'supprime')
        AND EXISTS (SELECT 1 FROM public.journal_acces_rh j
                    WHERE j.document_id = d.id AND j.action = 'suppression');
    EXCEPTION WHEN others THEN ok := false;
    END;
  END IF;
  res := res || format(' 5:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  SELECT count(*) INTO n FROM public.documents_rh WHERE company_id <> soc;
  res := res || format(' 6:%s', CASE WHEN n = 0 THEN 'OK' ELSE 'KO' END);

  BEGIN
    INSERT INTO public.documents_rh (company_id, type, personnel_id, fichier, statut)
    VALUES (soc, 'autre_contractuel', w, soc::text || '/' || gen_random_uuid() || '.pdf', 'actif');
    ok := false;
  EXCEPTION WHEN others THEN ok := true;
  END;
  res := res || format(' 7:%s', CASE WHEN ok THEN 'OK' ELSE 'KO' END);

  RAISE EXCEPTION 'VERIF%', res;
END $$;
