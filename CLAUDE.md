# Contexte du projet

Suivi des compétences de plongée d'un club FFESSM : des moniteurs bénévoles
notent leurs élèves séance par séance, souvent au téléphone au bord du bassin.
Backend Java 25 / Spring Boot 4.1 (Maven), frontend Angular 22 standalone,
PostgreSQL en production, H2 en dev, migrations Flyway. `pom.xml` agrégateur à
la racine (`mvn install` ; le module `frontend` enveloppe `npm ci && ng build`) ; déploiement : deux services Docker
(`docker-compose.yml`).

Code, commentaires, noms de classes et messages d'erreur **en français**
(délibéré : les contributeurs sont des moniteurs de club). Garder cette
convention, y compris pour les nouveaux fichiers.

## Commandes

```bash
cd frontend && npm test -- --watch=false                 # Vitest, quelques secondes
cd frontend && npx ng build --configuration development  # types et templates, ~15 s
cd backend && mvn -q test -Dtest=SortieTest              # une classe (ou Classe#methode)
cd backend && mvn test                                   # tout, avant chaque commit
mvn -N -Pdev antrun:run@dev          # lance frontend (détaché, log frontend/frontend-dev.log) + backend
mvn -N -Pdev antrun:run@dev-stop     # arrête le frontend détaché
```

Le frontend proxifie `/api` vers `localhost:8080`. Comptes de démo dans le
README, mot de passe `plongee2026`. Outils `.claude/` : skills `nouvel-ecran`,
`nouvel-endpoint`, `nouvelle-migration`, `lancer-appli` ; agent
`relecteur-donnees-personnelles` (avant un commit qui touche des données de
personnes). Historique des choix : `docs/decisions/`.
Modèle des agents : `haiku` pour chercher dans le code, `sonnet` pour une
tâche cadrée et relue (réécriture, lancer l'appli) ; le modèle principal pour
concevoir, coder, tester et relire les données personnelles.

**Mise en production** : un tag `v…` sur un commit de `master` (vu par
`outils/surveiller-tags.sh`, cron 5 min sur le serveur : build, sauvegarde,
redémarrage, retour arrière automatique) ; le même tag lance
`.github/workflows/deploiement.yml` (tests et images ghcr.io seulement). Voir
`DEPLOIEMENT.md`.

## Règle de chaque commit (demande du club, 2026)

Tout commit qui change ce que voit ou fait l'utilisateur met à jour **dans le
même commit** le ou les manuels de `frontend/src/app/features/aide/manuels/`
(texte, questions, mots-clés) **et** les scénarios de vidéo qui montrent
l'écran (`outils/videos/scenarios/*.mjs` : gestes, voix off, date « Tournage
du … », plus l'entrée de `outils/videos/SCENARIOS.md`). Les chercher par
écran, sélecteurs CSS, libellés ; le dire dans le résumé. Dispensés : tests,
outillage, refactorisation. Détail : skill `nouvel-ecran`.

## TDD

Toute modification de comportement (règle métier, endpoint, droit, bogue) :
1. **Rouge** : un seul test, lancé seul, qui échoue **pour la bonne raison**
   (assertion, pas compilation ni données de démo).
2. **Vert** : le code le plus simple qui le fait passer.
3. **Refactoriser** au vert, puis relancer la classe entière.

- Un bogue = d'abord un test qui le reproduit, et il reste.
- Tester le comportement visible : backend par l'API (`@SpringBootTest` +
  `MockMvc`, profil `dev`, compte de démo, comme `AdhesionTest`), test
  unitaire sans Spring pour une règle pure ; frontend : Vitest pour la logique
  de `core/` et des services, pas la mise en page.
- Droits testés aussi en négatif : 403 mauvais rôle, refus d'habilitation,
  422 lisible.
- Nommer le test par la règle, en français (`@DisplayName("Un E1 ne peut pas
  noter un élève de N2")`).
- Tests indépendants, chacun crée ses données ; ne pas modifier
  `V100__donnees_demo.sql` pour un test ; source externe remplacée par une
  fausse (`GenerationSaisonTest`).
- Pas de code de production sans test qui l'exige, sauf affichage pur
  (vérifié dans le navigateur, `lancer-appli`).
- Avant de commiter : `mvn test` et `npm test -- --watch=false` verts. Ne
  jamais désactiver ni affaiblir un test ; un test qui semble faux, le dire.

## Décisions structurantes

Les décisions par domaine sont dans `.claude/rules/*.md`, chargées
automatiquement avec les fichiers du domaine : référentiel, progression,
encadrants et fiche de sécurité, planning, matériel, séjour, évaluation,
exercices, hors ligne, audit (Envers), élèves et saisons, données
personnelles (CACI, photos), comptes et e-mail, identité, aide et vidéos,
navigation, composants partagés du front. Les lire avant de concevoir une modification qui les concerne.

- **Sécurité à deux niveaux** : le rôle (`hasRole('MONITEUR')`), puis
  l'habilitation métier (`@habilitation.peutEvaluer(#cursusId,
  authentication)` : niveau d'encadrement ≥ niveau exigé, E1 pour le N1, E2
  pour le N2, E3 pour le N3). L'auteur d'une écriture vient du
  `SecurityContext`, jamais du corps de la requête (une exception, voir
  `evaluation.md`). Les gardes Angular ne sont que du confort.
- **Hors ligne par des files** (IndexedDB, rejeu idempotent), jamais un cache
  d'écriture : voir `hors-ligne.md`.

## Conventions

- Pas de `localStorage` ni `sessionStorage` : jeton dans un signal Angular, le
  reste dans IndexedDB (`core/base-locale.ts`).
- Composants standalone, signaux plutôt que RxJS pour l'état local, template
  et styles en ligne dans le `.ts`.
- Erreur métier : `RegleMetierException` (422), message pour l'utilisateur
  final ; le front affiche le `detail` du `ProblemDetail` tel quel.
- Cibles tactiles ≥ 44 px (mains mouillées).
- Créations et modifications dans une fenêtre de dialogue
  (`core/dialogue.component.ts`), sauf formulaires longs.
- Jetons de design dans `frontend/src/styles.css`, aucune bibliothèque de
  composants.

## Données personnelles

Le club suit des mineurs.
- Le certificat médical n'est **jamais** stocké : seulement des dates et les
  cases du CACI, jamais le texte du médecin (détail : `donnees-personnelles.md`).
- Aucun champ de santé, pièce jointe médicale ni commentaire libre sur l'état
  de santé.
- Le droit à l'image (`autorisation_image`) est un consentement distinct ;
  sans lui, ni photo acceptée ni renvoyée, et le retirer supprime la photo.
- `V100__donnees_demo.sql` : noms fictifs, profil `dev` uniquement, jamais en
  production.

## Chantiers ouverts

1. Import du classeur Google Sheets existant (4ᵉ statut `NA`, non acquis, que
   `StatutAcquisition` ne représente pas encore).
2. Relances automatiques : CACI qui expirent, RIFAP échus, 4 plongées en
   milieu naturel dues par un N1 certifié en piscine.

## Garde-fous pour l'IA (`.claude/settings.json`)

- **Lecture interdite** de `.env`, `application-local.yml`, du classeur
  « Fichier Suivi… » (données réelles de mineurs) et de `sauvegardes/` : ne
  pas contourner. Pour des données, passer par la démo (profil `dev`).
- **`git push` et `git tag` demandent confirmation** (un tag `v…` met en
  production) ; `push --force` est refusé.
- **Une migration Flyway déjà sur `origin/master` ne se modifie pas** (hook
  `proteger-migrations.sh`) : créer la suivante.
