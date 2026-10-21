---
name: bonnes-pratiques-spring
description: Bonnes pratiques Java 25 / Spring Boot 4 de suivi-plongee (découpage contrôleur-service-dépôt, records de demande et de vue, transactions, JPA sans N+1, sécurité, erreurs, dates, tests MockMvc). À utiliser pour écrire, relire ou refactoriser du code du backend, quand on hésite sur « la bonne façon » de faire ici.
argument-hint: "[classe ou sujet, ex. formation/service/SortieService.java]"
---

# Bonnes pratiques Java / Spring (suivi-plongee)

Ce skill dit **comment écrire** le code du backend. Pour une route : skill
`nouvel-endpoint` (test, droits) ; pour le schéma : `nouvelle-migration`. En
cas de doute, imiter `formation/SortieController.java` et
`formation/service/SortieService.java`.

## 1. Découpage

- Paquet par **domaine** (`fr.club.plongee.<domaine>`), avec `domain/`
  (entités), `repository/`, `service/`, et les contrôleurs à la racine du
  domaine. Ce qui sert partout est dans `commun/`.
- **Contrôleur mince** : droits (`@PreAuthorize`), lecture de la requête,
  appel au service. Aucune règle métier, aucun dépôt injecté.
- **Service** : les règles, les transactions, la conversion entité → vue.
- **Dépôt** : `JpaRepository` + requêtes `@Query` JPQL nommées en français
  (`depuis`, `toutes`, `contenant`), en bloc de texte `"""` si elles font
  plus d'une ligne.

## 2. Style Java

- **Injection par constructeur**, champs `private final`, pas d'`@Autowired`,
  pas de Lombok (absent du projet).
- **`record`** pour tout ce qui entre ou sort : `Demande…` (validé par
  `jakarta.validation` : `@NotBlank`, `@Size(max = …)` aligné sur la colonne,
  `@NotNull`) et `…Vue`. Déclarés dans le service (ou le contrôleur pour un
  petit corps propre à la route). **Jamais une entité JPA en sortie.**
- Java moderne : `var` quand le type est évident, `stream().toList()`,
  `switch` à flèches, motifs (`instanceof X x`), blocs de texte.
- Constantes métier nommées, avec un commentaire qui dit **pourquoi** cette
  valeur (`DUREE_MAX_JOURS = 31` : « plus probablement une erreur de saisie »).
- Javadoc courte en tête de classe : ce que c'est et la règle principale.
  Commentaires sur le *pourquoi*, pas sur le *quoi*.

## 3. Transactions et JPA

- `@Transactional(readOnly = true)` sur chaque lecture du service,
  `@Transactional` sur chaque écriture. `open-in-view: false` : la vue se
  construit **dans** la transaction, jamais dans le contrôleur.
- Une entité chargée et modifiée dans une transaction s'enregistre seule :
  pas de `save` superflu après un `modifier`.
- **Pas de N+1** : une liste qui affiche des liaisons les charge par
  `left join fetch` (avec `distinct`), ou par une requête groupée
  (`where x.id in :ids`) plutôt qu'une requête par ligne.
- Nouvelle liaison en `@ManyToOne(fetch = FetchType.LAZY)` (des anciennes ne
  le sont pas : ne pas les changer en passant, ça déplace des requêtes), collections
  initialisées (`new LinkedHashSet<>()`), invariants protégés par des
  méthodes de l'entité plutôt que des setters exposés.
- `ddl-auto: validate` : toute entité nouvelle ou modifiée a sa migration
  Flyway (skill `nouvelle-migration`). Une contrainte d'unicité ou de clé
  étrangère va **en base**, pas seulement dans le code.
- Entité suivie par l'audit : `@Audited` (et `@NotAudited` justifié en
  commentaire), voir `.claude/rules/audit.md`.

## 4. Sécurité

- `@PreAuthorize` sur **chaque** méthode de contrôleur, puis l'habilitation
  métier (`@habilitation.peutEvaluer(...)`, beans `Droits…`) ou un refus
  dans le service.
- L'utilisateur courant : `@AuthenticationPrincipal UtilisateurPrincipal moi`.
  **L'auteur d'une écriture vient de là**, jamais du corps de la requête.
- Charger une ressource par son id ne suffit pas : vérifier qu'elle
  appartient bien au périmètre de celui qui la demande (son séjour, son
  élève, sa séance).
- Données personnelles : la vue ne contient que ce que l'appelant a le droit
  de voir ; ni champ de santé, ni texte du médecin, photo seulement avec
  `autorisation_image` (`.claude/rules/donnees-personnelles.md`).
- Rien de sensible dans les journaux (pas de jeton, de mot de passe, ni de
  données d'élève) ; `log.error` seulement pour l'imprévu.

## 5. Erreurs

- Refus métier : `throw new RegleMetierException("…")` → 422. Le message est
  une phrase en français **pour l'utilisateur final**, qui dit quoi faire
  (« … : retirez-les d'abord de la sortie. »).
- Ressource absente : `RessourceIntrouvableException` → 404.
- Pas de `try/catch` qui avale une exception ; pas de nouvelle exception ou
  de nouveau `@ExceptionHandler` sans raison : `commun/GestionnaireErreurs`
  produit déjà le `ProblemDetail`.
- Écriture rejouable hors ligne : **idempotente** (référence client unique en
  base), voir `.claude/rules/hors-ligne.md`.

## 6. Dates et temps

- **`Calendrier.aujourdhui()`**, jamais `LocalDate.now()` (le conteneur tourne
  en UTC ; entre minuit et 2 h une séance du jour passerait pour demain).
  Format affiché : `Calendrier.DATE_FR`.
- `LocalDate` pour une date de séance, `Instant` pour un horodatage.

## 7. Tests

- Comportement visible testé **par l'API** : `@SpringBootTest` +
  `@AutoConfigureMockMvc`, profil `dev`, connexion avec un compte de démo
  (modèles : `SortieTest`, `AdhesionTest`). Règle pure : test unitaire sans
  Spring.
- Un test par règle, nommé en français (`@DisplayName("…")`), qui crée ses
  propres données (dates à lui) ; ne jamais modifier `V100__donnees_demo.sql`
  pour un test. Source externe remplacée par une fausse (`GenerationSaisonTest`).
- Droits testés en négatif (403 mauvais rôle, refus d'habilitation) et chaque
  422 avec son `detail` **en entier**.
- Ordre TDD : rouge (pour la bonne raison) → vert → refactoriser, puis la
  classe entière.

## 8. Avant de rendre la main

```bash
cd backend && mvn -q test -Dtest=<LeTest>   # le test de la règle
cd backend && mvn test                      # tout
```

Puis l'agent `relecteur-donnees-personnelles` si la modification touche des
personnes, et la décision structurante notée dans `.claude/rules/<domaine>.md`.
