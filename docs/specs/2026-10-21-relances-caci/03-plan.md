# Plan : Relances automatiques des CACI qui arrivent à échéance

- **Statut :** approuvé (Dimitri, Design et Tech, 2026-10-21) : V99_1, table relance_caci_faite, noms gardés 2 ans dans la trace, bean Clock, H2 isolée pour les tests, adresse retirée du journal de tous les e-mails, recette de CA4 par le test du journal, e-mails en texte brut sans lien. Exécution étape par étape, relecture et commit entre chaque.
- **Spec :** [02-spec.md](02-spec.md)

## UX

Aucun écran ne change (R24, CA34) : pas de route, pas de composant, pas de
dialogue, pas de file hors ligne. Ce qui change pour les gens, c'est leur boîte
aux lettres.

**Moniteur, au téléphone.** Il reçoit un e-mail en texte brut (comme les liens
de mot de passe aujourd'hui, `SimpleMailMessage`), sujet court et lisible dans
une liste de notifications : `Votre CACI expire le 20/11/2026`, puis, le
dernier jour, `Votre CACI expire aujourd'hui, le 20/11/2026`. Aucun lien dans le
corps (R18) : rien à toucher, aucune cible tactile. S'il ouvre l'appli pour
vérifier, « Mon compte » montre la même date qu'avant, avec la mention déjà
présente « date saisie par un administrateur, à qui remettre un nouveau
certificat ».

**Administrateur.** Les seuls jours où une échéance tombe, un récapitulatif en
texte brut, une rubrique par situation, rubriques vides omises (R15) :

```
CACI à suivre : récapitulatif du 21/10/2026
─────────────────────────────────────────
Bonjour Claire,

Voici les CACI à suivre au 21/10/2026.

CACI qui expirent bientôt :
- Lemaire Hugo, élève, valable jusqu'au 20/11/2026

CACI qui expirent aujourd'hui :
- Marin Paul, moniteur, valable jusqu'au 21/10/2026

Sans CACI renseigné :
- Vidal Tom, moniteur

Les élèves ne reçoivent aucun message : …
```

Il agit ensuite dans les écrans existants : `/admin/eleves` ou `/admin/moniteurs`,
filtre « CACI → À vérifier », carte de la personne, saisie du nouveau CACI dans
le dialogue existant (`app-saisie-caci`). La trace n'a pas d'écran (Q7).

**Hors ligne :** sans objet (traitement serveur ; la lecture de la trace est une
route d'API sans écran).

## Solution technique

### Où vit le code

Nouveau sous-paquet `fr.club.plongee.notification.relance` (la Javadoc de
`ServiceNotification` annonce déjà que « les relances automatiques … s'y
brancheront » ; la règle `comptes.md` couvre `notification/**`) :

| Classe | Rôle | Modèle existant |
|---|---|---|
| `CalculRelancesCaci` | calcul pur, sans Spring : personnes du périmètre + relances déjà faites + D → relances dues, rubriques du récapitulatif (R2, R5 à R8, R11, R12) | `sejour/FraisSejour`, `FeuilleSecurite` (calcul pur testé à part) |
| `TextesRelancesCaci` | textes exacts R13, R14, R15 (tri `Collator` français, force primaire : ni casse ni accents ; rubriques vides omises) | — |
| `RelancesCaciService` | `executer(LocalDate jour)` : lit le périmètre, appelle le calcul, envoie, trace, journalise (R9, R10, R16, R17, R19, R20, R22) ; `lireTrace()` | `sejour/CartesEmbarquementService` (`NamedParameterJdbcTemplate`, méthode datée appelée par la tâche planifiée) |
| `DeclencheurRelancesCaci` | `@Scheduled(cron = "0 0 7 * * *", zone = "Europe/Paris")`, horloge injectée | `CartesEmbarquementService.effacerChaqueNuit` (3 h 30), `AttestationsAssuranceService` (3 h 35) |
| `admin/AdminRelancesCaciController` | `GET /api/admin/relances-caci` | `admin/AdminMoniteurController` |

La constante du délai va dans `commun/Caci.java`, à côté de `finValidite`, le
pendant serveur de `core/caci.ts` :

```java
/** Délai « bientôt échu » : même valeur que JOURS_AVANT_ECHEANCE de core/caci.ts (écran), figée des deux côtés (R2). */
public static final int JOURS_AVANT_ECHEANCE = 30;
```

### Le traitement quotidien de 7 h et son horloge (R22, CA31, CA32)

- Les tâches de nuit existantes appellent `Calendrier.aujourdhui()` dans la
  méthode `@Scheduled`, puis une méthode publique qui reçoit la date
  (`effacerApresLeSejour(LocalDate)`, testée directement dans
  `CarteEmbarquementTest`). On garde ce découpage : `executer(LocalDate jour)`
  porte toute la logique et sert aux tests (R22 « D en paramètre »).
- Nouveauté demandée par Q17 : l'horloge du déclenchement est remplaçable.
  - `Calendrier.aujourdhui(Clock horloge)` : `LocalDate.ofInstant(horloge.instant(), ZONE_CLUB)` ;
    `aujourdhui()` délègue à `aujourdhui(Clock.systemUTC())` (comportement inchangé).
  - Un bean `Clock` (`config/HorlogeConfig`, `Clock.systemUTC()`), injecté par
    constructeur dans `DeclencheurRelancesCaci(Clock horloge, RelancesCaciService relances)`.
  - `declencher()` : `relances.executer(Calendrier.aujourdhui(horloge))`.
- Tests :
  - CA31, test unitaire sans Spring : lire par réflexion l'annotation
    `@Scheduled` de `declencher()` (cron et zone réellement utilisés), la passer
    à `CronExpression.parse(...).next(...)` depuis le 24/10/2026 08 h 00 à
    Paris ; attendus : 25/10/2026 07 h 00 (06 h 00 UTC, passage à l'heure
    d'hiver le 25/10) puis 26/10/2026 07 h 00.
  - CA32, dans le contexte Spring des relances : `new DeclencheurRelancesCaci(
    Clock.fixed(Instant.parse("2026-10-20T22:30:00Z"), ZoneOffset.UTC), relances).declencher()`
    avec le vrai service. Pas de bean `Clock` remplacé, donc pas de contexte
    Spring de plus.
- Planificateur : `@EnableScheduling` est déjà sur `PlongeeApplication` (mettre à
  jour sa Javadoc, qui ne cite que les cartes d'embarquement). Fil unique par
  défaut, aucun chevauchement avec 3 h 30 et 3 h 35.

### Envoi des e-mails et tests sans SMTP

- Par `ServiceNotification.envoyerCourriel(adresse, sujet, corps)`, qui renvoie
  déjà `false` sur échec (`ServiceNotificationEmail` attrape l'exception SMTP) :
  « parti » = `true` (Q13). Aucune méthode ajoutée à l'interface : les faux de
  `LectureNoteTest`, `FraisParticipantsTest`, `PretsSejourTest` restent tels
  quels.
- En profil `dev`, `ServiceNotificationConsole.envoyerCourriel` écrit déjà
  `Courriel pour {adresse} : {sujet}\n{corps}` et renvoie `true` : R23 est
  satisfait sans code, et tracé comme parti.
- Tests :
  - Une fausse messagerie partagée, `FausseMessagerie` (classe de test
    `@TestConfiguration`, bean `@Primary ServiceNotification`, sur le modèle de
    `LectureNoteTest.FauxLecteur` et `FraisParticipantsTest.BoiteAuxLettres`).
    Elle enregistre chaque message (adresse, sujet, corps) dans une liste et
    refuse les adresses d'un ensemble `refusees` (CA21, CA22, CA23). Elle est
    vidée en `@BeforeEach`.
  - Le journal `dev` (CA4, seconde phrase) se vérifie dans le contexte par
    défaut, sans faux, avec `OutputCaptureExtension` de Spring Boot.
- **Écart trouvé dans l'existant (R17)** : `ServiceNotificationEmail.envoyerCourriel`
  journalise `Échec de l'envoi du courriel à {adresse}`. R17 interdit l'adresse
  dans le journal d'un échec de relance. Proposition : retirer l'adresse de
  cette ligne pour tous les e-mails (les appelants signalent déjà l'échec à
  leur façon), avec le test `ServiceNotificationEmailTest` (unitaire, faux
  `JavaMailSender` qui lève une exception, `OutputCaptureExtension`). À valider
  par Tech (voir « À trancher »).

### Données : migration Flyway

**Numéro.** La plus grande migration de schéma est `V99__sejour_attestation_assurance.sql`.
Le skill `nouvelle-migration` impose un numéro « sous 100 », et `V100` à `V129`
sont pris par `db/demo` (profil `dev`). Proposition : **`V99_1__relances_caci.sql`**
(version Flyway 99.1, entre V99 et V100 : en production on passe de 99 à 99.1 ;
en `dev` la base H2 est en mémoire et rejoue tout dans l'ordre). Il faut
confirmer que `V99` est bien sur `origin/master`, et compléter le skill
`nouvelle-migration` avec la suite `V99_n` (décision Tech).

**Deux usages, deux jeux de tables**, parce que R19 interdit de mettre F dans
la trace, alors que R8 (CA7, CA8 : une nouvelle F ouvre un nouveau cycle) ne
peut pas se décider sans F :

```sql
-- Trace des e-mails de relance CACI partis (R19), lue par GET /api/admin/relances-caci (ADMIN).
-- Ajout seul, supprimée 2 ans après l'envoi (R20) : pas d'Envers (audit.md).
-- Noms recopiés (pas de clé étrangère) : la trace dit à qui on a écrit ce jour-là.
CREATE TABLE relance_caci_envoi (
    id                   BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    envoye_le            DATE         NOT NULL,          -- D, date du club (R22)
    destinataire_nom     VARCHAR(100) NOT NULL,
    destinataire_prenom  VARCHAR(100) NOT NULL,
    destinataire_email   VARCHAR(255) NOT NULL
);
CREATE INDEX idx_relance_caci_envoi_date ON relance_caci_envoi (envoye_le);

CREATE TABLE relance_caci_envoi_personne (
    envoi_id  BIGINT       NOT NULL REFERENCES relance_caci_envoi(id) ON DELETE CASCADE,
    ordre     INT          NOT NULL,
    nom       VARCHAR(100) NOT NULL,
    prenom    VARCHAR(100) NOT NULL,
    PRIMARY KEY (envoi_id, ordre)
);

-- Relances déjà faites, pour n'en faire qu'une par personne, par F et par moment (R8),
-- et rubrique « Sans CACI renseigné » au plus une fois par semaine (R12).
-- Jamais exposée par l'API. Lignes BIENTOT/JOUR_J supprimées dès que F < D
-- (plus rien n'est dû, R7), lignes SANS_CACI au-delà de 7 jours.
CREATE TABLE relance_caci_faite (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    utilisateur_id  BIGINT      REFERENCES utilisateur(id) ON DELETE CASCADE,
    eleve_id        BIGINT      REFERENCES eleve(id) ON DELETE CASCADE,
    moment          VARCHAR(10) NOT NULL CHECK (moment IN ('BIENTOT', 'JOUR_J', 'SANS_CACI')),
    fin_validite    DATE,
    faite_le        DATE        NOT NULL,
    CHECK ((utilisateur_id IS NULL AND eleve_id IS NOT NULL) OR (utilisateur_id IS NOT NULL AND eleve_id IS NULL)),
    CHECK ((moment = 'SANS_CACI' AND fin_validite IS NULL) OR (moment <> 'SANS_CACI' AND fin_validite IS NOT NULL)),
    -- La double relance est impossible en base (R8, R22) ; NULL distincts : SANS_CACI non concerné.
    CONSTRAINT uk_relance_caci_moniteur UNIQUE (utilisateur_id, fin_validite, moment),
    CONSTRAINT uk_relance_caci_eleve    UNIQUE (eleve_id, fin_validite, moment)
);
```

- SQL compatible H2 et PostgreSQL (types du skill ; pas d'`ON CONFLICT`). Le
  développeur aligne les longueurs sur `utilisateur.nom/prenom/email` et
  `eleve.nom/prenom`.
- **Pas d'Envers** : tables en ajout seul (hors purge), sans entité JPA. Accès en
  SQL par `NamedParameterJdbcTemplate`, comme le séjour et
  `CartesEmbarquementService` (donc rien à valider par `ddl-auto: validate`).
- Une relance de moniteur est inscrite dans `relance_caci_faite` quand son
  e-mail est parti. Une relance d'élève et une citation « Sans CACI renseigné »
  le sont quand le récapitulatif est parti vers au moins un administrateur
  (R16, R17).
- Rien en démo (`db/demo`) : pas d'écran à rendre visible, et la recette passe
  par le journal (R23).

### Déroulé de `executer(D)`

1. Purge R20 : supprime les envois dont `envoye_le + 2 ans < D`. Le calcul de
   la date se fait en Java, avec `plusYears(2)` comme `Caci.finValidite` :
   l'arithmétique d'intervalles diffère entre H2 et PostgreSQL. Purge aussi
   `relance_caci_faite` (F < D ; SANS_CACI de plus de 7 jours).
2. Périmètre, lu en quelques requêtes groupées (pas de N+1) :
   - moniteurs : rôle `MONITEUR` et `estActifLe(D)` (R3). C'est le rôle, pas
     `estMoniteur()`, qui exige aussi un niveau d'encadrement.
   - élèves : saison `findFirstByOuverteTrueOrderByDateDebutDesc()`, dossiers
     `archive_le IS NULL` rattachés par un cursus ou une adhésion (R4), moins
     ceux dont `utilisateur_id` est un moniteur du périmètre (R5) ;
   - administrateurs : rôle `ADMIN` et `estActifLe(D)` (R10) ;
   - relances déjà faites de ces personnes.
3. `CalculRelancesCaci` décide de ce qui est dû.
4. E-mails des moniteurs : chacun dans son propre `try` logique (R16 : un échec
   n'arrête rien). Envoi, puis écriture de la trace et de `relance_caci_faite`
   dans une courte transaction (`TransactionTemplate`). Échec :
   `log.error("Relances CACI du {} : un e-mail de relance à un moniteur n'a pas pu partir.", D)`.
5. Récapitulatif, si au moins une relance est due (R11) : un e-mail par
   administrateur. Ensuite, si au moins un est parti, les relances d'élèves et
   les citations « Sans CACI » sont marquées faites, avec une ligne de trace
   par administrateur atteint. Sinon, l'une des deux lignes d'erreur de R17,
   sans donnée personnelle.

`executer` n'est pas `@Transactional` d'un bloc : un e-mail parti ne se
« rollback » pas. Écrire la trace juste après chaque envoi limite la fenêtre
où un envoi serait fait sans être noté.

### API

- `GET /api/admin/relances-caci`, `@PreAuthorize("hasRole('ADMIN')")`. Le chemin
  est déjà restreint par `/api/admin/**` dans `SecurityConfig` (redondance
  délibérée, comme `AdminMoniteurController`). Pas d'habilitation par niveau
  (R21). Aucun `POST`/`PUT`/`DELETE` : Spring répond 405 (CA30).
- Vues (records dans le contrôleur, comme `MoniteurVue`) :
  ```java
  public record RelanceCaciVue(LocalDate envoyeLe, String destinataireNom, String destinatairePrenom,
                               String destinataireEmail, List<PersonneRelanceeVue> personnes) {}
  public record PersonneRelanceeVue(String nom, String prenom) {}
  ```
  Ordre : `envoye_le DESC, id DESC`. Personnes chargées par une seule requête
  `WHERE envoi_id IN (:ids)`. Pas de pagination (quelques lignes par jour,
  2 ans au plus).
- Aucune `RegleMetierException` : route en lecture, sans paramètre (la spec ne
  prévoit pas de 422).

### Front

- Aucun changement de comportement. `core/caci.spec.ts` (« bientôt (30 jours) »)
  reste inchangé et fige la valeur de l'écran (CA33). On propose seulement un
  commentaire de renvoi dans `core/caci.ts` au-dessus de `JOURS_AVANT_ECHEANCE`
  (« même valeur côté serveur : `Caci.JOURS_AVANT_ECHEANCE`, figée par
  `CalculRelancesCaciTest` »).
- Manuels : à l'étape 7 seulement, quand les e-mails partent pour de vrai.

### Données personnelles

| Donnée | Qui la voit | Durée |
|---|---|---|
| E-mail R13/R14 : prénom, F | le moniteur lui-même | sa boîte |
| Récapitulatif R15 : nom, prénom, élève/moniteur, F, des élèves (dont mineurs) et des moniteurs | chaque ADMIN actif | sa boîte |
| Trace : date, nom, prénom, e-mail du destinataire, nom et prénom des personnes citées | ADMIN, par l'API | 2 ans (R20) |
| `relance_caci_faite` : id de la personne, moment, F, date | personne (non exposée) | jusqu'à F < D, ou 7 jours |
| Journal : lignes R17 sans nom, adresse ni date de CACI ; en `dev` seulement, le texte complet (R23) | exploitant | rotation des journaux |

Rien du certificat (date d'examen, médecin, cases) n'est lu par le calcul ni
écrit nulle part. Les textes ne reçoivent que prénom, nom, mention, F et D :
c'est la signature des méthodes de `TextesRelancesCaci` qui le garantit, et
CA24 le vérifie.

**`relecteur-donnees-personnelles` : oui**, avant le commit des étapes 4, 5 et 6
(schéma et e-mails, récapitulatif avec des noms de mineurs, exposition par
l'API), puis une passe finale sur tout le diff avant l'étape 7. Points à lui
soumettre : la table `relance_caci_faite`, qui garde F en dehors de la trace ;
les noms recopiés dans la trace, qui survivent 2 ans à la suppression d'un
dossier ; la ligne de journal de `ServiceNotificationEmail`.

## Alternatives écartées

- **Une seule table de trace qui porte aussi F et le moment** (ce que l'intention
  envisageait : « pour ne pas relancer deux fois ») : R19 interdit F, la mention
  et le sujet dans la trace. Sans F, CA8 échoue : la relance du 21/10 tombe
  dans la nouvelle fenêtre et bloquerait la nouvelle relance « bientôt ».
- **Colonnes « relancé le » sur `utilisateur` et `eleve`, remises à zéro quand
  F change** : ces entités sont `@Audited`. Chaque relance créerait une
  révision Envers sans auteur, et la remise à zéro devrait être faite dans
  chaque chemin d'écriture du CACI (création, modification, dossier élève). En
  oublier un, c'est un cycle qui ne repart pas.
- **Remplacer le bean `Clock` par un `@Primary` de test** (comme
  `GenerationSaisonTest` pour le calendrier scolaire) : cela crée un contexte
  Spring de plus pour un seul test. Construire le déclencheur à la main avec
  `Clock.fixed` teste la même chose.
- **Migration `V130__…` dans `db/migration`** : possible, car Flyway accepte les
  trous, mais les suites schéma et démo s'entremêleraient (la prochaine démo
  devrait sauter à V131). Garde-la si Tech préfère abandonner la règle « sous
  100 ».

## Découpage

Chaque étape est un commit qui laisse `mvn test` et `npm test -- --watch=false`
verts. Jusqu'à l'étape 7, rien n'appelle le traitement en production : aucun
changement visible, donc ni manuel ni vidéo : le code existe mais n'est pas
encore branché.

**Données des tests d'intégration.** La base de test est partagée, et la démo
est datée par rapport au jour du lancement (Gwendoline et Hugo à J-12). Un
contrôle exact (« exactement deux récapitulatifs », « corps exact »,
« aucun administrateur actif ») y est donc impossible. Proposition :
- Les tests d'intégration des relances tournent sur une base H2 à eux, avec
  `@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:relances-caci;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")`
  et `@Import(FausseMessagerie.class)`, configuration identique dans les trois
  classes pour qu'elles partagent un seul contexte en cache. La démo y est
  rejouée (profil `dev`), donc `presidente@club.fr` crée les comptes comme
  dans l'écran Moniteurs.
- Les dates de ces tests sont posées **dans le passé**, avec une ancre propre à
  chaque test (par exemple `Calendrier.aujourdhui().minusYears(3).plusDays(40 * n)`).
  Ainsi les dates d'examen restent acceptées par `Caci.verifier()` (CA7 : un
  examen au 30/10/2026 serait refusé aujourd'hui), loin des dates de la démo.
- Les textes exacts et les dates littérales de la spec (Paul Marin, 21/10/2026)
  sont vérifiés dans les tests purs (étapes 1 et 2), et en intégration par
  CA32, avec un compte qui lui est propre.
- Les états qui ne passent pas par une route (fin d'accès d'un moniteur,
  dossier élève rattaché à un compte, désactivation provisoire de Claire pour
  CA20) se posent en SQL dans le test et se remettent en place en `finally`.

1. **Délai et calcul des relances (règle pure)**. Tests à écrire d'abord :
   `CalculRelancesCaciTest`, sans Spring (CA33 serveur, CA2, CA3, CA6, CA7,
   CA8, CA12, CA14, CA16, CA17, au niveau de la décision). Fichiers :
   `commun/Caci.java` (constante), `notification/relance/CalculRelancesCaci.java`,
   commentaire de renvoi dans `frontend/src/app/core/caci.ts`. Manuel / vidéo :
   aucun.
2. **Textes exacts des e-mails (règle pure)**. Tests d'abord :
   `TextesRelancesCaciTest` (CA1, CA5, CA15 au mot près, tri sans casse ni
   accents, rubrique vide omise, CA24 au niveau du texte). Fichier :
   `notification/relance/TextesRelancesCaci.java`. Manuel / vidéo : aucun.
3. **Journal d'échec d'envoi sans adresse**. Test d'abord :
   `ServiceNotificationEmailTest#echecSansAdresseDansLeJournal` (R17). Fichier :
   `notification/service/ServiceNotificationEmail.java`. Manuel / vidéo : aucun
   (journal serveur).
4. **Table des relances et e-mails aux moniteurs**. Tests d'abord :
   `RelancesCaciMoniteursTest` (CA1, CA2, CA3, CA4, CA5 à CA9, CA21 pour le
   moniteur, CA33 en intégration) et `RelancesCaciJournalDevTest` (CA4,
   journal `dev`). Fichiers : `db/migration/V99_1__relances_caci.sql`,
   `RelancesCaciService.java` (partie moniteurs), test `FausseMessagerie.java`,
   skill `nouvelle-migration` (suite `V99_n`), `.claude/rules/comptes.md` (les
   relances passent par `envoyerCourriel`). Relecteur données personnelles
   avant le commit. Manuel / vidéo : aucun.
5. **Récapitulatif aux administrateurs**. Tests d'abord :
   `RelancesCaciRecapitulatifTest` (CA10 à CA20, CA21 pour la rubrique, CA22,
   CA23, CA24). Fichiers : `RelancesCaciService.java` (élèves, sans CACI,
   administrateurs, R16 et R17). Relecteur avant le commit. Manuel / vidéo :
   aucun.
6. **Consultation et conservation de la trace**. Tests d'abord :
   `ConservationTraceRelancesTest` (pur : 21/10/2026 gardée le 21/10/2028,
   supprimée le 22/10/2028 ; 29/02/2028 supprimée le 01/03/2030 ; 28/02/2030
   supprimée le 29/02/2032) et `TraceRelancesCaciTest` (CA25 à CA30).
   Fichiers : `admin/AdminRelancesCaciController.java`, `RelancesCaciService`
   (`lireTrace`, purge). `.claude/rules/donnees-personnelles.md` : la trace, son
   contenu, sa durée. Relecteur avant le commit. Manuel / vidéo : aucun (la
   trace n'est pas décrite, spec « Manuels »).
7. **Déclenchement chaque jour à 7 h, et manuels**. Tests d'abord :
   `DeclencheurRelancesCaciTest` (CA31, unitaire) et
   `RelancesCaciMoniteursTest#fuseauDuClub` (CA32). Fichiers :
   `config/HorlogeConfig.java`, `commun/Calendrier.java`
   (`aujourdhui(Clock)`), `DeclencheurRelancesCaci.java`, Javadoc de
   `PlongeeApplication`. **Manuels** dans le même commit, avec texte,
   questions et mots-clés :
   - `mon-compte.md` : question « Pourquoi ai-je reçu un e-mail sur mon CACI ? »,
     mots-clés `relance`, `rappel`, `e-mail`, `expiration` ;
   - `ajouter-un-moniteur.md` ;
   - `dossier-eleve.md` et `infos-eleves.md` ;
   - `administration.md` : le récapitulatif, quand il part, ce qu'il contient,
     « Sans CACI renseigné » au plus une fois par semaine.

   **Vidéos : aucune** (spec, Q7). Vérification CA34 dans le navigateur
   (`lancer-appli`). Note dans `docs/decisions/` (choix des tables, du numéro
   de migration, de l'horloge). Passe finale du relecteur sur l'ensemble.

## Matrice critères → tests

| CA | Test (classe#méthode, `@DisplayName`) | Étape |
|---|---|---|
| CA1 | `TextesRelancesCaciTest#relanceBientot` « L'e-mail à J-30 dit mot pour mot que le CACI expire le 20/11/2026 » ; `RelancesCaciMoniteursTest#relanceAJMoins30` « Un moniteur reçoit un seul e-mail 30 jours avant la fin de son CACI » | 2, 4 |
| CA2 | `CalculRelancesCaciTest#rienAvantJMoins30` « À F − 31 jours, aucune relance n'est due » ; `RelancesCaciMoniteursTest#rienAvantJMoins30` « Rien ne part ni n'est tracé la veille de J-30 » | 1, 4 |
| CA3 | `CalculRelancesCaciTest#uneSeuleRelanceBientot` « Une relance bientôt déjà faite pour cette F n'est plus due jusqu'à F − 1 » ; `RelancesCaciMoniteursTest#uneSeuleRelanceBientot` « Rejouer le traitement chaque jour jusqu'à F − 1 n'envoie rien de plus au moniteur » | 1, 4 |
| CA4 | `RelancesCaciMoniteursTest#rattrapageDansLaPeriode` « Un moniteur jamais relancé à F − 12 reçoit l'e-mail bientôt » ; `RelancesCaciJournalDevTest#journalDev` « En dev, le journal montre l'e-mail de relance adressé à e3@club.fr » | 4 |
| CA5 | `TextesRelancesCaciTest#relanceJourJ` « L'e-mail du jour J dit mot pour mot que le CACI expire aujourd'hui » ; `RelancesCaciMoniteursTest#relanceJourJ` « Le dernier jour de validité, le moniteur reçoit l'e-mail du jour J » | 2, 4 |
| CA6 | `CalculRelancesCaciTest#rienApresJ` « Après F, ni relance ni rattrapage d'un jour J manqué » ; `RelancesCaciMoniteursTest#rienApresLeJourJ` « Après le jour J, plus rien, même si le jour J a été manqué ou le CACI déjà expiré » | 1, 4 |
| CA7 | `CalculRelancesCaciTest#renouvellementNouveauCycle` « Une nouvelle F ouvre un nouveau cycle ; l'ancienne F ne déclenche plus rien » ; `RelancesCaciMoniteursTest#renouveleEntreDeux` « Renouvelé entre J-30 et J : pas de jour J, relances de la nouvelle F » | 1, 4 |
| CA8 | `CalculRelancesCaciTest#dateCorrigee` « Une date d'examen corrigée donne une nouvelle relance bientôt » ; `RelancesCaciMoniteursTest#dateExamenCorrigee` « Date d'examen corrigée dans la période : nouvelle relance bientôt, puis jour J de la nouvelle F, rien pour l'ancienne » | 1, 4 |
| CA9 | `RelancesCaciMoniteursTest#moniteurInactif` « Un moniteur désactivé ou dont l'accès est terminé n'est ni relancé ni cité » | 4 |
| CA10 | `RelancesCaciRecapitulatifTest#moniteurSansCaci` « Un moniteur sans CACI ne reçoit rien et figure sous Sans CACI renseigné » | 5 |
| CA11 | `RelancesCaciRecapitulatifTest#eleveJamaisEcrit` « Un élève ne reçoit jamais d'e-mail, même avec une adresse » | 5 |
| CA12 | `CalculRelancesCaciTest#eleveAJMoins30EtAJ` « Un élève est cité à J-30 sous bientôt, à J sous aujourd'hui, jamais entre les deux » ; `RelancesCaciRecapitulatifTest#eleveAuRecapitulatif` (même règle de bout en bout) | 1, 5 |
| CA13 | `RelancesCaciRecapitulatifTest#perimetreDesEleves` « Seuls les élèves non archivés de la saison ouverte, par formation ou adhésion, sont cités » | 5 |
| CA14 | `CalculRelancesCaciTest#moniteurEtEleve` « Un dossier élève rattaché à un moniteur du périmètre est ignoré » ; `RelancesCaciRecapitulatifTest#moniteurAussiEleve` « Moniteur aussi élève de la saison : une seule relance, de moniteur » | 1, 5 |
| CA15 | `TextesRelancesCaciTest#recapitulatifExact` « Le récapitulatif reprend mot pour mot les rubriques bientôt, aujourd'hui et Sans CACI, sans rubrique vide » ; `RelancesCaciRecapitulatifTest#recapitulatifDeBoutEnBout` « Claire reçoit un récapitulatif avec les lignes de chaque rubrique » | 2, 5 |
| CA16 | `CalculRelancesCaciTest#pasDeRecapitulatifSansEcheance` « Sans relance due, pas de récapitulatif même s'il y a des personnes sans CACI » ; `RelancesCaciRecapitulatifTest#pasDeRecapitulatifSansEcheance` | 1, 5 |
| CA17 | `CalculRelancesCaciTest#sansCaciUneFoisParSemaine` « Une personne sans CACI n'est citée qu'une fois sur 7 jours » ; `RelancesCaciRecapitulatifTest#sansCaciUneFoisParSemaine` | 1, 5 |
| CA18 | `RelancesCaciRecapitulatifTest#unRecapitulatifParAdministrateurActif` « Chaque administrateur actif reçoit le sien ; ni le compte désactivé ni le directeur technique non ADMIN » | 5 |
| CA19 | `RelancesCaciRecapitulatifTest#administrateurMoniteur` « Un administrateur moniteur reçoit son e-mail de moniteur et le récapitulatif » | 5 |
| CA20 | `RelancesCaciRecapitulatifTest#sansAdministrateurActif` « Sans administrateur actif : le moniteur est relancé, l'erreur est journalisée sans nom, l'élève reste dû » | 5 |
| CA21 | `RelancesCaciMoniteursTest#echecEmailMoniteur` « E-mail refusé : pas de trace, journal sans adresse, nouvel essai le lendemain » ; `RelancesCaciRecapitulatifTest#moniteurInjoignableAuRecapitulatif` « Le moniteur injoignable figure dans sa rubrique du récapitulatif » | 4, 5 |
| CA22 | `RelancesCaciRecapitulatifTest#recapitulatifRefusePartout` « Récapitulatif refusé partout : erreur journalisée, élèves cités le lendemain, une seule trace » | 5 |
| CA23 | `RelancesCaciRecapitulatifTest#recapitulatifRecuParUnSeul` « Récapitulatif reçu par un seul administrateur : l'élève compte comme relancé » | 5 |
| CA24 | `TextesRelancesCaciTest#aucunContenuDuCertificat` ; `RelancesCaciRecapitulatifTest#aucunContenuDuCertificat` « Aucun e-mail ne contient la date d'examen, le médecin, les cases, la licence, la naissance, le téléphone, le contact d'urgence, ni l'adresse d'un autre » | 2, 5 |
| CA25 | `TraceRelancesCaciTest#contenuDeLaTrace` « La trace ne renvoie que date, destinataire et noms des personnes concernées » | 6 |
| CA26 | `ConservationTraceRelancesTest#deuxAns` « Une trace est supprimée le lendemain de ses deux ans, 29 février compris » ; `TraceRelancesCaciTest#effaceeApresDeuxAns` | 6 |
| CA27 | `TraceRelancesCaciTest#consultationParLAdministrateur` « Un administrateur lit la trace, du plus récent au plus ancien » | 6 |
| CA28 | `TraceRelancesCaciTest#refusDeRole` « 403 pour moniteur, TIV, sécurité surface et élève ; 401 sans jeton » | 6 |
| CA29 | `TraceRelancesCaciTest#niNiveauNiDirecteurTechnique` « Ni le niveau E3 ni le rôle de directeur technique ne donnent accès à la trace » | 6 |
| CA30 | `TraceRelancesCaciTest#niEcritureNiDeclenchement` « POST, PUT et DELETE sur la trace ne sont jamais acceptés et ne la changent pas » | 6 |
| CA31 | `DeclencheurRelancesCaciTest#chaqueJourA7hHeureDeParis` « Le déclenchement suit 7 h à Paris, passage à l'heure d'hiver compris » | 7 |
| CA32 | `RelancesCaciMoniteursTest#fuseauDuClub` « À 22 h 30 UTC le 20/10, le traitement prend la date du club, le 21/10 » | 7 |
| CA33 | `caci.spec.ts` existant, inchangé (écran) ; `CalculRelancesCaciTest#delaiDe30Jours` « Relance bientôt due à F = D + 30, pas à F = D + 31 » ; `RelancesCaciMoniteursTest#delaiDe30JoursDeBoutEnBout` | 1, 4 |
| CA34 | Affichage pur : vérifié dans le navigateur (`lancer-appli`) sur `/admin/eleves`, `/admin/moniteurs`, `/eleves`, `/mon-compte` avec la démo, avant et après | 7 |

## Risques

- **Numéro de migration.** La suite « sous 100 » est épuisée (V99). `V99_1`
  s'applique bien après V99 en production. À vérifier à la validation : que
  `flyway_schema_history` de la production s'arrête à 99 (aucune migration
  appliquée hors ordre), et que `mvn test` rejoue tout sur une H2 neuve.
  Aucune donnée existante n'est transformée.
- **Premier passage en production.** R6 rattrape d'un coup toutes les personnes
  dans leur fenêtre de 30 jours, et R12 cite tous les « Sans CACI » : le premier
  récapitulatif sera long. Il faut prévenir le club.
- **Tests dépendants de la date.** La démo est relative au jour du lancement.
  Il faut des ancres dans le passé, une base isolée, et des états posés en SQL
  remis en place en `finally` (Claire désactivée pour CA20, administrateurs
  créés par CA18 et CA19). Un oubli rend les contrôles « exactement » fragiles
  selon l'ordre des tests. À regarder de près à la validation.
- **Tâche planifiée pendant les tests.** Si la suite tourne à 7 h 00 heure de
  Paris, la vraie tâche se déclenche dans le contexte de test. Les tâches de
  3 h 30 et 3 h 35 ont déjà ce risque ; il est sans gravité ici (fausse
  messagerie ou console).
- **E-mail parti puis base en échec.** Si l'écriture de la trace échoue après
  un envoi accepté, l'e-mail repartira le lendemain. C'est la fenêtre réduite
  par une transaction courte par envoi ; le blocage par la contrainte d'unicité
  empêche toute boucle.
- **Tensions de la spec à surveiller, sans les trancher ici.**
  - R16 contre R8 : un moniteur dont l'e-mail échoue est cité ce jour-là, puis
    cité de nouveau le jour où l'e-mail passe.
  - R22 « rejouer le même D n'envoie rien de plus » : faux si un e-mail de
    moniteur avait échoué au premier passage et passe au second.
  - R5 : un dossier élève rattaché à un moniteur **inactif** est traité comme
    élève (lecture littérale).
- **Droits.** `/api/admin/**` est déjà ADMIN dans `SecurityConfig`, et
  `@PreAuthorize` est en redondance. CA28 et CA29 doivent couvrir chaque compte
  de démo cité.
- **Journal.** Modifier la ligne d'erreur de `ServiceNotificationEmail` touche
  tous les e-mails. Il faut vérifier qu'aucun appelant ni aucune exploitation
  (`DEPLOIEMENT.md`) ne repose sur l'adresse dans cette ligne.
- **Données personnelles.**
  - Noms de mineurs dans le récapitulatif envoyé à tous les ADMIN (voulu par la
    spec).
  - Noms recopiés dans la trace pendant 2 ans.
  - F conservée dans `relance_caci_faite`, hors de la trace.

  Les trois passent par le relecteur.

## À trancher

**Tech**
1. Migration `V99_1__relances_caci.sql` (et la suite `V99_n` dans le skill
   `nouvelle-migration`), ou `V130__…`.
2. La table technique `relance_caci_faite`, qui garde F hors de la trace :
   indispensable pour R8 et CA8. Avis du relecteur requis ; s'il la refuse,
   c'est une question à renvoyer à la spec, pas au code.
3. Noms recopiés dans la trace, qui survivent à la suppression d'un dossier,
   ou clé étrangère en cascade, qui efface la ligne avec la personne. La spec
   est muette ; en cas de doute, renvoyer à la spec.
4. Bean `Clock` (`config/HorlogeConfig`) et `Calendrier.aujourdhui(Clock)`,
   nouveaux dans le projet.
5. Base H2 isolée par `@TestPropertySource` pour les tests des relances. C'est
   un nouveau motif de test, qui coûte un contexte Spring de plus.
6. Retrait de l'adresse dans la ligne d'erreur de `ServiceNotificationEmail`,
   pour tous les e-mails.

**Design**
7. La recette en `dev` de CA4 se fait par le test du journal : sans bouton ni
   route (R22), il faudrait sinon laisser l'appli tourner jusqu'à 7 h. Est-ce
   acceptable ?
8. E-mails en texte brut, sans lien, comme les e-mails actuels : à confirmer.
