# Dossier de relecture native NL / RO / PL

- **Fichier** : `relecture-nl-ro-pl.xlsx` (onglets « Mode d'emploi », « Relecture », « Synthèse »).
- **Ordre** : priorité 1 (mentions légales des PDF : autoliquidation, TVA 6 %, conditions, piste
  d'audit de la signature), priorité 2 (page de signature et message au sous-traitant), priorité 3
  (écrans : connexion, tableau de bord, sous-traitants, chantiers, contrats, prestations,
  conformité, exports).
- **Régénérer** après une évolution des traductions (Python 3 + openpyxl) :
  `python scripts/relecture/exporter_relecture.py`
- **Retour du relecteur** : ne pas modifier la colonne « Clé technique » ; les lignes en
  « Correction proposée » avec une « Traduction corrigée » seront réintégrées automatiquement dans
  `src/locales/<langue>/*.json` (script de réintégration à écrire au retour du premier fichier).
