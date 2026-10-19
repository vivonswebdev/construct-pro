# Plan — e-mails d'authentification ZidarPro et expéditeur

État au 19/10/2026. Branche `emails-zidarpro`, une PR non fusionnée. **Aucune migration, aucune
action sur la base de production, aucun modèle de contrat touché.**

## Constat

- **Aucun modèle d'e-mail dans le dépôt** et aucune fonction d'envoi. Les e-mails d'authentification
  sont ceux de **Lovable Cloud par défaut** : expéditeur Lovable, textes génériques.
- **Confirmation automatique probable** : le code de connexion indique « Auto-confirm is enabled ».
  Si c'est le cas, aucun e-mail de confirmation n'est envoyé à l'inscription. Conséquence pour la
  sécurité : l'adresse d'un nouveau compte n'est jamais vérifiée.
- **Pas de « Mot de passe oublié »** dans l'application : l'e-mail de réinitialisation n'est jamais
  déclenché.
- **Les autres e-mails ne passent pas par l'application** : le lien de signature des contrats est
  envoyé depuis la messagerie de l'entreprise, et les modèles de contrat ne sont pas concernés.
- **Lovable Cloud** ([documentation « Custom emails »](https://docs.lovable.dev/features/custom-emails)) :
  - **expéditeur personnalisé** : uniquement avec un **domaine vérifié** (plan payant, accès DNS),
    menu **More → Cloud → Emails → Get started**. Adresse par défaut
    `noreply@notify.<domaine>`, ou `@<domaine>` avec l'option « Show as sent from » ;
  - **6 modèles** (confirmation, réinitialisation, invitation, lien magique, changement d'e-mail,
    réauthentification), **générés par Lovable dans le code** (React Email) via **Auth emails →
    Customize auth emails**. Ils se modifient ensuite par le chat ou directement dans les fichiers ;
  - le **nom d'expéditeur** affiché n'est pas documenté : à demander à Lovable (chat ou support).

## Étapes

### A. Cette PR (préparation, sans effet en production)

1. **Guide pas à pas** `docs/emails/README.md` : vérification de l'existant, domaine, modèles, nom
   d'expéditeur, tests, retour arrière.
2. **Textes prêts à l'emploi** `docs/emails/textes-auth.md` : objets et contenus des 6 e-mails dans
   les 5 langues, aux couleurs ZidarPro, variables Supabase conservées.
3. **Langue enregistrée à l'inscription** (`user_metadata.langue`, langue de l'interface au moment
   de l'inscription) : permettra aux modèles d'écrire dans la langue de l'utilisateur.
   - Changement minimal dans `src/routes/login.tsx`.
   - Aucune migration : les métadonnées sont stockées par Supabase Auth.
4. **Diagnostic en lecture seule** `supabase/tests/controle_emails_auth.sql` (une ligne) :
   - confirmation automatique : comptes dont l'e-mail est confirmé dans la minute qui suit la
     création ;
   - comptes sans langue enregistrée ;
   - nombre de comptes.

### B. Configuration par Youssef (Lovable, rien n'est fait sans son accord)

1. **Réserver le domaine** (`zidarpro.be` est libre au 16/10). DNS chez un fournisseur qui accepte
   les enregistrements `NS` de sous-domaine (Cloudflare recommandé ; pas Hostinger ni Wix).
2. **More → Cloud → Emails → Get started** : domaine `zidarpro.be`, sous-domaine `notify`.
   - L'option « Show as sent from @zidarpro.be » donne `noreply@zidarpro.be` ; elle ajoute un
     enregistrement DMARC.
   - Attendre le statut **Verified** (jusqu'à 72 h).
3. **Auth emails → Customize auth emails**, puis dans le chat Lovable : coller les consignes et les
   textes de `docs/emails/textes-auth.md`. Demander le nom d'expéditeur **« ZidarPro »**.
4. **Send test** pour chaque modèle (votre adresse), puis **publier**.
5. Ensuite seulement, **désactiver la confirmation automatique** pour que les nouvelles adresses
   soient vérifiées (décision de Youssef ; à tester avec un compte de test).

### C. PR suivante (après B)

- Relire les fichiers de modèles générés par Lovable (sur `main`), vérifier les variables
  obligatoires, le logo et les couleurs.
- Ajouter **« Mot de passe oublié »** et la page de nouveau mot de passe (5 langues), qui
  déclencheront l'e-mail de réinitialisation ZidarPro.

## Vérifications de cette PR

`tsc`, lint, `i18n:check`, build, tests ; diagnostic SQL testé sur base simulée (PGlite).
