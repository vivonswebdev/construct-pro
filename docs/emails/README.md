# E-mails d'authentification ZidarPro — guide

État au 19/10/2026. Les e-mails d'authentification (confirmation, mot de passe…) sont envoyés par
**Lovable Cloud**. Ils ne passent par aucun code de l'application tant que les modèles n'ont pas été
générés. Source : [Lovable — Custom emails](https://docs.lovable.dev/features/custom-emails).

Hors périmètre : les **contrats** (modèles inchangés). Le lien de signature est envoyé depuis la
messagerie de l'entreprise, pas par ZidarPro.

## 1. Vérifier l'existant (lecture seule)

1. **Diagnostic SQL** : coller `supabase/tests/controle_emails_auth.sql` dans l'éditeur SQL (une
   ligne, aucune adresse affichée).
   - `confirmation_auto_probable = true` : aucun e-mail de confirmation n'est envoyé à l'inscription.
   - `sans_langue` : comptes créés avant l'enregistrement de la langue (français par défaut).
2. **Lovable → More → Cloud → Emails** :
   - un domaine est-il configuré ?
   - quelle adresse **From** s'affiche sur les modèles ?
   - l'onglet **Auth emails** propose-t-il « Customize auth emails » ? Si oui, aucun modèle
     personnalisé n'existe.
3. **Test réel avec votre propre adresse** :
   - ouvrir un modèle dans **Auth emails** et cliquer **Send test** ;
   - noter l'expéditeur, l'objet et le contenu (nom « ZidarPro » ou non).

## 2. Domaine d'envoi (prérequis du nom d'expéditeur)

- Plan Lovable **payant**, domaine possédé, accès DNS, rôle admin ou owner de l'espace de travail.
- **Réserver `zidarpro.be`** (disponible au 16/10/2026), de préférence avec un DNS **Cloudflare**.
  Hostinger et Wix ne gèrent pas les enregistrements `NS` de sous-domaine exigés.
- **More → Cloud → Emails → Get started** :
  - domaine `zidarpro.be`, sous-domaine `notify` → `noreply@notify.zidarpro.be` ;
  - option **Show as sent from @zidarpro.be** → `noreply@zidarpro.be` (ajoute un
    enregistrement `_dmarc`) ;
  - DNS automatique (Entri) ou manuel : enregistrement `TXT` de vérification et `NS` du
    sous-domaine, **dans la zone**. Ne jamais changer les serveurs de noms du domaine.
  - Attendre **Verified** (quelques heures, jusqu'à 72 h). SPF, DKIM et DMARC sont gérés par
    Lovable.

## 3. Modèles aux couleurs ZidarPro

1. **Auth emails → Customize auth emails** : Lovable génère les 6 modèles dans le code (React
   Email), sur `main`.
2. Dans le chat Lovable, coller la **consigne** de `textes-auth.md` (section « Consigne pour
   Lovable »), puis les textes. Points clés :
   - nom d'expéditeur **ZidarPro** ;
   - objets commençant par « ZidarPro — » ;
   - couleurs `#0F2A43` (bleu) et `#F59E0B` (orange) ; fond extérieur **blanc obligatoire** ;
   - en-tête : icône `https://<votre-app>/apple-touch-icon.png` (36 px) suivie du texte
     « Zidar » en bleu et « Pro » en orange (police Inter, Arial en repli) ;
   - **langue** : `user_metadata.langue` (fr, nl, en, ro, pl), français par défaut ;
   - **conserver toutes les variables et liens de rappel** fournis par Lovable.
3. **Send test** pour chacun des 6 modèles, puis **publier** l'application (TanStack Start).
4. Me signaler la fusion : je relirai les fichiers générés (variables, liens, couleurs, langues).

## 4. Après la mise en place

- **Confirmation des adresses** : une fois les e-mails ZidarPro vérifiés, désactiver la
  confirmation automatique. Les nouveaux comptes devront alors confirmer leur adresse, ce qui
  renforce la sécurité. Tester d'abord avec une adresse de test.
- **Mot de passe oublié** : à ajouter dans l'application (PR suivante). C'est lui qui déclenchera
  l'e-mail de réinitialisation.
- **Volume** : 50 000 e-mails par mois inclus par espace de travail. Limites horaires selon le plan
  (Pro : 500 e-mails d'authentification par heure).

## 5. Retour arrière

**More → Cloud → Emails → Disable emails** : les e-mails repartent de l'expéditeur Lovable par
défaut. Les fichiers de modèles restent dans le dépôt et peuvent être supprimés par une PR.
