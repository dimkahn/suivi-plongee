---
name: nouvel-ecran
description: Ajouter ou modifier un écran Angular de suivi-plongee (route, navigation, retour, aide « Comment faire ? », manuel, vidéo). À utiliser pour tout nouvel écran, et pour tout changement visible d'un écran existant (la règle du club impose manuel et vidéo dans le même commit).
argument-hint: "[écran, ex. /sejours/:id/frais]"
---

# Ajouter ou modifier un écran

## 1. Le composant

- Standalone, template et styles en ligne dans le `.ts`, signaux pour l'état
  local, dans `frontend/src/app/features/<rubrique>/`.
- Création ou modification = fenêtre de dialogue (`core/dialogue.component.ts`,
  boutons dans `.actions-dialogue`), sauf formulaire long (page entière).
- Cibles tactiles ≥ 44 px ; jetons de `styles.css` (couleurs, polices), aucune
  bibliothèque de composants ; pas de `localStorage`/`sessionStorage`
  (IndexedDB via `core/base-locale.ts`).
- Message d'erreur : afficher le `detail` du 422 tel quel.
- Logique non triviale (calcul de dates, filtres) : une fonction pure dans
  `core/` ou à côté du composant, **testée par Vitest** (`*.spec.ts`, écrite
  d'abord : rouge, puis vert).

## 2. Le brancher (rien ne doit manquer)

1. **Route** dans `frontend/src/app/app.routes.ts`, avec la garde qui convient
   (`gardeConnecte`, `gardeEncadrant`, `gardeAdmin`…, `core/gardes.ts`). La garde
   n'est que du confort : le serveur refuse de toute façon.
2. **Retour « ← … »** dans `frontend/src/app/core/navigation.ts` (le parent dans
   l'arborescence, jamais la page précédente ; écran du menu : son nom dans
   `NOMS_ECRANS`). Ne pas écrire de lien de retour dans l'écran.
3. **« Comment faire ? »** : une entrée `{ adresse, manuels }` dans
   `frontend/src/app/features/aide/comment-faire.ts`.
4. **Menu** (`app.component.ts`) si l'écran y figure ; sous 860 px, ce qui colle
   au bas se place au-dessus de la barre d'onglets (`--hauteur-onglets`).
5. **Hors ligne** : si l'écran doit marcher sans réseau, ses données passent par
   « Préparer hors ligne » et les écritures par les files (`FileAttenteService`,
   `FileEcrituresService`). Sinon, dire « réseau obligatoire » dans le manuel.

## 3. Aide et vidéo (même commit, règle du club)

- **Manuel** : `frontend/src/app/features/aide/manuels/<nom>.md` (format dans
  le `LISEZ-MOI.md` du dossier), ajouté à `manuels/index.ts` ; texte, questions
  et mots-clés à jour pour un écran modifié.
- **Vidéo** : le scénario de `outils/videos/scenarios/*.mjs` qui montre l'écran
  (chercher par sélecteur CSS, libellé de bouton, adresse) : gestes, phrases de
  voix off, et la date « Tournage du … » mise à jour pour qu'il soit retourné.
  Nouveau scénario : le citer dans le manuel. Mettre à jour son entrée de
  `SCENARIOS.md` à la main (sans les tournages en local, `enregistrer.mjs
  --catalogue` en efface les textes).

## 4. Vérifier

- `cd frontend && npx ng build --configuration development` (types et templates)
  et `npm test -- --watch=false`.
- Skill `lancer-appli` : ouvrir l'écran, le geste, en largeur téléphone, et avec
  un compte qui n'a pas le droit.
- Dans le résumé : manuel(s) et scénario(s) mis à jour.
