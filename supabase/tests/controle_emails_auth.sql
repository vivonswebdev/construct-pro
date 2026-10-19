-- Diagnostic en LECTURE SEULE des e-mails d'authentification (aucune migration associée).
-- À coller dans l'éditeur SQL Supabase. Résultat : UNE ligne, aucune adresse e-mail affichée.
--
--  comptes                 nombre de comptes
--  confirmes_sans_delai    e-mail confirmé moins d'une minute après la création : signe que la
--                          confirmation automatique est active (aucun e-mail de confirmation envoyé)
--  confirmes_avec_delai    confirmation plus tardive : e-mail de confirmation probablement reçu
--  non_confirmes           comptes jamais confirmés
--  sans_langue             comptes sans user_metadata.langue (créés avant cette PR) : les modèles
--                          d'e-mails utiliseront le français par défaut
--  confirmation_auto_probable  vrai si tous les comptes confirmés l'ont été sans délai
SELECT
  count(*) AS comptes,
  count(*) FILTER (WHERE email_confirmed_at IS NOT NULL
                     AND email_confirmed_at - created_at < interval '1 minute') AS confirmes_sans_delai,
  count(*) FILTER (WHERE email_confirmed_at - created_at >= interval '1 minute') AS confirmes_avec_delai,
  count(*) FILTER (WHERE email_confirmed_at IS NULL) AS non_confirmes,
  count(*) FILTER (WHERE coalesce(raw_user_meta_data ->> 'langue', '') = '') AS sans_langue,
  count(*) FILTER (WHERE email_confirmed_at IS NOT NULL) > 0
    AND count(*) FILTER (WHERE email_confirmed_at - created_at >= interval '1 minute') = 0
    AS confirmation_auto_probable
FROM auth.users;
