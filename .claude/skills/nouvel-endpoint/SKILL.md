---
name: nouvel-endpoint
description: Ajouter ou modifier une route de l'API REST de suivi-plongee (contrôleur Spring, droits, règle métier, test de bout en bout). À utiliser pour tout nouvel endpoint ou tout changement de droits, de corps de requête ou de réponse.
argument-hint: "[méthode et chemin, ex. PUT /api/sejours/{id}/voitures]"
---

# Ajouter ou modifier un endpoint

## 1. Commencer par le test (rouge)

Un test `@SpringBootTest` + `@AutoConfigureMockMvc`, profil `dev`, sur le modèle
de `SortieTest` (connexion par `POST /api/auth/connexion`, jeton
`Authorization: Bearer …`). Au minimum :
- **le cas permis** avec le bon compte de démonstration ;
- **le refus de rôle** (403) avec un compte qui n'a pas le droit ;
- **chaque refus métier** : 422, en vérifiant le `detail` **en entier** (c'est le
  message que lit l'utilisateur).
Chaque test crée ses propres données (dates à lui, loin des autres) : la base est
partagée entre les tests.

## 2. Les droits, sur deux niveaux

- **Rôle** : `@PreAuthorize("hasRole('MONITEUR')")` (ou `ADMIN`, `DIRECTEUR_TECHNIQUE`,
  `TIV`, `FICHE_SECURITE`, `SECURITE_SURFACE`…) sur **chaque** méthode.
- **Habilitation métier** : un bean de droits dans le `@PreAuthorize`
  (`@habilitation.peutEvaluer(#cursusId, authentication)`,
  `@droitsSejour.organise(#id, authentication)`…), ou une vérification dans le
  service qui lève `RegleMetierException` avec un message pour l'utilisateur.
- **L'auteur vient du `SecurityContext`**, jamais du corps de la requête.
- **Une route publique** (sans connexion) se déclare explicitement dans
  `SecurityConfig` (aujourd'hui seulement `GET /api/identite/**` et
  `/api/public/sejour/**`, accès par code) : la justifier, et la protéger
  (jeton, limite d'essais) comme `AccesSejourService`.

## 3. Le code

- Domaine encore en couches : exécuter d'abord le skill `refactoriser-hexagonal`.
  Sinon : contrôleur dans `adaptateur/entree/web` qui n'appelle que l'`application`.
- Corps de requête : un `record Demande…` validé (`@Valid`, `jakarta.validation`) ;
  réponse : un `record …Vue`. Jamais une entité JPA en sortie.
- **Données personnelles filtrées par le serveur** : un élève ou un participant ne
  reçoit que ce qu'il a le droit de voir (téléphone, e-mail, régime des autres :
  non). Pas de champ de santé. Photo seulement avec `autorisation_image`.
- Écriture rejouée hors ligne (présence, fiche…) : idempotente côté serveur.
- Erreurs métier : `RegleMetierException` (422), message en français pour
  l'utilisateur final ; ressource absente : `RessourceIntrouvableException`.

## 4. Vérifier et documenter

- `cd backend && mvn test -Dtest=<LeTest>` puis `mvn test` entier.
- Agent `relecteur-donnees-personnelles` sur la modification.
- Côté écran : skill `nouvel-ecran` si l'écran change.
- Décision structurante : la noter dans `.claude/rules/<domaine>.md`.
