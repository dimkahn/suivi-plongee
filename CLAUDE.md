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

Mise en production : un tag `v…` sur un commit de `master` est vu par
`outils/surveiller-tags.sh` (cron toutes les 5 minutes sur le serveur), qui
construit les images sur place, sauvegarde la base, redémarre la prod et
revient en arrière tout seul si le backend ne répond pas. Le même tag
déclenche `.github/workflows/deploiement.yml`, qui ne fait plus que les
tests et les images ghcr.io (plus d'étape SSH). Voir `DEPLOIEMENT.md`,
« Déploiement automatique ».

Vidéos d'aide : `outils/videos/tourner.sh` (Playwright, données de démo,
backend `dev` neuf ; voix off des sous-titres par Piper, montée par
`monter.mjs` avec ffmpeg) puis `outils/videos/publier.sh`. Page publique `/videos`
(`VideosComponent`, sans connexion) ; les fichiers ne sont ni dans le dépôt
ni dans les images, Caddy les sert sous `/medias/videos/` depuis le dossier
`VIDEOS` du `.env`. Voir `outils/videos/LISEZ-MOI.md`.
`outils/videos/surveiller-scenarios.sh` (cron toutes les 5 minutes, clone
dans `~/suivi-plongee-videos/`) tourne et publie seul les scénarios nouveaux
ou modifiés de la version en ligne.

Aide et manuels : page publique `/aide` (`AideComponent`, sans connexion),
des questions fréquentes qui renvoient chacune au manuel d'utilisation
d'une fonctionnalité et à ses vidéos. Un manuel = un fichier Markdown de
`frontend/src/app/features/aide/manuels/` (en-tête : titre, rubrique,
codes des vidéos, écran, mots-clés, questions ; format dans le
`LISEZ-MOI.md` du dossier), listé dans `manuels/index.ts` et embarqué dans
l'appli (loader `.md` en texte, `angular.json`) : la recherche tourne dans
le navigateur, sans serveur ni réseau, seules les vidéos viennent du
catalogue publié. Changer un écran = mettre à jour son manuel au même
commit ; un nouveau scénario de vidéo = le citer dans un manuel.

**Règle pour chaque commit (demande du club, 2026) :** tout commit qui
change ce que voit ou fait l'utilisateur met à jour, **dans le même
commit**, l'aide (le ou les manuels de `frontend/src/app/features/aide/manuels/`
concernés : texte, questions, mots-clés) **et** les scénarios de vidéo qui
montrent cet écran (`outils/videos/scenarios/*.mjs` : gestes et phrases de
voix off, date « Tournage du … » à jour pour qu'il soit retourné, plus
l'entrée de `outils/videos/SCENARIOS.md`). Chercher les manuels et
scénarios concernés (par l'écran, les sélecteurs CSS, les libellés de
boutons) avant de commiter, et dire dans le résumé ce qui a été mis à jour.
Seuls les commits sans effet visible (tests, outillage, refactorisation)
en sont dispensés.

Le frontend proxifie `/api` vers `localhost:8080` et `/medias/videos` vers
`outils/videos/apercu.mjs` (port 4300) (`proxy.conf.json`).
Comptes de démonstration dans le README, mot de passe `plongee2026`.

## Décisions structurantes — ne pas défaire sans raison

Les décisions propres à chaque domaine sont dans `.claude/rules/`, chargées
automatiquement quand on touche aux fichiers du domaine. Les lire avant de
concevoir une modification qui les concerne :

- `referentiel.md` : référentiel MFT en base, N2/N3 en qualifications, règles du MFT dans le serveur
- `progression.md` : progressions types (mois ou plongées), modèle centre de plongée en mer
- `encadrants-fiche-securite.md` : niveaux des encadrants, fiche de sécurité, groupes de plongeurs, proposition des palanquées
- `planning.md` : planning du bassin, groupes d'entraînement, présences des encadrants
- `materiel.md` : matériel et prêts, sorties, import/export Excel, TIV, QR codes
- `sejour.md` : séjours, carnet, frais, accès par lien
- `evaluation.md` : évaluation en ajout seul, entraînement N2/N3, présence avant notation, notation groupée, synthèses
- `exercices.md` : programme d'exercices des séances, base d'exercices, parcours, schémas

Ce qui suit vaut pour tout le projet.

**La sécurité se joue à deux niveaux.** Le rôle via `hasRole('MONITEUR')`,
puis l'habilitation métier via
`@habilitation.peutEvaluer(#cursusId, authentication)` qui compare le niveau
d'encadrement de l'utilisateur au niveau exigé par le référentiel (E1 pour le
N1, E2 pour le N2, E3 pour le N3). L'auteur d'une évaluation vient toujours du
`SecurityContext`, jamais du corps de la requête. **Seule exception (choix
du club, 2026) :** un référent du groupe d'entraînement de l'élève peut
noter au nom d'un autre encadrant qui ne l'a pas fait (`pourMoniteurId`,
contrôlé par `EvaluationService.moniteurRemplace` : référent du groupe de
l'élève dans la saison du cursus, encadrant actif et habilité au niveau) ;
la note porte le nom de cet encadrant (`moniteur_id`) et le référent est
gardé dans `evaluation.saisi_par_id` (V63, null quand on note soi-même),
montré « saisi par » dans l'historique. Grille seulement (et sa file hors
ligne) : ni la notation groupée ni la validation d'un bloc. Les gardes Angular ne sont
que du confort d'affichage.

**Un élève n'est pas forcément en formation.** Le seul lien élève-saison
historique était `Cursus` (une formation N1/N2/N3 figée sur un référentiel).
Pour un élève déjà breveté qui continue de plonger avec le club sans viser
un nouveau niveau, `AdhesionSaison` (table `adhesion_saison`, contrôleur
`/api/adhesions`) porte une appartenance légère à une saison : pas de
référentiel, pas de suivi de séances/plongées (`Participation.cursus_id`
reste obligatoire, volontairement pas touché — un élève en adhésion seule
n'apparaît pas dans le roster de présence). Écran : `/admin/eleves`, filtre
« Sans rattachement à la saison ». Si le club a un jour besoin de compter
les présences d'un élève sans Cursus, c'est un vrai chantier sur
`Participation`, pas une extension de `AdhesionSaison`.

**Le hors ligne passe par une file, pas par un cache d'écriture.** Une
notation est écrite dans IndexedDB avec une référence client (UUID), puis
rejouée par `POST /api/synchronisation/evaluations`, qui répond élément par
élément. La référence est unique en base : rejouer une saisie ne la duplique
pas. Un refus différé remonte au moniteur dans un bandeau, il n'est jamais
absorbé silencieusement. Les écritures qui remplacent un état (présence,
fiche de sécurité, profil réalisé) passent par une seconde file,
`FileEcrituresService` : elles sont idempotentes côté serveur, donc on ne
garde que la dernière version par cible, envoyées dans l'ordre de leur
première saisie (une fiche avant son profil réalisé). « Préparer hors
ligne » embarque aussi les feuilles de présence et fiches de sécurité des
séances à ±30 jours, les moniteurs, plongeurs connus, groupes et le
planning du bassin de la saison ouverte.

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

**Les vacances scolaires viennent de la source officielle, pas d'une copie.**
La génération d'une saison (`/admin/seances/generer`, `GenerationSaisonService`)
lit les vacances de la zone choisie dans le jeu de données « Calendrier
scolaire » de data.education.gouv.fr (`CalendrierScolaireOfficiel`) au
moment de l'aperçu : le serveur doit pouvoir joindre internet. Source
injoignable = refus explicite, jamais de dates devinées. Les jours fériés,
eux, sont calculés (`JoursFeries`, Pâques par l'algorithme de Meeus). Les
tests remplacent la source par une fausse (`GenerationSaisonTest`).

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
- Créations et modifications dans une fenêtre de dialogue
  (`core/dialogue.component.ts`, `<app-dialogue [ouvert] titre [erreur]
  (fermer)>`, boutons dans `.actions-dialogue`), plein écran sur
  téléphone, et non plus dans la liste. Restent des pages entières les
  formulaires longs (fiche d'un équipement, inspection TIV, fiche de
  sécurité, programme d'exercices, génération de saison). Un overlay
  ouvert depuis un dialogue (recadrage photo) se place dans son contenu :
  le reste de la page est inerte tant qu'il est ouvert.
- Navigation (2026) : page d'accueil des encadrants `/aujourdhui`
  (`AujourdhuiComponent`, la séance du jour ou la prochaine, liens vers
  l'appel, le programme, la fiche de sécurité). Sous 860 px, barre
  d'onglets fixe en bas de l'écran (`app.component.ts`) et « Plus » pour
  le reste du menu ; ce qui colle au bas de l'écran se place au-dessus
  d'elle avec `--hauteur-onglets` (ou un `z-index` supérieur à 32 pour une
  barre de choix temporaire). En tête de chaque page, la barre de page
  (`core/barre-page.component.ts`, posée par `app.component.ts`) : à gauche
  le retour « ← … » vers l'écran parent, calculé au même endroit pour toute
  l'appli (`core/navigation.ts` : on remonte d'un cran dans l'arborescence,
  jamais vers la page vue juste avant ; un écran qui ne connaît son parent
  qu'une fois chargé le donne par `NavigationService.preciserRetour`) ; à
  droite « Comment faire ? », qui ouvre dans une fenêtre les manuels de
  l'écran (`features/aide/comment-faire.ts`, chargé au premier appui). Ne
  plus écrire de lien de retour dans un écran ; un nouvel écran = une entrée
  dans ces deux fichiers. Menu allégé (choix du club, 2026) : les groupes
  de plongeurs s'ouvrent depuis « Séjours », « Se déconnecter » est en bas
  de « Mon compte » (le nom dans le menu), et le matériel est une rubrique
  d'« Administration » pour l'ADMIN (le DT et le TIV non admin gardent
  « Matériel » au menu, faute d'accès à l'administration).
- Identité visuelle alignée sur celle du club (cppjvo.fr) : palette
  océan/corail, Poppins pour les titres, Nunito pour le texte courant.
  Jetons de design dans `frontend/src/styles.css`. Ne pas introduire de
  bibliothèque de composants. **Identité réglable par structure (2026,
  une installation par club ou centre)** : table `identite_structure`
  (V74, une ligne), écran `/admin/identite`, `IdentiteStructureService`
  (JdbcTemplate, pas d'entité). Nom, nom court, texte d'accueil, trois
  couleurs (`--profond`, `--profond-fonce`, `--accent`, posées sur la
  page par `core/identite.service.ts`) et logo (gardé en PNG ≤ 512 px).
  **Vide = l'identité d'origine** (logo embarqué, couleurs de
  styles.css, nom de `CLUB_NOM`) : le club en production ne voit aucun
  changement tant que rien n'est saisi. `GET /api/identite/**` est
  public (page de connexion) ; le manifeste et les icônes de l'appli
  installée ne passent par `/api/identite/manifest.webmanifest` que si
  l'identité est réglée. Les exports (fiche de sécurité PDF/Excel,
  compte rendu TIV, courriels de fin de séjour) lisent `nom()` et
  `logoPng()` à chaque génération ; ne plus utiliser `app.club.nom`
  directement.

**Comptes élèves fermés (choix du club, 2026).** Aucun écran ne crée de
compte élève, et un compte qui n'a que le rôle `ELEVE` ne se connecte pas
(`AuthController.compteEleveFerme`, 422 lisible à la connexion, refus au
rafraîchissement) tant que `app.comptes-eleves-ouverts` est faux : défaut
`COMPTES_ELEVES_OUVERTS=false`, vrai seulement en profil `dev` pour la
démonstration (`eleve@club.fr`, vidéos E1/E2, tests ; `ComptesElevesFermesTest`
vérifie la fermeture). Les élèves passent par le lien et le code des séjours.
Le code pour élève connecté (grille en lecture, carnet, « Modifier mes
informations ») reste en place pour une ouverture ultérieure, avec une
campagne de création de comptes à écrire.

## Données personnelles

Le club suit des mineurs. Le certificat médical n'est **jamais** stocké,
seulement sa date de fin de validité (`eleve.certificat_valide_jusqu_au`),
qui ne se saisit plus : seule la date de l'examen se saisit, la fin de
validité en est déduite par le serveur (examen + 1 an, `Caci.finValidite`,
choix du club 2026) ; V48 a repris la date d'examen (fin − 1 an) des
dossiers qui n'avaient que la fin.
Pour un élève (V46) comme pour un moniteur (V47, colonnes identiques sur
`utilisateur`) s'ajoutent la date de l'examen (`caci_date_examen`), la
qualité du médecin (`caci_medecin`, enum `MedecinCaci`) et les cases
cochées du CACI FFESSM « Version Juin 2026 » (`caci_activites`, enum
`ActiviteCaci`, libellés dans `core/caci.ts` : ensemble des activités, ou
bien seulement scaphandre/apnée/apnée > 6 m/nage avec accessoires,
compétition, limites et préconisations). Types communs dans
`fr.club.plongee.commun` (`Caci.verifier()` : contrôles de saisie) ; côté
écran `SaisieCaciComponent` et `DetailCaciComponent` (`core/`). Saisis par
un ADMIN (dossier élève, écran Moniteurs), montrés au clic sur la case CACI
d'« Infos élèves » et sur le CACI d'un moniteur, et dans « Mon compte ».
**Les cases seulement, jamais le texte écrit par le médecin** (activités en
compétition, détail des limites) : la case « limites » renvoie l'encadrant
au certificat papier. Ne pas ajouter de champ de santé, de pièce jointe médicale ni de commentaire
libre sur l'état de santé. `V100__donnees_demo.sql` ne contient que des noms
fictifs et ne doit pas être chargé en production (profil `dev` uniquement).

**Le droit à l'image est un consentement à part entière.** `eleve.autorisation_image`
est distinct de `eleve.autorisation_legale` (qui ne couvre que la pratique).
Une photo (`photo_eleve`, table séparée pour ne jamais alourdir les lectures
courantes d'un élève) n'est ni acceptée en dépôt ni renvoyée par
`EleveController` sans ce consentement explicite ; le retirer supprime la
photo, pas seulement son affichage. Même règle pour le trombinoscope des moniteurs :
`utilisateur.autorisation_image` + table `photo_utilisateur` (dépôt par un
ADMIN via `/api/admin/moniteurs/{id}/photo`, ou par le moniteur lui-même via
`/api/auth/moi/photo` depuis « Mon compte » — ce dépôt vaut consentement, le
retrait le retire ; lecture via `/api/moniteurs/{id}/photo`).

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
5. ~~Icônes PWA à fournir dans `frontend/public/icones/`.~~ Fait, depuis le
   logo du club (voir `frontend/public/icones/LISEZ-MOI.txt`).
6. ~~Envoi d'e-mail réel.~~ Fait (`ServiceNotificationEmail`, profil `!dev`,
   `spring.mail.*` en profil `prod` dans `application.yml` — hôte/identifiants
   par variables d'environnement `SMTP_HOTE`/`SMTP_UTILISATEUR`/
   `SMTP_MOT_DE_PASSE`). `ServiceNotificationConsole` reste la seule
   implémentation active en profil `dev` (pas de serveur SMTP local).

## Avertissement

Ce code a été écrit sans être compilé (Maven Central inaccessible dans
l'environnement de génération). Attendre des ajustements d'imports et de
signatures au premier `mvn spring-boot:run`. Commencer par faire passer
`mvn test` avant d'ajouter des fonctionnalités.
