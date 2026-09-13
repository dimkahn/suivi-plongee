# Contexte du projet

Application de suivi des compétences de plongée pour un club FFESSM. Des
moniteurs bénévoles notent leurs élèves séance par séance, souvent depuis un
téléphone au bord du bassin. Remplace un classeur Google Sheets avec un onglet
par élève.

Backend Java 25 / Spring Boot 4.1 (Maven), frontend Angular 22 standalone,
PostgreSQL en production, H2 en développement. Migrations Flyway. Un
`pom.xml` agrégateur à la racine permet `mvn install` depuis la racine
(le module `frontend` enveloppe `npm ci && ng build` via
frontend-maven-plugin) ; le déploiement reste deux services Docker séparés
(`docker-compose.yml`).

Le code, les commentaires, les noms de classes et les messages d'erreur sont
**en français**. C'est délibéré : les utilisateurs et les futurs contributeurs
sont des moniteurs de club, pas des développeurs professionnels. Garder cette
convention, y compris pour les nouveaux fichiers.

## Commandes

```bash
cd backend && mvn spring-boot:run     # profil dev, H2 + données de démo
cd backend && mvn test                # tests d'intégration
cd frontend && npm install && npm start
```

Le frontend proxifie `/api` vers `localhost:8080` (`proxy.conf.json`).
Comptes de démonstration dans le README, mot de passe `plongee2026`.

## Décisions structurantes — ne pas défaire sans raison

**Le référentiel MFT est en base, pas en dur.** Les codes C1 à C9 sont communs
aux trois niveaux mais leurs intitulés et leurs critères diffèrent d'un niveau
à l'autre. Un `Referentiel` = un niveau + une version datée du MFT ; un
`Cursus` y est figé à l'inscription pour qu'une révision fédérale ne
s'applique pas rétroactivement. Le contenu est généré par
`outils/generer_referentiel.py`, qui produit `V2__referentiel_mft.sql`.
Pour modifier le référentiel : éditer le script Python, régénérer, ajouter une
migration. Ne jamais éditer le SQL généré à la main.

**`evaluation` est une table en ajout seul.** Une correction crée une ligne ;
l'état courant d'un critère est la dernière saisie (le plus grand `id`). Cela
donne l'historique de progression et la traçabilité de qui a noté quoi. Ne pas
introduire d'UPDATE ni de DELETE sur cette table.

**La sécurité se joue à deux niveaux.** Le rôle via `hasRole('MONITEUR')`,
puis l'habilitation métier via
`@habilitation.peutEvaluer(#cursusId, authentication)` qui compare le niveau
d'encadrement de l'utilisateur au niveau exigé par le référentiel (E1 pour le
N1, E2 pour le N2, E3 pour le N3). L'auteur d'une évaluation vient toujours du
`SecurityContext`, jamais du corps de la requête. Les gardes Angular ne sont
que du confort d'affichage.

**Les règles du MFT sont dans le serveur.** `EvaluationService` et
`RegleDelivranceService` comparent des valeurs issues de la table
`referentiel` : milieu naturel exclusif pour N2 et N3, profondeur maximale
d'évolution, âge minimum, brevet prérequis, RIFAP pour le N3, C6 du N2 validée
en dernier. Ajouter une règle = ajouter une colonne au référentiel plutôt
qu'une constante dans le code.

**Le hors ligne passe par une file, pas par un cache d'écriture.** Une
notation est écrite dans IndexedDB avec une référence client (UUID), puis
rejouée par `POST /api/synchronisation/evaluations`, qui répond élément par
élément. La référence est unique en base : rejouer une saisie ne la duplique
pas. Un refus différé remonte au moniteur dans un bandeau, il n'est jamais
absorbé silencieusement.

**L'historique des entités modifiables passe par Envers, pas par un journal
maison.** `Utilisateur`, `Eleve`, `Seance`, `Cursus`, `ValidationCompetence`
et `Delivrance` sont `@Audited` (voir `fr.club.plongee.audit`) : chaque
UPDATE/DELETE crée une ligne dans sa table `*_aud`, rattachée à une ligne de
`revision_audit` qui porte l'auteur (`EcouteurRevisionAudit`, lu du
SecurityContext). Les tables déjà en ajout seul (`evaluation`...) n'ont pas
besoin d'Envers, elles portent déjà leur propre historique. Auditer une
nouvelle entité : ajouter `@Audited`, générer le schéma une fois avec
`ddl-auto=create` sur une base jetable, reprendre le DDL dans une migration
Flyway à la main (les types choisis par H2/Hibernate ne sont pas toujours
ceux qu'on veut en Postgres).

## Conventions

- Pas de `localStorage` ni de `sessionStorage` côté navigateur. Le jeton
  d'accès vit dans un signal Angular, le reste dans IndexedDB
  (`core/base-locale.ts`).
- Composants Angular standalone, signaux plutôt que RxJS pour l'état local,
  template et styles en ligne dans le `.ts`.
- Les erreurs métier lèvent `RegleMetierException` (422) avec un message
  destiné à l'utilisateur final, pas au développeur. Le front affiche le
  champ `detail` du `ProblemDetail` tel quel.
- Cibles tactiles d'au moins 44 px : l'appli se manipule avec les mains
  mouillées.
- Identité visuelle alignée sur celle du club (cppjvo.fr) : palette
  océan/corail, Poppins pour les titres, Nunito pour le texte courant.
  Jetons de design dans `frontend/src/styles.css`. Ne pas introduire de
  bibliothèque de composants.

## Données personnelles

Le club suit des mineurs. Le certificat médical n'est **jamais** stocké,
seulement sa date de fin de validité (`eleve.certificat_valide_jusqu_au`).
Ne pas ajouter de champ de santé, de pièce jointe médicale ni de commentaire
libre sur l'état de santé. `V100__donnees_demo.sql` ne contient que des noms
fictifs et ne doit pas être chargé en production (profil `dev` uniquement).

**Le droit à l'image est un consentement à part entière.** `eleve.autorisation_image`
est distinct de `eleve.autorisation_legale` (qui ne couvre que la pratique).
Une photo (`photo_eleve`, table séparée pour ne jamais alourdir les lectures
courantes d'un élève) n'est ni acceptée en dépôt ni renvoyée par
`EleveController` sans ce consentement explicite ; le retirer supprime la
photo, pas seulement son affichage.

## Chantiers ouverts

1. Import du classeur Google Sheets existant, pour démarrer la saison en cours
   avec les données réelles. Point d'attention : le tableur a un 4ᵉ statut
   (`NA`, non acquis) que `StatutAcquisition` ne représente pas encore.
2. Écran d'administration : inscription des élèves, ouverture de saison faits
   (`/admin/eleves`, `/admin/saisons`, `/admin/cursus`) ; reste l'import d'une
   révision du MFT.
3. Relances automatiques : certificats médicaux qui expirent, RIFAP échus, et
   les 4 plongées en milieu naturel dues par un N1 certifié en piscine.
4. Export PDF de la fiche de suivi d'un élève.
5. Icônes PWA à fournir dans `frontend/public/icones/`.
6. Envoi d'e-mail réel : `ServiceNotificationConsole` se contente de tracer le
   lien de réinitialisation de mot de passe dans les logs (pas de serveur SMTP
   configuré). À remplacer avant la mise en production.

## Avertissement

Ce code a été écrit sans être compilé (Maven Central inaccessible dans
l'environnement de génération). Attendre des ajustements d'imports et de
signatures au premier `mvn spring-boot:run`. Commencer par faire passer
`mvn test` avant d'ajouter des fonctionnalités.
