---
name: refactoriser-hexagonal
description: À exécuter OBLIGATOIREMENT avant toute modification de logique dans suivi-plongee (fonctionnalité, correction de bug, règle métier, backend ou frontend). Pas pour une retouche de texte, de libellé, de style ou de documentation. Migre vers l'architecture hexagonale le domaine backend touché s'il est encore en couches (commit de refactorisation à part), fait la modification en TDD (rouge → vert → refactoriser), puis remet au propre le code touché. Aussi sur demande : « migre le domaine X en hexagonal », « refactorise ».
argument-hint: "[domaine ou description de la modification]"
---

# Refactoriser avant de modifier

Règle du projet (CLAUDE.md, « Architecture hexagonale, et refactorisation
systématique ») : on ne modifie jamais un domaine encore en couches, on le
migre d'abord ; et le code touché est toujours remis au propre. Suivre les
étapes dans l'ordre, sans en sauter.

## 0. Est-ce une modification de logique ?

- **Non** (texte, libellé, faute de frappe, style CSS, documentation, manuel,
  scénario de vidéo, configuration) : ne pas migrer de domaine ni exiger de
  test ; faire la retouche, puis l'étape 4 sur les lignes touchées seulement.
- **Oui** (comportement, règle métier, donnée, droit, calcul, correction de
  bug) : suivre toutes les étapes ci-dessous.

## 1. Repérer les domaines touchés

À partir de la demande (`$ARGUMENTS`), lister les domaines backend
(`backend/src/main/java/fr/club/plongee/<domaine>/`) que la modification
va toucher. Lire `DOMAINES_EN_COUCHES` dans
`backend/src/test/java/fr/club/plongee/ArchitectureHexagonaleTest.java`.

- Aucun domaine touché n'est dans la liste (ou modification frontend
  seule) : passer à l'étape 3.
- Sinon : étape 2 pour **chaque** domaine touché de la liste, avant toute
  ligne de la fonctionnalité. Annoncer à l'utilisateur, en une phrase,
  quels domaines vont être migrés.

`commun`, `config` et `audit` sont techniques : jamais migrés.

## 2. Migrer un domaine (commit de refactorisation à part)

Le comportement ne change pas : mêmes URL, mêmes JSON, même schéma de base,
mêmes messages. Aucune migration Flyway.

**a. État de départ.** `git status` propre (sinon demander quoi faire des
changements en cours). Lancer `cd backend && mvn test` : si des tests
échouent déjà, le dire et s'arrêter là pour ce domaine.

**b. Cible.** Ranger chaque classe du domaine :

| Aujourd'hui | Cible |
|---|---|
| `domain/` (entités, enums, objets de valeur) | `domaine/` |
| calcul pur sans Spring (ex. `EcheancesProgression`, `FraisSejour`, `ProposeurPalanquees`) | `domaine/` |
| `repository/` (Spring Data) | port `domaine/port/<Besoin>` + adaptateur `adaptateur/sortie/persistance/` |
| `service/` (orchestration, `@Transactional`, `Demande…`, `…Vue`) | `application/` |
| service qui lit en `JdbcTemplate`/`NamedParameterJdbcTemplate` | cas d'usage dans `application/` + port + adaptateur `adaptateur/sortie/persistance/` portant le SQL |
| `*Controller` à la racine du domaine | `adaptateur/entree/web/` |
| e-mail, appel HTTP externe, génération PDF/Excel | port dans `domaine/port/` + `adaptateur/sortie/<technique>/` |
| `Droits…` (beans lus par `@PreAuthorize`) | `application/` (règle métier de droits) |

**c. Ports et dépôts.**
- Le port est une interface de `domaine.port`, nommée par le besoin
  (`Progressions`, `Sejours`), qui ne déclare **que** les méthodes dont
  l'application se sert (lire les appels dans les services).
- L'adaptateur JPA : `interface ProgressionsJpa extends JpaRepository<ProgressionType, Long>, Progressions`
  dans `adaptateur.sortie.persistance`. Les requêtes dérivées et les
  `@Query` y sont redéclarées. Une méthode du port à signature identique à
  Spring Data (`findById`, `findAll`, requêtes dérivées) est implémentée
  telle quelle ; pour `save` déclarer dans le port
  `<S extends T> S save(S entite)` ; en cas de conflit de nom au compilateur,
  passer par une méthode `default` de l'adaptateur.
- Le port ne renvoie ni `Page`, ni `Specification`, ni rien de
  `org.springframework` hors `org.springframework.data.domain` admis.

**d. Autres domaines.** Chercher qui importe les anciens paquets du
domaine (`grep -rln "fr.club.plongee.<domaine>.\(repository\|service\|domain\)" backend/src`).
Ces appelants passent désormais par :
- l'`application` du domaine pour un cas d'usage ;
- le port (`domaine.port`) pour une simple lecture ;
- jamais par un `adaptateur` (règle vérifiée par ArchUnit).

**e. Déplacer.** `git mv` classe par classe (garder l'historique), puis
corriger `package` et `import` dans `backend/src/main` **et**
`backend/src/test`. Les tests gardent leurs assertions : ils se déplacent
et s'adaptent, ils ne s'affaiblissent pas et on n'en supprime pas. Ne pas
renommer les classes JPA ni leurs tables. Vérifier les chaînes qui citent
des paquets (`@EntityScan`, `@EnableJpaRepositories`, `scanBasePackages`,
SpEL `@xxx.` des `@PreAuthorize` : le nom du bean ne change pas tant que
le nom de classe ne change pas).

**f. Retirer le domaine** de `DOMAINES_EN_COUCHES`.

**g. Vérifier.** `cd backend && mvn test` entier, vert. Si
`ArchitectureHexagonaleTest` échoue, corriger le rangement, jamais la règle
du test (ne jamais ajouter d'exception ni rajouter le domaine à la liste).

**h. Documentation.** Mettre à jour les noms de classes et de paquets
déplacés cités dans `CLAUDE.md` et dans `.claude/rules/*.md`
(`grep -rn "<AncienNom>\|<domaine>\.\(service\|repository\|domain\)" CLAUDE.md .claude/rules`).

**i. Commit à part**, sans la fonctionnalité :
`Refactorisation : domaine <domaine> en architecture hexagonale`, corps
qui dit « aucun changement de comportement ». Pas de manuel ni de vidéo à
mettre à jour (commit sans effet visible).

Filet de sécurité : si ce qu'on déplace n'est couvert par aucun test,
écrire d'abord des **tests de caractérisation** (ils décrivent le
comportement actuel et passent verts sur l'ancien code), les commiter avec
la migration.

## 3. Faire la modification demandée, en TDD

Dans la structure hexagonale : la règle métier va dans `domaine` (ou
`application` si elle orchestre), le SQL et les appels techniques dans un
adaptateur derrière un port, le contrôleur ne fait qu'appeler
l'application. Un domaine neuf naît hexagonal.

### Le cycle, à répéter par petits pas

1. **Rouge.** Écrire **un seul** test, pour le prochain comportement
   attendu. Le lancer (`cd backend && mvn test -Dtest=<Classe>#<méthode>`, ou `cd frontend && npm test -- --watch=false`)
   et lire l'échec : il doit échouer **pour la raison attendue**
   (assertion), pas pour une erreur de compilation ou de données. Une
   classe ou méthode encore inexistante : la créer vide, relancer, voir
   l'assertion échouer.
2. **Vert.** Le code le plus simple qui fait passer ce test, rien de plus
   (pas de cas « pour plus tard » non testé). Relancer ce test, puis la
   classe de test.
3. **Refactoriser.** Tests verts, remettre au propre le code et le test
   (étape 4). Relancer.

Pour un bug : d'abord le test qui le reproduit (rouge), ensuite seulement
la correction. Avant le commit : `mvn test` entier.

### Choisir le niveau de test

Du plus rapide au plus lent ; viser le plus bas niveau qui prouve le
comportement :

| Ce qu'on teste | Test | Exemple existant |
|---|---|---|
| règle métier pure (`domaine`) | JUnit + AssertJ, sans Spring, sans base | `EcheancesProgressionTest` |
| cas d'usage (`application`) | sans Spring, ports remplacés par des **faux en mémoire** écrits dans le test (Mockito toléré pour un port appelé une fois, pas pour une entité) | `RegleDelivranceServiceTest` |
| adaptateur de persistance (requête, SQL) | `@SpringBootTest` profil `dev`, base H2 | |
| logique d'écran (frontend) | Vitest, fonction pure dans un `*.spec.ts` (`npm test -- --watch=false`) | `core/caci.spec.ts` |
| bout en bout : URL, JSON, droits, refus 422 | `@SpringBootTest` + `@AutoConfigureMockMvc`, profil `dev` | `SortieTest` |

Un nouveau comportement exposé à l'écran a au moins un test de bout en
bout (le cas permis **et** le refus : rôle insuffisant, règle métier
violée avec son message 422) ; ses variantes se testent au niveau du
domaine.

### Bonnes pratiques

- **Un test = un comportement**, nommé par une phrase métier en français
  dans `@DisplayName` (« Un détendeur non désinfecté ne se prête pas »),
  méthode en français aussi.
- Structure **étant donné / quand / alors**, une ligne vide entre les
  trois ; une seule action par test.
- Tester le **comportement observable** (retour, état, réponse HTTP,
  message), jamais l'implémentation (ordre d'appels internes, méthodes
  privées).
- **Dates** : jamais la date du jour dans une règle du domaine ; elle
  reçoit la date en paramètre (comme les échéances), l'application la lit
  par `Calendrier.aujourdhui()`. Les tests fixent leurs dates.
- **Base partagée entre tests de bout en bout** : chaque test crée ses
  propres données (ses dates, loin des autres, ses noms) et ne dépend ni
  de l'ordre ni des données de démo qu'il ne crée pas lui-même, sauf les
  comptes de démonstration.
- Messages d'erreur : vérifier le `detail` du 422 en entier, c'est ce que
  lit l'utilisateur.
- Pas de `Thread.sleep`, pas de réseau réel (une source externe se
  remplace par une fausse, comme `GenerationSaisonTest`).
- Ne jamais supprimer, affaiblir ni `@Disabled` un test pour passer.

## 4. Remettre au propre le code touché

Sur chaque fichier modifié (backend et frontend) et ses voisins immédiats :
- doublons → une seule fonction ; méthodes trop longues → découpées ;
- noms trompeurs → renommés (en français, comme le reste) ;
- code mort, imports inutiles, commentaires périmés → supprimés ;
- côté Angular : conventions de CLAUDE.md (signaux, standalone, dialogues).

Pas de refonte hors du périmètre touché. Si le nettoyage est gros, il va
dans le commit de refactorisation (étape 2) plutôt que dans celui de la
fonctionnalité.

## 5. Résumé

Dans le compte rendu à l'utilisateur, dire : les domaines migrés (et le
commit), les tests écrits (vus rouges puis verts), ce qui a été nettoyé,
et ce qui reste dans `DOMAINES_EN_COUCHES`. Test et code partent dans le
même commit, `mvn test` vert.
