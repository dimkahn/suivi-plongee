---
name: bonnes-pratiques-angular
description: Bonnes pratiques Angular 22 de suivi-plongee (composants standalone, signaux, templates, appels à l'API, formulaires, tests Vitest, performance au téléphone). À utiliser pour écrire, relire ou refactoriser du code TypeScript du frontend, quand on hésite sur « la bonne façon » de faire ici.
argument-hint: "[fichier ou sujet, ex. features/sejours/sejour-frais.component.ts]"
---

# Bonnes pratiques Angular (suivi-plongee)

Ce skill dit **comment écrire** le code du front. Pour **brancher** un écran
(route, retour, aide, manuel, vidéo) : skill `nouvel-ecran`. Pour ce qui existe
déjà dans `core/` : `.claude/rules/composants-partages.md`. En cas de doute,
imiter le fichier voisin le plus récent (`git log -- <dossier>`).

## 1. Composants

- **Standalone**, template et styles **en ligne** dans le `.ts`, sélecteur
  `app-…`, classe `…Component`, noms en français, un commentaire `/** … */`
  au-dessus du `@Component` qui dit à quoi sert l'écran et pour qui.
- **`ChangeDetectionStrategy.OnPush`** pour un nouveau composant (tout son état
  en signaux). Les écrans marqués `Eager` le restent tant qu'on ne les a pas
  repris : passer à `OnPush` est une refactorisation, à vérifier dans le
  navigateur (`lancer-appli`), pas un effet de bord d'un autre changement.
- **Entrées et sorties en signaux** : `input()`, `input.required()`,
  `output()`, `model()`. Paramètres de route reçus comme `input()` (le routeur
  a `withComponentInputBinding()`), pas par `ActivatedRoute`.
- **`inject()`** dans les champs plutôt qu'un constructeur à paramètres.
- Un composant d'affichage **ne parle pas à l'API** : il reçoit, il émet. C'est
  l'écran qui charge, enregistre, affiche l'erreur et décide des droits.
- Écran trop long (au-delà de quelques centaines de lignes) : sortir une
  partie autonome en composant de la rubrique, ou de `core/` si elle sert deux
  fois.

## 2. État : signaux d'abord

- État local : `signal()`, dérivé : `computed()` (jamais un champ recalculé à
  la main après chaque `set`). `effect()` seulement pour sortir du monde des
  signaux (IndexedDB, DOM, focus), jamais pour copier un signal dans un autre.
- Mettre à jour un tableau ou un objet par **une nouvelle valeur**
  (`liste.update(l => [...l, x])`), pas en le mutant : `computed` et `OnPush`
  ne verraient rien.
- RxJS reste là où il est utile (HTTP, flux du réseau) ; pour un appel unique,
  `firstValueFrom(...)` dans une méthode `async`, ou `subscribe({ next, error })`
  comme les voisins. Un abonnement long : `takeUntilDestroyed()`.
- **Pas de `localStorage` ni `sessionStorage`** : jeton dans un signal
  (`AuthService`), le reste dans IndexedDB (`core/base-locale.ts`).

## 3. Templates

- Contrôle de flux intégré : `@if (x(); as v)`, `@for (… ; track e.id)` (une
  clé stable, `$index` seulement pour une liste figée), `@switch` (et
  `@defer` si un bloc lourd peut attendre). Pas de `*ngIf` / `*ngFor` dans du code neuf.
- Pas d'appel de méthode coûteuse dans le template : un `computed`.
- **Accessibilité** : `<button type="button">` pour une action (jamais un
  `<div (click)>`), `<label for>` ou `aria-label`, `role="alert"` sur un
  message d'erreur, `[attr.aria-…]` pour un état.
- **Téléphone, mains mouillées** : cibles ≥ 44 px, rien qui dépende du survol,
  lisible à 360 px de large. Couleurs, espacements, polices : jetons de
  `styles.css` (`var(--…)`), jamais une couleur en dur.
- Création ou modification : `<app-dialogue>` (`core/dialogue.component.ts`),
  jamais un `<dialog>` écrit à la main.

## 4. API et erreurs

- Les appels passent par `core/api.service.ts` (ou le port de la rubrique,
  ex. `sejour-api.ts`), typés par les interfaces de `core/modeles.ts`, qui
  reprennent les `record …Vue` et `Demande…` du backend **avec les mêmes noms
  de champs**. Changer un `record` côté Java = changer l'interface ici.
- Erreur : afficher le `detail` du `ProblemDetail` **tel quel** (le serveur
  écrit pour l'utilisateur final) ; pas de message réinventé côté front, sauf
  absence de réseau.
- Pendant un envoi : un signal `envoi` qui désactive les boutons (pas de
  double clic qui crée deux fois).
- Les gardes (`core/gardes.ts`) et les boutons masqués ne sont que du confort :
  ne jamais y mettre une règle qui n'existe pas aussi côté serveur.
- Écriture qui doit marcher sans réseau : passer par les files
  (`FileAttenteService`, `FileEcrituresService`), voir
  `.claude/rules/hors-ligne.md`. Jamais un cache d'écriture maison.

## 5. Formulaires

- Le projet utilise les **formulaires par modèle** (`FormsModule`, `ngModel`)
  liés à des signaux ou des champs simples ; garder ce style, ne pas
  introduire `ReactiveFormsModule` dans un écran qui ne l'a pas.
- `name` et `id` sur chaque champ, `<label>` visible, `type` juste
  (`date`, `tel`, `email`, `inputmode="numeric"`) pour le bon clavier au
  téléphone.
- La validation du front aide l'utilisateur ; celle du serveur fait foi (et
  renvoie le 400/422 qu'on affiche).

## 6. Logique et tests (Vitest)

- Toute règle non triviale (dates, filtres, regroupements, calculs) est une
  **fonction pure** dans `core/<nom>.ts` ou à côté de l'écran
  (`features/<rubrique>/<nom>.ts`), avec son `<nom>.spec.ts` écrit **d'abord**
  (rouge pour la bonne raison, puis vert). Exemples : `caci.ts`,
  `progression.ts`, `fiche-securite.ts`.
- On teste la logique et les services, pas la mise en page ; l'affichage se
  vérifie dans le navigateur (`lancer-appli`), en largeur téléphone.
- Dates : `core/date-fr.ts` (`dateFr`, `dateDuJour`, `dateDansJours`,
  `periode`) ; l'API échange des dates ISO, le format français n'est que pour
  l'affichage. Jamais `new Date().toISOString().slice(0, 10)`, qui donne la
  date UTC (la veille entre minuit et 2 h).
- Accords : `core/pluriel.ts`, pas de `(s)`.

## 7. Performance

- Écrans chargés à la demande (`loadComponent` dans `app.routes.ts`) : ne pas
  importer un écran depuis un autre, partager par `core/`.
- Bibliothèque lourde (Tesseract, PDF…) : `import()` dynamique au moment du
  geste, pas en tête de fichier.
- Photos réduites avant l'envoi (`core/reduire-photo.ts`).

## 8. Avant de rendre la main

```bash
cd frontend && npx ng build --configuration development   # types et templates
cd frontend && npm test -- --watch=false                  # Vitest
```

Puis, si l'écran change : manuel et scénario de vidéo (skill `nouvel-ecran`),
et l'agent `relecteur-donnees-personnelles` si l'écran montre des personnes.
