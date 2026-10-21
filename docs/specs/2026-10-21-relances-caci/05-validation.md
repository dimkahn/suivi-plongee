# Validation : Relances automatiques des CACI qui arrivent à échéance

- **Date :** 2026-10-21
- **Diff relu :** 22c3bdba..58d40ced (fonctionnalité : 8de34afc à 58d40ced ; f2c96601, correction 405/404 hors plan mais décidée, relue ; 49919e24, outillage, hors sujet)
- **Décision :** à prendre par QA et tech lead

## Tests

mvn test : 438 tests, 0 échec, 0 erreur, 0 ignoré (BUILD SUCCESS) ; aucune ligne « Erreur non prevue » au journal.
Dont relances : CalculRelancesCaciTest 11, TextesRelancesCaciTest 8, RelancesCaciMoniteursTest 14,
RelancesCaciRecapitulatifTest 16, TraceRelancesCaciTest 9, DeclencheurRelancesCaciTest 2,
ConservationTraceRelancesTest 1, RelancesCaciJournalDevTest 1, ServiceNotificationEmailTest 2, ErreursHttpTest 2.

npm test -- --watch=false : 20 fichiers, 192 tests, 0 échec.
ng build --configuration development : ok.

Recherche dans le diff : aucun `@Disabled`, `assumeTrue`, `localStorage` ou `sessionStorage` ajouté ; aucun test existant affaibli ;
`caci.spec.ts` inchangé ; aucune migration existante modifiée (seul ajout : `V99_1__relances_caci.sql`) ; `V100__donnees_demo.sql` et `db/demo` non touchés.

## Critères d'acceptation

| CA | Test | Verdict | Remarque |
|---|---|---|---|
| CA1 | `TextesRelancesCaciTest#relanceBientot` ; `RelancesCaciMoniteursTest#relanceAJMoins30` | couvert | Le test pur compare le sujet et le corps avec les valeurs littérales de la spec (Paul, 20/11/2026). Le test d'intégration vérifie un seul e-mail, avec le sujet et le corps exacts, plus une seule ligne de trace (R19). |
| CA2 | `CalculRelancesCaciTest#rienAvantJMoins30` ; `RelancesCaciMoniteursTest#rienAvantJMoins30` | couvert | À F − 31 : aucun e-mail et 0 trace. |
| CA3 | `CalculRelancesCaciTest#uneSeuleRelanceBientot` ; `RelancesCaciMoniteursTest#uneSeuleRelanceBientot` | couvert | Le traitement est rejoué à J-30, puis chaque jour jusqu'à F − 1 : 1 e-mail et 1 trace. |
| CA4 | `RelancesCaciMoniteursTest#rattrapageDansLaPeriode` ; `RelancesCaciJournalDevTest#journalDev` | couvert | À F − 12 : corps exact. Journal `dev` : `Courriel pour e3@club.fr : Votre CACI expire le …`, `Bonjour Gwendoline,` (démo, contexte par défaut). |
| CA5 | `TextesRelancesCaciTest#relanceJourJ` ; `RelancesCaciMoniteursTest#relanceJourJ` | couvert | Un seul e-mail, sujet et corps de R14 exacts. |
| CA6 | `CalculRelancesCaciTest#rienApresJ` ; `RelancesCaciMoniteursTest#rienApresLeJourJ` | couvert | Les trois cas sont testés (rejeu à F et à F + 1, jour J manqué, expiré depuis 20 jours). « Cité dans aucun récapitulatif » n'est vérifié que par le test pur (`dues` et `sansCaci` vides). |
| CA7 | `CalculRelancesCaciTest#renouvellementNouveauCycle` ; `RelancesCaciMoniteursTest#renouveleEntreDeux` | couvert | Nouvelle date saisie par `PUT /api/admin/moniteurs/{id}`. Rien à l'ancienne F. Puis R13 et R14 pour F′, sujets exacts. |
| CA8 | `CalculRelancesCaciTest#dateCorrigee` ; `RelancesCaciMoniteursTest#dateExamenCorrigee` | couvert | R13 et R14 pour F″, rien à l'ancienne F. |
| CA9 | `RelancesCaciMoniteursTest#moniteurInactif` | partiel | Désactivation par la route, fin d'accès posée en SQL : aucun e-mail. Mais « ni n'est cité au récapitulatif » n'est pas vérifié (voir Écarts). |
| CA10 | `RelancesCaciRecapitulatifTest#moniteurSansCaci` | couvert | Aucun e-mail vers le moniteur ; la ligne `- Sanscaci Tiago, moniteur` est sous « Sans CACI renseigné : ». |
| CA11 | `RelancesCaciRecapitulatifTest#eleveJamaisEcrit` | couvert | Exécution à D et à F : rien vers `eleve.test@exemple.fr`, 2 récapitulatifs. |
| CA12 | `CalculRelancesCaciTest#eleveAJMoins30EtAJ` ; `RelancesCaciRecapitulatifTest#eleveAuRecapitulatif` | couvert | Cité sous « bientôt » à J-30, absent de D + 1 à F − 1 (boucle jour par jour), cité sous « aujourd'hui » à F. |
| CA13 | `RelancesCaciRecapitulatifTest#perimetreDesEleves` | couvert | Élève de 2025-2026, élève archivé (route d'archivage), élève en adhésion : seul l'adhérent est cité, comme élève (`containsExactly`). |
| CA14 | `CalculRelancesCaciTest#moniteurEtEleve` ; `RelancesCaciRecapitulatifTest#moniteurAussiEleve` | couvert | Un seul e-mail R13. Une seule ligne « Marin Paul », comme moniteur. À J-30 du dossier élève, rien. Le rattachement du dossier au compte est posé en SQL (aucune route ne le fait). |
| CA15 | `TextesRelancesCaciTest#recapitulatifExact` ; `RelancesCaciRecapitulatifTest#recapitulatifDeBoutEnBout` | couvert | Le corps est comparé mot pour mot dans le test pur. En intégration : sujet exact, en-tête exact, lignes de chaque rubrique, rubrique « n'a pas pu joindre » absente ; le corps entier n'y est pas comparé, et c'est assumé (base partagée par les tests). |
| CA16 | `CalculRelancesCaciTest#pasDeRecapitulatifSansEcheance` ; `RelancesCaciRecapitulatifTest#pasDeRecapitulatifSansEcheance` | couvert | |
| CA17 | `CalculRelancesCaciTest#sansCaciUneFoisParSemaine`, `#sansCaciPasDeuxFoisLeMemeJour` ; `RelancesCaciRecapitulatifTest#sansCaciUneFoisParSemaine` | couvert | D (rejeu), D + 1 et D + 6 : pas cité ; D + 7 : cité. C'est la fenêtre D − 6..D tranchée dans la spec. |
| CA18 | `RelancesCaciRecapitulatifTest#unRecapitulatifParAdministrateurActif` | couvert | Exactement Claire et Ines (`containsExactlyInAnyOrder`), chacune avec son `Bonjour …,`. Rien vers l'administrateur désactivé ni vers `e3@club.fr`. |
| CA19 | `RelancesCaciRecapitulatifTest#administrateurMoniteur` | couvert | R13 puis le récapitulatif, où il est cité comme moniteur. |
| CA20 | `RelancesCaciRecapitulatifTest#sansAdministrateurActif` | couvert | La ligne de journal est comparée mot pour mot, sans nom, `@` ni F. À D + 1, l'élève est cité sous « bientôt ». Les administrateurs sont remis en place dans un `finally`. |
| CA21 | `RelancesCaciMoniteursTest#echecEmailMoniteur` ; `RelancesCaciRecapitulatifTest#moniteurInjoignableAuRecapitulatif` ; `TextesRelancesCaciTest#moniteurInjoignable` | couvert | Aucune trace, l'autre moniteur reçoit son e-mail, la ligne de journal est exacte et sans donnée personnelle, `- Marin Paul` est dans sa rubrique, un seul nouvel essai à D + 1. |
| CA22 | `RelancesCaciRecapitulatifTest#recapitulatifRefusePartout` | couvert | Journal exact et sans donnée personnelle ; à D + 1, élève sous « bientôt » ; une seule trace pour Claire, datée de D + 1. |
| CA23 | `RelancesCaciRecapitulatifTest#recapitulatifRecuParUnSeul` | couvert | |
| CA24 | `TextesRelancesCaciTest#aucunContenuDuCertificat`, `#textesNeRecoiventRienDuCertificat` ; `RelancesCaciRecapitulatifTest#aucunContenuDuCertificat` | couvert | Date d'examen sous 4 formats, médecin, cases, licences, date de naissance, téléphones, contact d'urgence, adresses des autres. Le test pur fige aussi la signature des méthodes de texte. |
| CA25 | `TraceRelancesCaciTest#contenuDeLaTrace` | couvert | Le test vérifie exactement les 5 propriétés de chaque ligne (ce qui prouve que `id` n'est pas exposé) et `nom`/`prenom` pour chaque personne. La ligne de Claire cite les 3 personnes. Aucune F, date d'examen, médecin, mention ni texte. |
| CA26 | `ConservationTraceRelancesTest#deuxAns` ; `TraceRelancesCaciTest#effaceeApresDeuxAns` | couvert | 21/10, 29/02 et 28/02/2030 → 29/02/2032 ; aucune personne orpheline après la cascade. |
| CA27 | `TraceRelancesCaciTest#consultationParLAdministrateur` | couvert | 200, deux lignes pour Paul dans l'ordre F puis J-30, liste entière triée par date décroissante. |
| CA28 | `TraceRelancesCaciTest#refusDeRole` | couvert | 403 pour e1, e2, surface et eleve ; 401 sans jeton. |
| CA29 | `TraceRelancesCaciTest#niNiveauNiDirecteurTechnique` | couvert | 403 pour `e3@club.fr`. |
| CA30 | `TraceRelancesCaciTest#niEcritureNiDeclenchement` ; `ErreursHttpTest` | couvert | POST, PUT, DELETE : 404 ou 405. Trace identique, aucun e-mail parti. Avant f2c96601, la réponse était 500 (gestionnaire `Exception`). |
| CA31 | `DeclencheurRelancesCaciTest#chaqueJourA7hHeureDeParis` | couvert | Le test lit l'annotation réelle par réflexion. 25/10 à 06:00Z et 26/10 à 06:00Z, plus le passage à l'heure d'été du 28/03/2027. |
| CA32 | `RelancesCaciMoniteursTest#fuseauDuClub` | couvert | `Clock.fixed(2026-10-20T22:30Z)` sur le vrai service : R13 avec 20/11/2026, trace datée du 21/10/2026. |
| CA33 | `caci.spec.ts` (inchangé, vert) ; `CalculRelancesCaciTest#delaiDe30Jours` ; `RelancesCaciMoniteursTest#delaiDe30JoursDeBoutEnBout` | couvert | |
| CA34 | aucun (vérification dans le navigateur) | absent | Point ouvert connu : pas encore vérifié dans le navigateur. Aucun fichier d'écran n'est touché (seuls les manuels `.md` et un commentaire de `core/caci.ts`), donc le risque est faible, mais le CA exige la vérification. |

## Écarts

- `[À CORRIGER] frontend/src/app/features/aide/manuels/administration.md:55,58 et dossier-eleve.md:31`. La version commitée en 58d40ced dit que le récapitulatif part « les jours où un CACI arrive à 30 jours de sa fin » et parle des élèves « en formation ou en maintien ». C'est inexact : R6 rattrape à la première exécution dans la période, et R4 compte une formation quel que soit son statut. La correction (« ou dès sa saisie », « même en abandon ou suspendue », premier récapitulatif long) existe dans l'arbre de travail, **non commitée** (`git status` : ces deux fichiers modifiés). Règle de chaque commit : le manuel doit dire ce que fait l'appli.
- `[À CORRIGER] frontend/src/app/features/aide/manuels/mon-compte.md:37` : « vous prévient 30 jours avant la fin de votre CACI ». Même imprécision (rattrapage R6 quand le CACI est saisi tard ou à la mise en service), et elle n'est pas reprise dans la correction en cours. Règle de chaque commit.
- `[À VÉRIFIER] backend/src/test/java/fr/club/plongee/notification/relance/RelancesCaciMoniteursTest.java:171-172` : CA9 dit « ni n'est cité au récapitulatif », mais le test ne regarde que l'absence d'e-mail. Le code filtre en amont du calcul (`comptesActifs`), donc le risque réel est faible, mais le CA n'est prouvé qu'à moitié (TDD : chaque CA a un test qui le prouve).
- `[À VÉRIFIER] backend/src/main/resources/db/migration/V99_1__relances_caci.sql et RelancesCaciService.java:258-265, 244-249`. Migration et SQL ne sont exécutés que sur H2 en `MODE=PostgreSQL` ; aucun test ni la CI ne tournent sur PostgreSQL. Points à vérifier sur PostgreSQL : `GENERATED BY DEFAULT AS IDENTITY`, `GeneratedKeyHolder` avec la colonne `"id"`, `IN (:ids)` sur un `Set`, `getObject(…, LocalDate.class)`. Confirmer aussi que `flyway_schema_history` de la production s'arrête à 99 (risque déjà noté dans le plan). Sans remote, le hook `proteger-migrations.sh` n'a rien pu comparer. J'ai vérifié à la main qu'aucune migration existante n'est modifiée.
- `[À VÉRIFIER] backend/src/main/java/fr/club/plongee/commun/GestionnaireErreurs.java:43-51` (f2c96601, hors plan, décidé). Le changement touche toute l'API : une route inconnue répondait 500, elle répond 404, et une méthode non prise en charge répond 405. Le 405 est renvoyé sans en-tête `Allow`, que le traitement par défaut de Spring pose. Sans conséquence pour le front, mais à noter. Le `detail` (« Cette action n'existe pas pour cette adresse. », « Cette adresse n'existe pas. ») n'est pas comparé par `ErreursHttpTest`.
- `[À VÉRIFIER] backend/src/test/java/fr/club/plongee/notification/relance/` : tests fragiles selon la date et l'ordre d'exécution.
  - `TraceRelancesCaciTest.java:167-169` cherche `"fin"`, `"valid"`, `"CACI"` ou `"élève"` dans toute la réponse, qui contient aussi les traces des autres tests de la base partagée. Un futur nom de démo ou de test qui contient « fin » le ferait échouer sans rapport avec R19.
  - `RelancesCaciMoniteursTest#fuseauDuClub` utilise une date fixe (21/10/2026). Aujourd'hui, elle tombe dans la fenêtre de Gwendoline et de Hugo (démo, F = jour du lancement + 12), donc l'exécution envoie aussi leurs e-mails dans la base isolée. Les contrôles sont ciblés, donc le test passe, mais cette collision se déplace avec le temps.
  - `RelancesCaciJournalDevTest` exécute le traitement du jour dans le contexte par défaut : il écrit des traces et des relances faites dans la base de démo que partagent les autres tests. C'est sans effet aujourd'hui.

  Rien n'est faux aujourd'hui ; je le signale, je ne le corrige pas.
- Points ouverts connus, vérifiés, que je ne signale pas de nouveau :
  - adresses de test en `@exemple.fr` ;
  - `EnvoiTrace.id` public, filtré par le contrôleur (CA25 vérifie les propriétés exactes) ;
  - CA34 non vérifié dans le navigateur ;
  - pas de remote.

  Les écarts au plan annoncés sont vérifiés et conformes au code :
  - R12 sur D − 6..D (`CalculRelancesCaci:83-87`, purge `faite_le < D − 6`) ;
  - journal de `ServiceNotificationEmail` limité au type de l'exception, testé par deux cas ;
  - écriture en base en échec après un envoi : journalisée par son type, le traitement continue (`traceEnEchecNArretePasLesAutres`, `notationEnEchecApresLeRecapitulatif`, `purgeEnEchecNArretePasLesRelances`) ;
  - une transaction par relance du récapitulatif ;
  - purge « Sans CACI » après 7 jours (`citationSansCaciEffaceeApresSeptJours`) ;
  - note `docs/decisions/comptes.md`.
- Vidéos : aucune touchée, ce qui est conforme à la spec (aucun écran modifié, trace sans écran) ; `SCENARIOS.md` est inchangé.
- **Données personnelles** : le diff touche des personnes, dont des mineurs.
  - Noms et F des élèves dans le récapitulatif envoyé à tous les administrateurs actifs.
  - Noms recopiés dans la trace, qui survivent 2 ans à la suppression d'un dossier.
  - F conservée dans `relance_caci_faite`.
  - Journal de `ServiceNotificationEmail` modifié pour tous les e-mails.

  Verdict de `relecteur-donnees-personnelles` (ajouté par la session principale, 2026-10-21) :
  - **Étapes 4, 5 et 6**, relues une à une avant leur commit : aucun point bloquant. Points corrigés avant commit : trace en échec qui arrêtait le traitement et journalisait la clé (étape 4), notation des relances du récapitulatif en un seul bloc et numéros de téléphone vraisemblables dans un test (étape 5).
  - **Passe finale** sur 8de34afc^..58d40ced : aucun point bloquant ni à corriger. Manuels inexacts sur le rattrapage de R6 et sur les formations en abandon ou suspendues : corrigés (administration, dossier-eleve, mon-compte). Restent à décider par le PO : l'effacement anticipé des noms de la trace (2 ans, sans clé étrangère) sur demande d'une famille ; le domaine des adresses de test (`@exemple.fr`), que le relecteur ne juge pas bloquant pour la mise en production.

## Risque : moyen

Pourquoi :
- **Migration** : des tables nouvelles seulement, aucune donnée existante transformée. En revanche, c'est le premier `V99_n` et il n'a jamais été joué sur PostgreSQL.
- **Envois réels** : une tâche planifiée écrit sans intervention à de vraies personnes. Elle fait circuler des noms de mineurs et leur date de fin de CACI vers tous les administrateurs, et un envoi parti ne se rattrape pas.
- **Premier passage en production** : il rattrape tout le monde d'un coup (R6), donc le premier récapitulatif sera long. Le manuel en cours de correction le dit, mais il faut prévenir le club.
- **Droits** : une seule route nouvelle, en lecture et réservée aux ADMIN. Les refus 403 et 401 sont testés pour chaque compte de démo cité. Pas de 422 prévu.
- **Surface élargie par f2c96601** : le traitement des erreurs 404 et 405 change pour toute l'API.
- **Hors ligne** : sans objet.
- **Bruit possible** (tension R16 × R11 déjà notée dans le plan) : si l'adresse d'un moniteur est refusée en permanence, chaque administrateur reçoit un récapitulatif chaque jour, pendant jusqu'à 30 jours. C'est conforme à la spec ; le PO doit le savoir.

À regarder en priorité dans la revue humaine :
1. `RelancesCaciService.executer` et `envoyerRecapitulatif` : l'ordre des opérations (envoi, trace, notation) et le chemin R17.
2. `V99_1__relances_caci.sql` sur un PostgreSQL réel.
3. Les manuels à commiter (administration, dossier-eleve) et à corriger (mon-compte).
4. La passe du relecteur de données personnelles.

## À essayer à la main

1. **Recette `dev` du journal (CA4, R23)** : `lancer-appli`. Aucune route ne déclenche le traitement : le plus simple est `mvn -q test -Dtest=RelancesCaciJournalDevTest` dans `backend`, puis lire dans la sortie l'e-mail pour `e3@club.fr` (Gwendoline, J-12) et le récapitulatif pour `presidente@club.fr`. Ce récapitulatif doit citer Hugo Lemaire sous « bientôt » et Tiago (`e1@club.fr`) sous « Sans CACI renseigné ». Il ne doit contenir ni Flora (expirée) ni d'adresse e-mail.
2. **Consultation de la trace** : connecté en `presidente@club.fr` / `plongee2026`, appeler `GET /api/admin/relances-caci` (par le proxy `/api` du front, jeton du signal, ou par curl) : 200, la liste contient seulement la date, le destinataire et les personnes. Avec `e3@club.fr`, `e1@club.fr` et `surface@club.fr` : 403. Sans jeton : 401. `POST` et `DELETE` en `presidente@club.fr` : 405.
3. **CA34, au téléphone** (largeur mobile) puis sur poste, avec les données de démo : `/admin/eleves` et `/admin/moniteurs` (filtre CACI « À vérifier », bandeaux, couleurs : Gwendoline et Hugo en rouge à 12 jours, Flora expirée, Tiago non renseigné), `/eleves` (case CACI de Hugo), `/mon-compte` pour `e3@club.fr` et `presidente@club.fr`. Comparer avec 22c3bdba si on a un doute.
4. **Aide** : chercher « relance », « rappel » et « CACI à suivre » dans l'aide. Vérifier que les manuels `mon-compte`, `administration`, `dossier-eleve`, `infos-eleves` et `ajouter-un-moniteur` répondent aux nouvelles questions, une fois la correction en cours commitée.
5. **PostgreSQL** : `docker compose up` sur une base qui a un historique Flyway arrêté à V99 (copie d'une sauvegarde, manipulée par un humain autorisé). Vérifier que V99_1 passe, puis attendre 7 h, ou exécuter le traitement depuis un test sur cette base, et vérifier que les lignes de trace sont lisibles par l'API.
6. **SMTP réel** (préproduction) : une adresse de moniteur volontairement fausse. Vérifier que le journal du serveur ne contient pas l'adresse et que le récapitulatif liste le moniteur sous « n'a pas pu joindre ».
