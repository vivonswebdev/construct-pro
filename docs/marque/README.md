# Charte ZidarPro (version 1)

« Zidar » signifie « maçon » en roumain et en serbo-croate. Le symbole est un **Z construit en
briques**.

## Fichiers

| Fichier                                                                     | Usage                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `zidarpro-clair.svg`                                                        | Fond blanc : documents, PDF, site                                         |
| `zidarpro-sombre.svg`                                                       | Fond bleu foncé : application, présentations                              |
| `zidarpro-symbole.svg`                                                      | Symbole seul, fond clair (≥ 32 px)                                        |
| `zidarpro-icone.svg`                                                        | Icône simplifiée sur carré bleu : favicon, application mobile (16–512 px) |
| `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-512.png` | Navigateurs                                                               |

- **Source unique** : la géométrie est dans `src/lib/marque.ts`.
- **Régénérer tous les fichiers** : `bun scripts/marque/generer.ts`.
- Le texte des SVG utilise Inter, avec repli sur les polices système. Pour l'impression (enseigne,
  véhicules, vêtements), faire vectoriser le texte par un graphiste.

## Couleurs

| Nom             | Hex       | Usage                             |
| --------------- | --------- | --------------------------------- |
| Bleu ZidarPro   | `#0F2A43` | « Zidar », briques, fonds sombres |
| Orange chantier | `#F59E0B` | « Pro », briques d'accent, filets |
| Blanc           | `#FFFFFF` | Fonds clairs, texte sur fond bleu |

L'orange sur blanc n'est pas assez contrasté pour du texte courant : réserver l'orange aux
accents, aux grands titres et au mot « Pro ».

## Typographie

- **Inter** ExtraBold (800), espacement légèrement resserré.
- Dans les PDF : Helvetica gras, la police intégrée à jsPDF.

## Règles

- **Zone de protection** autour du logo : au moins la hauteur d'une brique.
- **Taille minimale** :
  - logo complet : 24 px de haut à l'écran, 8 mm à l'impression ;
  - en dessous, utiliser l'icône.
- **Interdit** :
  - déformer le logo ;
  - changer les couleurs, ajouter une ombre ;
  - placer le logo clair sur un fond sombre (ou l'inverse).
- **Contrats de sous-traitance : jamais de logo** (ni ZidarPro ni société). Les devis, les factures
  et les rapports affichent le logo de la société, ou à défaut ZidarPro dans les rapports internes.
