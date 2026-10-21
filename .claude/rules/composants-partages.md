---
paths:
  - "frontend/src/app/**/*.ts"
  - "frontend/src/styles.css"
---

# Composants partagés

- **Un bout d'écran qui sert à deux endroits devient un composant** de `core/` (demande du club, 2026) : même balisage ou même logique d'affichage dans deux écrans (ou plus), on n'en fait pas une copie. Le deuxième usage est le moment de l'extraire, dans le même commit, et de faire passer le premier par lui.
- **Avant d'écrire un écran**, regarder ce que `core/` offre déjà : `app-dialogue` (création, modification, confirmation), `app-combobox` (choisir une personne, un exercice), `app-filtre-groupe`, `app-calendrier-seances`, `app-photo-eleve`, `app-photo-exercice`, `app-recadrage-photo`, `app-saisie-caci` et `app-detail-caci`, `app-programme-seance`, `app-schema-exercice`, `app-choix-format-aide`. Réutiliser avant de recréer.
- **Forme** : standalone, `input()` / `output()` / `model()` (signaux), template et styles en ligne, sélecteur `app-…` et classe `…Component` en français, fichier `core/<nom>.component.ts`. Styles du composant dans le composant, couleurs et espacements par les jetons de `styles.css`.
- **Un composant d'affichage ne parle pas à l'API** : il reçoit ses données en entrée et émet ce que fait l'utilisateur ; l'écran charge, enregistre et affiche l'erreur. Les droits restent décidés par l'écran (et le backend), pas devinés dans le composant.
- **Logique pure partagée** (calcul, formatage, règle) : une fonction dans `core/<nom>.ts` avec son `.spec.ts` Vitest, comme `caci.ts` ou `pluriel.ts` ; pas de composant pour ce qui n'affiche rien.
- **Pas de composant pour un élément natif seul** (un `<input>` et son `<label>`, un bouton qui appelle `window.print()`) : on extrait une structure (plusieurs éléments, un état, des règles d'affichage), pas une balise. *Pourquoi :* le composant ne gagnerait qu'une ligne et cacherait `id`, `name` et `ngModel` au formulaire de l'écran.
- **Style seul répété** (une classe CSS identique dans plusieurs écrans, sans balisage commun) : une classe de `styles.css`, pas un composant.
- **Extraire, c'est refactoriser** : rien ne change à l'écran, donc ni manuel ni vidéo à mettre à jour ; `npx ng build --configuration development` et `npm test -- --watch=false` verts, et un coup d'œil dans le navigateur (`lancer-appli`) sur chaque écran touché. Garder les sélecteurs CSS et libellés que visent les scénarios de vidéo (`outils/videos/scenarios/`).
