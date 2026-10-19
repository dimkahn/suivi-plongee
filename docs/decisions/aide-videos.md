# Aide et vidéos : décisions

## Vidéos et manuels au format téléphone et au format ordinateur

- **Date :** 2026-10-19. Choix du club.
- **Contexte :** chaque vidéo n'existait qu'en un format (téléphone, ou ordinateur pour l'administration) ; quelqu'un sur ordinateur voyait la version téléphone et inversement, et les manuels mêlaient les deux (« « Plus » en bas de l'écran (sur ordinateur : le menu en haut) »).
- **Décision :**
  - Chaque scénario est tourné **aux deux formats** (`formats` du scénario pour s'en tenir à un seul) : `<scénario>.telephone.*` et `<scénario>.ordinateur.*`. `enregistrer.mjs` tourne un format par passage (`FORMAT=`), `tourner.sh` les enchaîne en **redémarrant le backend** entre les deux (les scénarios écrivent dans la base et ne se rejouent pas). Les scénarios reçoivent `format` et `selon({ telephone, ordinateur })` pour les phrases et gestes propres à chacun.
  - `catalogue.json` : `formats.telephone` / `formats.ordinateur` (null si pas encore tourné) ; les champs à plat restent, pour l'appli d'avant encore en ligne pendant une publication. Les anciens fichiers `<scénario>.webm` comptent pour le format du scénario jusqu'à son retournage.
  - `surveiller-scenarios.sh` retourne aussi un scénario à qui il manque un format (une fois) ; réussi seulement si tous ses formats le sont.
  - Appli : **l'utilisateur choisit** « Aide pour : Téléphone | Ordinateur » (`core/choix-format-aide.component.ts`), dans la page Aide, « Comment faire ? » et la page Vidéos ; par défaut le format de l'appareil (860 px, comme la barre d'onglets) ; choix gardé dans IndexedDB (`FormatAideService`, pas de localStorage). Format pas encore tourné : l'autre, signalé.
  - Manuels : passages propres à un format entre `::: telephone` / `::: ordinateur` et `:::` (`blocsDuFormat`) ; une étape numérotée y garde son numéro.
- **Conséquences :** tournage deux fois plus long (environ une heure) et deux fois plus de fichiers publiés. Les gestes ont été écrits pour un seul format : le premier tournage complet dira ceux qui échouent dans l'autre (`<scénario>.<format>-ECHEC.png`).
