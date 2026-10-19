-- Contrôle en LECTURE SEULE de la migration 20261016090000_profils_champs_proteges.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée.
-- Résultat : UNE ligne (l'éditeur Supabase n'affiche que la dernière requête) ; attendu ko = 0.
-- En cas d'échec, « en_echec » nomme les contrôles concernés.
WITH controles (objet, ok) AS (
SELECT 'trigger de protection présent et actif' AS objet,
  EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_profils_champs_proteges'
            AND tgrelid = 'public.profiles'::regclass AND tgenabled <> 'D') AS ok
UNION ALL
SELECT 'fonction proteger_profil() non exécutable par anon / authenticated',
  NOT has_function_privilege('anon', 'public.proteger_profil()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.proteger_profil()', 'EXECUTE')
UNION ALL
SELECT 'création de compte (handle_new_user) toujours en place',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created')
)
SELECT count(*) FILTER (WHERE ok AND objet NOT LIKE '(information)%') AS ok,
  count(*) FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS ko,
  string_agg(objet, ' | ') FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS en_echec,
  string_agg(objet || ' = ' || ok, ' | ') FILTER (WHERE objet LIKE '(information)%') AS informations
FROM controles;

-- Facultatif — indices d'une exploitation passée de la faille (à examiner, pas forcément anormal) :
-- utilisateurs rattachés à une société créée AVANT leur compte (la création de compte crée la
-- société au même moment). Une ligne n'est pas une preuve ; elle mérite un coup d'œil.
-- SELECT u.email, p.role, c.name AS societe, c.created_at AS societe_creee, u.created_at AS compte_cree
-- FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id
-- JOIN public.companies c ON c.id = p.company_id
-- WHERE c.created_at < u.created_at - interval '1 minute'
-- ORDER BY u.created_at;
