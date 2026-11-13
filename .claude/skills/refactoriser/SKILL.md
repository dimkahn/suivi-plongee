---
name: refactoriser
description: Refactoriser du code de suivi-plongee sans rien changer de ce que voit ou fait l'utilisateur (extraire un composant ou une fonction, renommer, déplacer, découper une classe ou un service, supprimer une copie). À utiliser dès qu'on restructure du code existant, backend ou frontend, plutôt que d'en changer le comportement.
argument-hint: "[ce qu'on restructure, ex. extraire la carte voyage de sejour.component.ts]"
---

# Refactoriser

Refactoriser, c'est changer la forme du code **sans changer son comportement** :
même écran, mêmes réponses de l'API, mêmes données en base, mêmes droits. Si
quelque chose change pour l'utilisateur, ce n'est plus une refactorisation :
TDD de `CLAUDE.md` (test rouge d'abord), et manuel + vidéo dans le même commit.

## 1. Avant de toucher au code

- **Partir d'un état vert et propre** : `git status` sans modification en cours
  (ou les mettre de côté), puis les tests de ce qu'on va toucher :
  `cd backend && mvn -q test -Dtest=LaClasseTest`, `cd frontend && npm test -- --watch=false`.
  Un test déjà rouge : le dire et s'arrêter, ne pas refactoriser par-dessus.
- **Le comportement est-il protégé ?** Chercher les tests qui couvrent le code
  (par l'API : `@SpringBootTest` + `MockMvc` ; front : le `.spec.ts` de `core/`
  ou du service). S'il n'y en a pas, **écrire d'abord un test de
  caractérisation** qui passe sur le code actuel (ce qu'il fait aujourd'hui,
  même étrange), le lancer seul, vert. C'est lui qui garantira l'absence de
  changement.
- **Annoncer le périmètre** en une phrase (quoi, dans quels fichiers) et s'y
  tenir : pas de « tant qu'on y est ».

## 2. Par petits pas, toujours au vert

- Un pas = une transformation (extraire, renommer, déplacer, inliner, supprimer
  une copie), puis compiler et relancer les tests concernés. Rouge : revenir au
  pas précédent plutôt que de corriger à l'aveugle.
- **Un bogue découvert en route** : ne pas le corriger dans la refactorisation.
  Le noter, finir au vert, puis le traiter à part (test rouge qui le reproduit,
  commit séparé).
- **Ne jamais affaiblir ni supprimer un test** pour rester vert. Renommer un
  test ou son `@DisplayName` qui suit le code renommé, oui ; changer ce qu'il
  vérifie, non.

## 3. Ce qui ne doit pas bouger (contrats invisibles)

- **API REST** : chemins, méthodes, noms et forme du JSON, codes d'erreur et
  `detail` des 422. Les téléphones gardent des écritures en file (IndexedDB) et
  les rejouent plus tard (`hors-ligne.md`) : une vieille appli doit encore être
  comprise. Un renommage Java ne doit pas changer un nom de champ JSON.
- **Base** : une migration Flyway déjà sur `origin/master` ne se modifie pas
  (hook `proteger-migrations.sh`). Renommer une colonne ou une table n'est pas
  une refactorisation : nouvelle migration, skill `nouvelle-migration`.
- **Droits** : `@PreAuthorize`, `@habilitation…`, `@droitsSejour…`, filtres du
  serveur. Déplacer une méthode de contrôleur : ses annotations la suivent, et
  les tests de refus (403, 422) restent verts.
- **Données sur le téléphone** : noms des magasins IndexedDB et forme de ce
  qui y est stocké (`core/base-locale.ts`, files, copies hors ligne). Un
  renommage de propriété rendrait illisible ce qui est déjà enregistré.
- **Ce que visent les vidéos** (`outils/videos/scenarios/*.mjs`) : sélecteurs
  CSS (`.ouvrir-actions`, `.sous-onglets`…), libellés, rôles (`tab`, `button`).
  Chercher le sélecteur ou le libellé dans les scénarios avant de le changer.
- **Liens gardés** : routes, `?onglet=…` et anciens noms d'onglet
  (`ouvertureDemandee`), ancres de section, retours de `core/navigation.ts`.
- **Classes globales** de `styles.css` (`.chargeur`, `.temoin`, `.etiquette-etat`…) :
  utilisées partout, un renommage se fait partout ou pas du tout.

## 4. Les gestes courants ici

- **Extraire un composant** (règle `composants-partages.md`) : un bout d'écran
  utilisé à deux endroits devient un composant de `core/`, dans le même commit,
  et le premier usage passe par lui. Forme : standalone, `input()`/`output()`,
  template et styles en ligne, sélecteur `app-…`, nom en français. Un composant
  d'affichage ne parle pas à l'API.
- **Extraire une logique pure** (calcul, règle, formatage) : une fonction dans
  `core/<nom>.ts` ou à côté du composant, avec son `.spec.ts` Vitest ; le
  composant l'appelle. Les tests de la fonction s'écrivent d'abord, sur le
  comportement actuel.
- **Découper un service ou un contrôleur Spring** trop gros : même découpage
  que `bonnes-pratiques-spring` (contrôleur mince, service transactionnel,
  dépôt) ; les tests MockMvc existants ne changent pas d'URL.
- **Supprimer du code mort** : vérifier par `grep` (templates compris, et
  scénarios de vidéo) qu'il n'est plus appelé nulle part, puis compiler.
- Noms, commentaires et messages **en français**, comme le reste du code.

## 5. Vérifier et rendre compte

- Backend : la classe de test concernée, puis `cd backend && mvn test` en entier.
- Frontend : `cd frontend && npx ng build --configuration development` et
  `npm test -- --watch=false`.
- Un écran touché : skill `lancer-appli`, l'écran au téléphone (moins de
  860 px) et sur ordinateur, rien ne doit avoir changé à l'œil.
- Code qui touche des données de personnes ou des droits : agent
  `relecteur-donnees-personnelles` avant le commit.
- **Commit** (seulement si on le demande) : message « Refactorisation : … ».
  Ni manuel ni vidéo à mettre à jour, puisque rien ne change pour
  l'utilisateur : le dire dans le résumé. Ne jamais mêler dans le même commit
  une refactorisation et un changement de comportement.
- Dans le résumé : ce qui a été restructuré, les tests ajoutés (caractérisation),
  ce qui a été vérifié, et les bogues repérés mais laissés de côté.
