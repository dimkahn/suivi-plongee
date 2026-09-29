# Vidéos explicatives — série « Moniteur »

Dix vidéos courtes (30 s à 1 min à l'enregistrement automatique, 1 à 2 min
avec une voix off posée), une tâche par vidéo. Public : les moniteurs du
club, au bord du bassin, téléphone en main.

Chaque scénario existe en deux formes :

- ce document : le plan, ce qu'on touche, et le texte de voix off, pour
  tourner soi-même (capture d'écran du téléphone, OBS…) ou pour enregistrer
  la voix sur la vidéo automatique ;
- `scenarios/Mxx-….mjs` : le même déroulé, joué par Playwright, qui produit
  une vidéo muette au format téléphone avec les sous-titres incrustés
  (voir `LISEZ-MOI.md`).

Toutes les vidéos se tournent avec le compte **Flora Vasseur**
(`e2@club.fr`, E2, mot de passe `plongee2026`), sur la saison 2026-2027
des données de démonstration (V107), complétée des portraits dessinés de
`preparer-donnees.mjs`. Élève « fil rouge » : **Anis Dulac**,
N1, groupe Débutants.

Ordre de tournage conseillé : l'ordre des numéros. M2 dépose la photo de
Flora, que M15 montre ; M13 doit passer avant M14 (Flora n'a pas encore
répondu).

---

## M1 — Se connecter et s'y retrouver

**Objectif** : se connecter, trouver les écrans, récupérer un mot de passe.

| Écran / geste | Voix off |
|---|---|
| Page de connexion | « Sur votre téléphone, ouvrez l'adresse de l'appli du club. » |
| Saisir l'e-mail puis le mot de passe | « Votre adresse e-mail, et votre mot de passe. » |
| Montrer « Se souvenir de moi » | « Laissez “Se souvenir de moi” coché sur votre téléphone : vous resterez connecté. Décochez-le sur un appareil partagé. » |
| Toucher « Se connecter » → Infos élèves | « Vous arrivez sur Infos élèves : les élèves de la saison en un coup d'œil. » |
| Ouvrir le menu (☰) | « Tout le reste est dans le menu : planning du bassin, présences, trombinoscope, fiches de sécurité… “Préparer hors ligne”, à toucher avant d'aller au bassin s'il n'y a pas de réseau. Et votre nom, pour votre compte. » |
| Refermer le menu | « Astuce : ajoutez l'appli à l'écran d'accueil du téléphone, elle s'ouvrira comme une application. » |
| Menu → Se déconnecter → « Mot de passe oublié ? » → e-mail → « Envoyer le lien » | « Mot de passe oublié ? Indiquez votre e-mail : un lien de réinitialisation vous est envoyé. » |

## M2 — Mon compte

**Objectif** : savoir ce qu'on peut changer soi-même, et ce qui passe par
un administrateur.

| Écran / geste | Voix off |
|---|---|
| Menu → toucher son nom | « Votre compte : touchez votre nom dans le menu. » |
| Haut de page : niveau, CACI | « En haut, votre niveau d'encadrement et la date de fin de votre CACI. Ils sont saisis par un administrateur : c'est à lui qu'on remet un nouveau certificat. » |
| « Déposer ma photo » → choisir → recadrer → Valider | « Votre photo apparaît dans le trombinoscope des moniteurs. La déposer vaut accord pour cet affichage ; vous pouvez la retirer à tout moment. » |
| Défiler : licence, e-mail, mot de passe (sans valider) | « Plus bas : votre numéro de licence, l'e-mail qui sert à vous connecter, et votre mot de passe — dix caractères au moins ; vos autres appareils seront déconnectés. » |
| Bloc « Identité » | « Votre nom figure sur les fiches de sécurité et dans l'historique des notes : pour le corriger, voyez un administrateur. » |

## M3 — Faire l'appel d'une séance

**Objectif** : feuille de présence en moins d'une minute.

| Écran / geste | Voix off |
|---|---|
| Menu → Présences | « Au bord du bassin : menu, puis Présences. » |
| « Changer » → calendrier → lundi → séance Piscine | « D'abord la séance. Les jours marqués portent une séance ; le lundi, la piscine et la fosse sont deux séances distinctes. » |
| Bloc « Au programme » | « Au programme : ce que la progression du club prévoit ce mois-ci. » |
| Filtre « Débutants » | « Filtrez sur votre groupe d'entraînement. » |
| Toucher un élève → Bloc / Nage / Théorie (4 élèves) | « Touchez un élève, puis ce qu'il a fait : nage, bloc ou théorie. Chaque choix est enregistré tout de suite, pas de bouton Enregistrer. Un élève sans choix est absent. » |
| Retoucher le choix actif d'un élève | « Une erreur ? Touchez de nouveau le choix actif pour l'effacer. » |
| Compteur « présents · absents » | « Le compteur fait le bilan. Sans réseau, les choix restent sur le téléphone et partent au retour du réseau. » |

## M4 — Noter un élève pendant la séance

**Objectif** : le geste principal de l'appli.

| Écran / geste | Voix off |
|---|---|
| Infos élèves → toucher « Anis Dulac » | « Dans Infos élèves, touchez le nom de l'élève. » |
| En-tête de la grille, jauge | « Sa grille : niveau préparé, critères acquis, séances suivies. La jauge descend vers la profondeur du brevet à mesure qu'il progresse. » |
| « Séance évaluée » → Changer → lundi → Piscine | « Avant de noter, choisissez la séance du jour. » |
| « Ouvrir les N blocs au programme » | « Au programme : les compétences que la progression prévoit ce mois-ci. » |
| « Palmage dorsal » → Acquis | « Chaque critère a trois états : non abordé, en cours, acquis. Tiago l'avait noté en cours la semaine dernière ; aujourd'hui, c'est acquis. Votre nom et la date s'affichent sous le critère. » |
| « Palmage de sustentation » → En cours → Commenter → texte → Enregistrer | « Le palmage de sustentation est en cours : on laisse un mot pour le prochain encadrant. » |
| (conclusion) | « Un bloc marqué “En retard” a passé l'échéance prévue par la progression. Pas de réseau ? La note est gardée sur le téléphone, “En attente d'envoi”. » |

## M5 — Corriger une note et retrouver l'historique

**Objectif** : comprendre qu'on ne perd jamais rien.

| Écran / geste | Voix off |
|---|---|
| Grille d'Anis, séance du jour, bloc « Se ventiler » | « Le vidage de masque était en cours, avec un commentaire de Tiago. » |
| « Vidage du masque » → Acquis | « Anis l'a réussi ce soir : on le passe en acquis. » |
| « Voir l'historique » | « Rien n'est jamais effacé : chaque note s'ajoute à l'historique. Qui a noté quoi, et quand. » |
| « Lâcher et reprise d'embout » → Acquis (par erreur) → Non abordé → historique | « Et si on se trompe de ligne ? Il suffit de toucher le bon état : la correction s'ajoute à la suite. L'erreur et sa correction restent visibles, c'est voulu. » |

## M6 — Valider une compétence

**Objectif** : valider un bloc, et comprendre les refus.

| Écran / geste | Voix off |
|---|---|
| Bloc « S'équiper et se déséquiper » (2/3) | « Une compétence regroupe plusieurs critères. Ici, deux sur trois sont acquis. » |
| « Choix de son matériel personnel » → Acquis | « Anis a choisi et réglé son matériel seul : dernier critère acquis. » |
| « Valider la compétence » | « Tous les critères sont acquis : le bouton Valider la compétence apparaît. Validée, avec la date et votre nom ; les critères de ce bloc ne se modifient plus. » |
| Grille de Camille Berthier (N2), bandeau « milieu naturel » | « L'appli applique les règles du MFT et explique ses refus. Par exemple, au N2 et au N3, tout se valide en milieu naturel. Et vous ne notez que les niveaux de votre encadrement : E1 pour le N1, E2 jusqu'au N2, E3 jusqu'au N3. » |

## M13 — Consulter le planning du bassin

**Objectif** : savoir où est son groupe ce soir.

| Écran / geste | Voix off |
|---|---|
| Menu → Planning | « Le planning remplace le tableur du lundi soir. » |
| Carte de la soirée | « En haut, la prochaine soirée : son responsable de séance et une note éventuelle. Puis chaque groupe et son espace : le chiffre est la ligne d'eau. » |
| Carte « Votre groupe » (F6) | « Votre groupe est encadré. Ce soir, les débutants vont en fosse limitée à 6 mètres : F6. » |
| « À savoir » | « À savoir signale ce qui cloche : ici, un groupe dont l'encadrant sera absent. » |
| Flèches ‹ › | « Les flèches passent d'une soirée à l'autre. » |
| « Mes prochaines soirées » → « Afficher les … soirées suivantes » | « Plus bas, vos prochaines soirées avec l'espace de votre groupe, et toute la saison d'un coup. » |
| Légende en bas | « La légende rappelle les abréviations. Préparé hors ligne, le planning se consulte même sans réseau. » |

## M14 — Dire si je suis présent à une soirée

**Objectif** : répondre en un toucher, pour que l'admin compose les groupes.

| Écran / geste | Voix off |
|---|---|
| Planning, « Vous serez là ? » | « L'admin compose les groupes avec vos réponses. On voit déjà qui a répondu ; vous, pas encore. » |
| « Présent » | « Un toucher suffit : votre nom rejoint la liste des présents. » |
| Tableau : ✓ / ✗ sur trois soirées, puis changer une réponse | « Pour les soirées suivantes, répondez dans le tableau. Un empêchement ? Changez votre réponse à tout moment. » |
| (conclusion) | « Sans réponse, personne ne vous suppose présent ni absent. La réponse demande du réseau : elle n'est pas gardée hors ligne. » |

## M15 — Le trombinoscope

**Objectif** : mettre un nom sur un visage.

| Écran / geste | Voix off |
|---|---|
| Menu → Trombinoscope, défiler | « Les élèves de la saison, par groupe d'entraînement. » |
| Carte « Droit à l'image non recueilli » | « Pas de photo sans le droit à l'image : il est distinct de l'autorisation de plonger. » |
| Filtre « Débutants », recherche « Léa » | « Filtrez sur un groupe, ou cherchez un prénom. » |
| Toucher la carte → grille, retour | « Touchez la carte pour ouvrir sa grille de compétences. » |
| Onglet « Moniteurs » | « L'onglet Moniteurs montre les encadrants du club. Votre photo se dépose depuis Mon compte. » |

## M16 — Infos élèves

**Objectif** : la vue d'ensemble de la saison.

| Écran / geste | Voix off |
|---|---|
| Infos élèves | « La page d'accueil : toute la saison sur un seul écran. Pour chaque élève, son niveau préparé, son référent, son CACI. » |
| Colonne CACI | « Vert : plus d'un mois. Orange : moins d'un mois. Rouge : moins de quinze jours. Le triangle : expiré. » |
| Faire glisser le tableau vers la gauche | « Faites glisser le tableau : séances bloc et nage, puis chaque date. » |
| Filtre « Débutants », recherche « mor » | « Les boutons filtrent par groupe ; la recherche retrouve un élève par son nom ou son prénom. » |
| Toucher « Léa Morel » → « Informations supplémentaires » | « Touchez son nom : Informations supplémentaires donne le téléphone et le contact d'urgence. Aucune donnée de santé n'est enregistrée, seulement la date de fin du certificat. » |
