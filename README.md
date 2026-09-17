# Suivi des formations de plongée — N1, N2, N3

Application de suivi des compétences MFT pour un club FFESSM. Les moniteurs
notent leurs élèves séance par séance ; l'application applique les règles du
Manuel de Formation Technique et refuse les saisies qui les enfreignent.

Backend Java 21 / Spring Boot 3.3, frontend Angular 18, base PostgreSQL.

---

## Démarrer

### Backend

```bash
cd backend
mvn spring-boot:run              # profil dev : base H2 en mémoire, données de démo
# (ou ./mvnw après un `mvn wrapper:wrapper` si tu préfères le wrapper)
```

L'API écoute sur `http://localhost:8080`, la documentation OpenAPI sur
`http://localhost:8080/api-docs`.

En production, le profil `prod` attend PostgreSQL :

```bash
export DB_URL=jdbc:postgresql://localhost:5432/plongee
export DB_USER=plongee
export DB_PASSWORD=…
export JWT_SECRET=$(openssl rand -base64 48)
java -jar target/suivi-plongee-1.0.0.jar --spring.profiles.active=prod
```

Le profil `prod` ne charge pas `db/demo` : seules les migrations de
`db/migration` s'appliquent, donc le référentiel MFT sans aucune donnée
nominative.

### Frontend

```bash
cd frontend
npm install
npm start                       # http://localhost:4200, proxy vers le backend
```

### Les deux en même temps

Pour éviter deux terminaux, une commande unique depuis la racine démarre le
frontend en arrière-plan (log dans `frontend/frontend-dev.log`) puis le
backend au premier plan (Ctrl+C l'arrête comme d'habitude) :

```bash
mvn -N -Pdev antrun:run@dev          # démarre frontend + backend
mvn -N -Pdev antrun:run@dev-stop     # arrête le frontend resté en tâche de fond
```

### Comptes de démonstration

Mot de passe commun : `plongee2026`.

| Compte | Rôle | Ce qu'il peut faire |
|---|---|---|
| `presidente@club.fr` | ADMIN + E4 | Tout, y compris délivrer les brevets |
| `e3@club.fr` | MONITEUR E3 | Noter et valider N1, N2 et N3 |
| `e2@club.fr` | MONITEUR E2 | Noter et valider N1 et N2 |
| `e1@club.fr` | MONITEUR E1 | Noter et valider N1 uniquement |
| `eleve@club.fr` | ELEVE | Consulter sa propre grille, sans rien saisir |

Ouvrir une grille N2 avec le compte E1 est la démonstration la plus parlante :
les boutons sont désactivés et l'écran explique pourquoi.

### Avec Docker

Pour faire tourner l'ensemble (PostgreSQL + backend + frontend) sans rien
installer localement :

```bash
cp .env.example .env             # adapter DB_PASSWORD / JWT_SECRET si besoin
docker compose up --build
```

- Frontend sur `http://localhost:4200` (nginx, proxifie `/api` vers le backend)
- Backend sur `http://localhost:8080` (profil `prod`, base PostgreSQL)
- PostgreSQL sur `localhost:5432`

Ce mode utilise le profil `prod` : pas de données de démo, seul le
référentiel MFT est chargé. Pour retrouver les comptes de démonstration
ci-dessus, continuer à lancer le backend en profil `dev` (`mvn
spring-boot:run`) hors Docker.

### Envoi d'e-mail (SMTP)

En profil `dev`, aucun e-mail n'est réellement envoyé : `ServiceNotificationConsole`
se contente de tracer le lien (réinitialisation de mot de passe, invitation d'un
moniteur) dans les logs du backend.

En profil `prod` (donc avec Docker), l'envoi est réel et se configure par
variables d'environnement sur le service `backend` :

| Variable | Rôle | Défaut |
|---|---|---|
| `SMTP_HOTE` | Serveur SMTP | — (obligatoire) |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_UTILISATEUR` | Compte SMTP (authentification) | — (obligatoire) |
| `SMTP_MOT_DE_PASSE` | Mot de passe du compte SMTP | — (obligatoire) |
| `MAIL_EXPEDITEUR` | Adresse affichée comme expéditeur | `Club de plongee <no-reply@cppjvo.fr>` |

**Avec Gmail** (`SMTP_HOTE=smtp.gmail.com`, port 587 par défaut, STARTTLS déjà
activé côté backend) :

- Le compte Google doit avoir la validation en deux étapes activée, et
  `SMTP_UTILISATEUR`/`SMTP_MOT_DE_PASSE` doivent être l'adresse Gmail et un
  **mot de passe d'application** dédié (16 caractères, généré dans les
  paramètres du compte Google) — le mot de passe habituel du compte ne
  fonctionne pas pour l'envoi SMTP.
- `MAIL_EXPEDITEUR` doit correspondre à cette même adresse Gmail (ou à un
  alias « Envoyer en tant que » configuré dessus) : Gmail ignore ou rejette
  un expéditeur arbitraire qui ne correspond pas au compte authentifié.
- Limite d'envoi Gmail standard : 500 messages/jour (2000/jour en Google
  Workspace), largement suffisant pour l'usage d'un club.

### Nom de la structure (fiche de sécurité)

La fiche de sécurité PDF d'une séance (article A322-72 du Code du sport)
affiche en en-tête le nom de la structure. Variable d'environnement
`CLUB_NOM` sur le service `backend`, valeur par défaut `Club de plongee` si
laissée vide.

---

## Le référentiel

Les compétences sont chargées par la migration `V2__referentiel_mft.sql`,
elle-même produite par `outils/generer_referentiel.py`. Pour intégrer une
révision du MFT, on modifie le script et on ajoute une migration — le code
applicatif ne bouge pas.

| Code | Intitulé | N1 | N2 | N3 |
|---|---|:-:|:-:|:-:|
| C1 | Utiliser l'équipement de plongée | ✓ | ✓ | |
| C2 | Évoluer en environnement aquatique et subaquatique | ✓ | ✓ | |
| C3 | Évoluer en palanquée guidée | ✓ | ✓ | |
| C4 | Planifier et organiser la plongée | | ✓ | ✓ |
| C5 | Maîtriser, adapter l'évolution en immersion | | ✓ | ✓ |
| C6 | Participer à la sécurité | ✓ | ✓ | ✓ |
| C7 | Connaître et respecter l'environnement marin | ✓ | ✓ | ✓ |
| C8 | Connaissances en appui des compétences | ✓ | ✓ | ✓ |
| C9 | Choisir un site de plongée | | | ✓ |

82 critères au total : 27 pour le N1, 33 pour le N2, 22 pour le N3.

Un même code ne recouvre pas le même contenu d'un niveau à l'autre — le
palmage de la C2 passe d'environ 50 m au N1 à 250 m au N2, la C6 change
d'intitulé au N2. Les blocs et les critères appartiennent donc au référentiel
d'un niveau, jamais à un catalogue partagé.

Les critères de réalisation livrés ici sont **condensés**. Si tu veux que tes
moniteurs lisent le libellé officiel, remplace-les par le texte intégral du
MFT dans `outils/generer_referentiel.py` et régénère la migration. La source
(CTN FFESSM) est enregistrée dans la colonne `referentiel.source` et affichée
dans l'application.

---

## Les règles appliquées par le serveur

Elles sont dans `EvaluationService` et `RegleDelivranceService`, et toutes
leurs valeurs de comparaison viennent de la table `referentiel`.

**À la saisie d'une évaluation**

- Le critère doit appartenir au référentiel du cursus : on ne peut pas noter
  un critère N3 sur un élève qui prépare le N1.
- N2 et N3 : la séance doit être en milieu naturel. Les piscines et fosses
  sont refusées quelle que soit leur profondeur.
- La profondeur de la séance doit rester dans l'espace d'évolution du niveau
  (20 m en formation N1, 40 m en N2, 60 m en N3).
- La séance doit appartenir à la saison du cursus.
- Une séance est obligatoire, sauf pour la C8 qui se vérifie au fil des autres
  compétences.

**À la validation d'une compétence**

- Tous les critères du bloc doivent être acquis.
- La C6 du N2 ne peut être validée qu'après tous les autres blocs.
- Le niveau d'encadrement doit être suffisant : E1 pour le N1, E2 pour le N2,
  E3 pour le N3.

**À la délivrance**

- Âge minimum (14 / 16 / 18 ans) à la date de délivrance.
- Autorisation du responsable légal pour un mineur.
- Certificat médical en cours de validité.
- Brevet prérequis détenu (N1 pour le N2, N2 pour le N3).
- RIFAP valide pour le N3.
- Toutes les compétences validées.
- Encadrant E3 minimum.
- Un N1 certifié sans aucune séance en milieu naturel déclenche une échéance :
  4 plongées en milieu naturel à attester dans les douze mois.

L'endpoint `GET /api/cursus/{id}/eligibilite` renvoie le détail contrôle par
contrôle, pour afficher ce qui manque avant de proposer le brevet.

---

## Sécurité

- Jeton d'accès JWT de 30 minutes transmis par l'en-tête `Authorization`,
  jamais stocké dans `localStorage` : il reste dans un signal Angular.
- Jeton de rafraîchissement dans un cookie `HttpOnly` / `Secure` /
  `SameSite=Strict`, avec rotation à chaque usage et stockage de la seule
  empreinte SHA-256 en base.
- Mots de passe en BCrypt, coût 12.
- Deux niveaux d'autorisation : le rôle via `hasRole('MONITEUR')`, puis
  l'habilitation métier via `@habilitation.peutEvaluer(#cursusId, authentication)`
  qui compare le niveau d'encadrement au niveau exigé par le référentiel.
- L'auteur d'une évaluation vient du `SecurityContext`, jamais du corps de la
  requête.
- Un élève ne reçoit que ses propres cursus : le filtrage est fait dans la
  requête, pas par un 403 après coup.
- Les gardes Angular ne servent qu'à masquer ce qui n'est pas disponible. La
  seule autorisation qui compte est celle du serveur — c'est ce que vérifie
  `SecuriteEvaluationTest`.

```bash
cd backend && mvn test
```

`SecuriteEvaluationTest` couvre : appel anonyme refusé, élève qui tente de se
noter, E1 sur un cursus N2, compétence N2 saisie sur une séance en piscine, et
le cas nominal d'un E2 sur un N1. `SynchronisationTest` couvre l'idempotence
du rejeu, le refus isolé au milieu d'un lot, et le paquet d'amorce.

---

## Traçabilité et RGPD

`evaluation` est une table en **ajout seul**. Une correction crée une nouvelle
ligne ; l'état courant d'un critère est la dernière saisie. On obtient ainsi
l'historique de progression de l'élève et la trace de qui a noté quoi, ce
qu'un tableur partagé ne donne pas.

Côté données personnelles :

- Le certificat médical n'est pas stocké, seulement sa date de fin de validité.
- Les élèves mineurs ont un champ d'autorisation du responsable légal.
- `eleve.archive_le` permet une purge sans casser l'historique des séances.
- Prévoir une mention d'information à l'inscription et un hébergement dans l'UE.

---

## Mode hors ligne

Les moniteurs saisissent au bord du bassin ou sur un bateau, où le réseau est
au mieux intermittent. L'application fonctionne sans lui.

### Ce qui se passe quand on tape sur un bouton

La notation n'est jamais envoyée directement. Elle est écrite dans IndexedDB
avec une référence générée par le client, puis mise en file. L'interface
confirme le geste immédiatement ; l'envoi se fait quand il peut se faire. Un
critère en attente s'affiche avec une bordure en pointillés et la mention
« En attente d'envoi ».

La file se vide sur l'événement `online`, au démarrage de l'application, et
toutes les minutes. Pas d'API Background Sync : son support reste partiel sur
iOS, et un réveil périodique couvre les mêmes cas tout en restant vérifiable.

### Idempotence

La référence client est portée jusqu'en base, sous contrainte d'unicité. Une
saisie rejouée — réseau coupé en cours de requête, application relancée,
onglet dupliqué — retrouve son enregistrement d'origine au lieu d'en créer un
second. C'est ce que vérifie `SynchronisationTest.rejeuIdempotent`.

### Le cas qui compte vraiment : le refus différé

Une saisie faite hors ligne à 9 h peut être refusée à 14 h, quand elle part
enfin. Une compétence N2 pointée sur une séance en piscine, un cursus clôturé
entre-temps, un moniteur dont l'habilitation a changé.

Trois réponses, dans cet ordre :

1. **Prévenir.** Le navigateur applique les mêmes règles que le serveur avant
   de mettre en file, à partir du référentiel mis en cache : milieu naturel
   exclusif, espace d'évolution. La plupart des refus n'ont jamais lieu.
2. **Ne pas bloquer la file.** `POST /api/synchronisation/evaluations` traite
   chaque élément dans sa propre transaction et répond élément par élément
   (`ACCEPTEE`, `DEJA_ENREGISTREE`, `REFUSEE` avec la raison). Une saisie
   invalide ne fait pas perdre les trente autres.
3. **Ne rien absorber.** Un refus remonte dans un bandeau rouge avec sa raison
   et la date de la saisie. Le moniteur décide : écarter, ou corriger le
   contexte et réessayer. Rien ne disparaît en silence.

### Lecture hors ligne

Deux couches, volontairement :

- Le service worker Angular (`ngsw-config.json`) met en cache la coquille de
  l'application, les polices, et les appels `GET` avec une stratégie
  `freshness` de 3 secondes.
- Le cache applicatif dans IndexedDB prend le relais au-delà : `ApiService`
  écrit chaque réponse et y retombe si le réseau manque. Une grille consultée
  hors ligne affiche la date de sa dernière mise à jour, pour qu'on sache ce
  qu'on regarde.

Le bouton **Préparer hors ligne** appelle `GET /api/synchronisation/paquet`,
qui ramène en un seul appel les cursus, les séances et toutes les grilles de
la saison. À déclencher au club avant de partir en sortie.

### Ce qui reste en ligne

La validation d'une compétence et la délivrance d'un brevet exigent du réseau.
Ce sont des décisions qui engagent, elles dépendent de l'état réel du serveur
(tous les critères acquis, les autres blocs validés pour la C6 du N2), et une
validation « en attente » n'aurait pas de sens. L'interface l'annonce au lieu
de laisser le bouton échouer.

### Limites connues

- Le jeton d'accès dure 30 minutes. Une session hors ligne plus longue garde
  la saisie en file, mais le rafraîchissement échouera jusqu'au retour du
  réseau : la file part alors après reconnexion.
- Deux moniteurs qui notent le même critère hors ligne produisent deux
  évaluations. C'est voulu : la table est en ajout seul, la plus récente fait
  foi, et l'historique conserve les deux.
- Les icônes PWA sont à fournir dans `frontend/public/icones/`.

---

## Ce qui reste à faire

- **Résolution assistée des refus.** Aujourd'hui le moniteur écarte un refus
  ou corrige le contexte à la main ; proposer directement la bonne séance
  serait plus rapide.
- **Import du tableur existant** pour ne pas perdre la saison en cours.
- **Écran d'administration** : inscription des élèves, ouverture de saison,
  import d'une nouvelle révision du MFT.
- **Relances automatiques** sur les certificats médicaux qui expirent, les
  RIFAP arrivés à échéance et les 4 plongées des N1 certifiés en piscine.
- **Export PDF** de la fiche de suivi d'un élève.

---

## Arborescence

```
backend/
  src/main/java/fr/club/plongee/
    securite/      Utilisateur, JWT, filtre, contrôleur d'authentification
    referentiel/   Referentiel, BlocCompetence, Critere (MFT)
    formation/     Eleve, Saison, Cursus, Seance, Participation, Qualification
    evaluation/    Evaluation (ajout seul), habilitations, grille
    delivrance/    Contrôles préalables et délivrance du brevet
    commun/        Exceptions et gestionnaire d'erreurs
  src/main/resources/db/
    migration/     V1 schéma, V2 référentiel MFT, V3 idempotence
    demo/          V100 jeu de démonstration, profil dev uniquement
frontend/
  src/app/core/      Auth, intercepteur, gardes, appels API,
                     IndexedDB, file d'attente hors ligne, état réseau
  src/app/features/  Connexion, liste des formations, grille de compétences,
                     bandeau de synchronisation
  ngsw-config.json   Service worker : coquille, polices, cache des GET
outils/
  generer_referentiel.py   Génère V2 à partir du référentiel décrit en Python
```
