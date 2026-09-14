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

Pour lancer les deux en une seule commande depuis la racine (un seul
terminal ; le frontend est détaché en arrière-plan, son log est dans
`frontend/frontend-dev.log`) :

```bash
mvn -N -Pdev antrun:run@dev          # démarre frontend + backend
mvn -N -Pdev antrun:run@dev-stop     # arrête le frontend resté en tâche de fond
```

Le frontend proxifie `/api` vers `localhost:8080` (`proxy.conf.json`).
Comptes de démonstration dans le README, mot de passe `plongee2026`.

## Décisions structurantes — ne pas défaire sans raison

**Le référentiel MFT est en base, pas en dur.** Un `Referentiel` = un niveau +
une version datée du MFT ; un `Cursus` y est figé à l'inscription pour qu'une
révision fédérale ne s'applique pas rétroactivement. Le contenu est généré par
`outils/generer_referentiel.py` (un tuple par bloc dans la liste `REFERENTIELS`,
un `INSERT` par version dans une migration Flyway dédiée). Pour modifier le
référentiel : éditer le script Python, régénérer (il réémet tout, y compris les
versions déjà migrées — n'en extraire que la partie neuve pour la nouvelle
migration), ajouter une migration. Ne jamais éditer le SQL généré à la main.
Historiquement les codes de bloc `C1` à `C9` étaient communs aux trois
niveaux (intitulés et critères différents par niveau) — **ce n'est plus
garanti** : la révision PE20 (décembre 2025) du N1 les a abandonnés au profit
de dix compétences nommées, structurées en Technique (des critères, comme
avant) / Comportement / Théorie / Modalités d'évaluation (texte libre, porté
par des colonnes nullable sur `bloc_competence` ajoutées en V7 — vide sur les
blocs des révisions antérieures). Ne pas supposer que `code` a un sens
partagé entre niveaux ou révisions : c'est un simple identifiant unique par
référentiel.

**Le N2 et le N3 se scindent maintenant en plusieurs qualifications.** Les
révisions PA20|PE40 (N2, mai 2026, V8) et PA40|PE60 (N3, décembre 2025, V8)
remplacent chacune un bloc unique de compétences par deux qualifications
(PA20 « plongeur autonome à 20 m » + PE40 « plongeur encadré à 40 m » pour le
N2 ; PA40 + PE60, plus des « compétences complémentaires N3 », pour le N3),
chacune avec ses propres blocs, plus des blocs communs. Le brevet N2/N3 n'est
délivré que quand les qualifications requises sont acquises. **Choix de
modélisation délibéré :** un seul `Referentiel` par niveau, comme avant —
pas un « niveau » à part entière par qualification, ce qui aurait touché
`Cursus`, `HabilitationService`, `RegleDelivranceService` et les écrans
d'admin. Chaque bloc porte juste une étiquette d'affichage dans la colonne
`regroupement` (« Commun », « PA20 », « PE40 », « PA40 », « PE60 », « N3 »,
ajoutée en V8) : il n'y a **aucun suivi séparé** de la progression par
qualification, tout se valide sous un même cursus N2 ou N3. Si le club a
besoin un jour de distinguer formellement « a le PA20 mais pas le PE40 »,
c'est un vrai chantier de modélisation, pas une simple mise à jour du
référentiel. PA60 (plongeur autonome à 60 m, sans DP, obtenu après le N3)
n'est pas importé : hors périmètre du brevet N3 lui-même.

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
   (`/admin/eleves`, `/admin/saisons`, `/admin/cursus`), y compris modification
   des dates d'une saison. Import d'une révision du MFT fait pour N1, N2 et N3
   (V7, V8 — voir la note plus haut sur le N2/N3 scindés en qualifications) ;
   PA60 non importé (hors périmètre du brevet N3, voir plus haut).
3. Relances automatiques : certificats médicaux qui expirent, RIFAP échus, et
   les 4 plongées en milieu naturel dues par un N1 certifié en piscine.
4. ~~Export PDF de la fiche de suivi d'un élève.~~ Fait (`GET
   /api/cursus/{id}/fiche.pdf`, bouton dans la grille).
5. Icônes PWA à fournir dans `frontend/public/icones/`.
6. Envoi d'e-mail réel : `ServiceNotificationConsole` se contente de tracer le
   lien de réinitialisation de mot de passe dans les logs (pas de serveur SMTP
   configuré). À remplacer avant la mise en production.

## Avertissement

Ce code a été écrit sans être compilé (Maven Central inaccessible dans
l'environnement de génération). Attendre des ajustements d'imports et de
signatures au premier `mvn spring-boot:run`. Commencer par faire passer
`mvn test` avant d'ajouter des fonctionnalités.
