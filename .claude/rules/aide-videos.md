---
paths:
  - "frontend/src/app/features/aide/**"
  - "frontend/src/app/features/videos/**"
  - "outils/videos/**"
---

# Aide, manuels et vidéos

- **Page `/aide`** (`AideComponent`, `gardeConnecte`) : chacun n'y voit que les manuels de ses droits (`features/aide/droits.ts` : public de la rubrique, ou `pour:` dans l'en-tête ; même filtre pour « Comment faire ? » et `/videos`). Seule l'aide des écrans ouverts sans compte (`pour: sans-compte` : connexion, séjour par lien) se lit sans connexion, par « Comment faire ? » ; questions fréquentes renvoyant chacune au manuel d'une fonctionnalité et à ses vidéos. Un manuel = un Markdown de `features/aide/manuels/` (en-tête : titre, rubrique, codes des vidéos, écran, mots-clés, questions ; format dans le `LISEZ-MOI.md` du dossier), listé dans `manuels/index.ts`, embarqué dans l'appli (loader `.md` en texte, `angular.json`) : recherche dans le navigateur, sans serveur ; seules les vidéos viennent du catalogue publié.
- **Vidéos** : `outils/videos/tourner.sh` (Playwright, données de démo, backend `dev` neuf ; voix off des sous-titres par Piper, montage `monter.mjs` + ffmpeg) puis `outils/videos/publier.sh`. Page `/videos` (`VideosComponent`, connexion requise, filtrée comme `/aide`). Les fichiers sous `/medias/videos/` restent servis sans contrôle par Caddy, et les manuels sont dans le JavaScript de l'appli : le filtre est un confort, pas une protection. Fichiers ni dans le dépôt ni dans les images : Caddy les sert sous `/medias/videos/` depuis le dossier `VIDEOS` du `.env`. En dev, `/medias/videos` est proxifié vers `outils/videos/apercu.mjs` (port 4300). Détails : `outils/videos/LISEZ-MOI.md`.
- `outils/videos/surveiller-scenarios.sh` (cron 5 min, clone dans `~/suivi-plongee-videos/`) tourne et publie seul les scénarios nouveaux ou modifiés de la version en ligne.
- **`SCENARIOS.md` s'édite à la main** au même commit que le scénario : `enregistrer.mjs --catalogue` ne le régénère correctement qu'avec les tournages présents (sans eux, il efface les textes).
