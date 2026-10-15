# Plan de refonte de l'ergonomie

Établi le 15 octobre 2026 d'après quatre audits faits en lecture seule (dossier
`audits/`). Le club a choisi une **refonte libre** : un écran peut être
réorganisé en profondeur, fusionné ou découpé quand c'est justifié. Il a aussi
choisi d'avancer **par lots validés un à un**.

Le plan se lit dans l'ordre. Chaque lot tient en un commit, ou quelques commits
s'il est gros. Un lot ne commence que quand le précédent est poussé et vérifié
à l'écran.

## Comment lancer un lot

Dans une session Claude Code ouverte à la racine du dépôt :

> Exécute le lot N de `docs/ergonomie/PLAN.md`.

La session doit, pour chaque lot :

1. Relire la section du lot ici et les passages des audits qu'elle cite. Les
   numéros de ligne des audits datent du 15 octobre 2026 : retrouver le code
   par les noms (composant, classe, libellé), pas par le numéro.
2. Tenir compte des « Décisions à trancher » plus bas. Si une décision du lot
   n'est pas tranchée, poser la question avant de coder.
3. Coder en suivant `CLAUDE.md` : code et messages en français, composants
   standalone, signaux, template en ligne, pas de bibliothèque de composants.
4. Mettre à jour **dans le même commit** les manuels
   (`frontend/src/app/features/aide/manuels/`) et les scénarios de vidéo
   (`outils/videos/scenarios/*.mjs` et `outils/videos/SCENARIOS.md`) des écrans
   touchés. C'est la règle du club. Chercher les scénarios par les libellés de
   bouton et les sélecteurs CSS qui changent, et mettre à jour la date
   « Tournage du … » des scénarios modifiés.
5. Vérifier :
   - `cd backend && mvn -q -o test` (toute la suite) si le serveur change ;
   - `cd frontend && npx ng build --configuration development` ;
   - chaque écran touché dans le navigateur, sur ordinateur **et** en largeur
     téléphone (390 px), avec les comptes de démonstration du README.
6. Cocher le lot dans le tableau de suivi en bas de ce fichier, dans le même
   commit.
7. S'arrêter et montrer le résultat avant de passer au lot suivant. Ne pousser
   et ne poser de tag que sur demande.

## Décisions à trancher avant certains lots

| N° | Question | Proposition des audits | Lot | Décision |
|---|---|---|---|---|
| D1 | Fusionner les écrans Élèves et Inscriptions de l'administration ? | Un seul écran « Élèves de la saison » (`audit-admin.md` §3-4, principe 4). | 9 | à trancher |
| D2 | Fusionner les listes `/admin/sorties` et `/sejours` ? | Une seule liste des sorties et séjours, création comprise pour qui en a le droit (`audit-materiel-sorties.md` §6-7, principe 5). | 10 | à trancher |
| D3 | Le bouton « Séjour de plongée » de l'écran Séances crée une série de séances sans sortie : le renommer (« Série de plongées ») ou le faire créer une vraie sortie ? | Le renommer au minimum (`audit-admin.md` §12). | 9 | à trancher |
| D4 | Retirer les paragraphes d'explication en tête d'écran et les renvoyer vers « Comment faire ? » ? | Oui, une ligne au plus (`audit-bassin.md`, principe 4). | 4 à 10 | à trancher |
| D5 | Vue en cartes par défaut sur téléphone pour les tableaux larges (Infos élèves, vue globale, synthèse de séance) ? | Oui (`audit-bassin.md` §12, principe 5). | 5 | à trancher |

Noter la décision dans la colonne, avec la date, avant de lancer le lot.

---

## Lot 1 — Socle : couleurs, boutons, retours d'action

**But.** Corriger une fois, au niveau commun, ce qui gêne partout : les
contrastes trop faibles au soleil, les boutons désactivés qu'on ne distingue
pas, et les messages qui s'affichent hors de la vue et ne s'effacent jamais.

**Références.** `audit-transverse.md` T3, T4, T5, T7 ; principe 3 de
`audit-bassin.md` ; principe 1 de `audit-materiel-sorties.md`.

**Étapes.**
1. `frontend/src/styles.css` :
   - ajouter les jetons de texte lisibles (`--profond-texte`, `--acquis-texte`,
     `--en-cours-texte`, au moins 4,5:1 sur fond blanc) et `--trait-champ`
     (bord des champs, au moins 3:1) ;
   - ajouter `--danger`, `--succes` et `--info`, et les variantes
     `.alerte.erreur`, `.alerte.succes` et `.alerte.info` ;
   - donner un vrai état désactivé à `.bouton-discret:disabled` et à
     `.bouton-principal:disabled`, et un état `:active` ;
   - remplacer `color: var(--profond|--acquis|--en-cours)` par les jetons de
     texte (rechercher dans `styles.css` et dans les styles en ligne des
     composants).
2. `core/erreurs.ts` : une fonction `messageErreur(e, defaut)`.
   - Status 0 : « Pas de réseau ».
   - 401/403 : droits.
   - 422 : le `detail` du serveur, tel quel.
   - 429 : trop d'essais.
   - 5xx : « Le serveur ne répond pas ».
3. `core/annonces.service.ts` et `<app-annonces>`, posés une fois dans
   `app.component.ts` au-dessus de la barre d'onglets (`--hauteur-onglets`).
   - Un succès s'efface après 5 s.
   - Une erreur reste jusqu'à ce qu'on la ferme.
   - L'annonce est en `aria-live`.
4. `core/dialogue.component.ts` : l'erreur passée en `[erreur]` s'affiche
   juste au-dessus des boutons, collée en bas avec eux, et le dialogue reste
   ouvert.
5. Migrer les écrans qui écrivent succès et erreurs dans un seul signal
   `message`. Il y en a environ 38 ; la liste est dans `audit-transverse.md` T4.
   - Commencer par le bord du bassin : présences, grille, aujourd'hui, fiche
     de sécurité, compléter au retour, programme, planning.
   - Puis tout le reste.
   - Un succès passe par les annonces. Une erreur dans un dialogue va dans son
     `[erreur]`. Une erreur sur un élément précis s'affiche près de lui (carte
     d'élève, critère).

**Aide et vidéos.** Peu de libellés changent. Vérifier que les scénarios ne
lisent pas le texte d'une `.alerte` en haut de page : chercher `.alerte` et
`role="status"` dans `outils/videos/scenarios/`.

**Fini quand.**
- Plus aucun écran n'affiche un succès qui reste à l'écran indéfiniment.
- L'absence de réseau ne s'affiche plus comme « mot de passe incorrect ».
- Les liens et les champs restent lisibles en plein soleil : contraste vérifié
  avec l'outil du navigateur.

## Lot 2 — Confirmations et fenêtres

**But.** Une seule façon de confirmer et une seule fenêtre. Ne plus perdre de
saisie par Échap ou par le geste retour d'Android.

**Références.** `audit-transverse.md` T1 et T2 ; `audit-bassin.md` §3
(notation groupée) ; `audit-admin.md` §9 (planning) ; principe 1 de
`audit-materiel-sorties.md`.

**Étapes.**
1. `core/confirmation.service.ts` et `<app-confirmation>`, construits sur
   `app-dialogue`. `confirmer({ titre, texte, verbe, danger })` renvoie une
   promesse ; le bouton porte le verbe exact (« Supprimer la sortie »), pas
   « OK ».
2. Remplacer les 42 appels à `confirm()`. La liste par écran est dans
   `audit-transverse.md` T1.
3. Ajouter les confirmations absentes : désactiver un moniteur, fermer une
   saison, « Inscrire un groupe » dans un séjour (aujourd'hui l'action part
   dès qu'on choisit la ligne).
4. `app-dialogue` :
   - si le formulaire a été modifié, Échap, ✕, le clic à côté et le retour
     Android demandent « Abandonner la saisie ? » ;
   - le focus initial se place sur le premier champ, et il revient à son point
     de départ à la fermeture.
5. Migrer sur `app-dialogue` les fenêtres faites à la main (inventaire dans
   T2) : la notation groupée d'abord, puis le planning de l'administration,
   les photos de prêt, le trombinoscope, le lecteur des vidéos.
   - La fenêtre de recadrage de photo devient un vrai `<dialog>`, qui gère
     Échap sans fermer le dialogue parent.
   - Sur un refus du serveur, le planning garde sa fenêtre ouverte avec
     l'erreur dedans.

**Aide et vidéos.** Les scénarios qui acceptent une confirmation par
`page.on('dialog')` doivent cliquer à la place le bouton de la fenêtre. Les
trouver en cherchant `dialog` et `confirm` dans `outils/videos/scenarios/`.
Les manuels qui parlent de « confirmer » sont à relire.

**Fini quand.**
- Il ne reste plus aucun `confirm(` dans `frontend/src` (vérifier par une
  recherche).
- Toutes les fenêtres passent en plein écran sur téléphone.
- Une saisie ne se perd plus sans avertissement.

## Lot 3 — Barre d'enregistrement et contexte de séance

**But.** Sur les longues saisies, l'action principale et l'état de
l'enregistrement restent sous le pouce. On sait toujours sur quelle séance on
agit.

**Références.** `audit-bassin.md`, principes 1 et 2.

**Étapes.**
1. `core/barre-action.component.ts`, collée en bas au-dessus des onglets.
   - Elle porte le bouton principal.
   - Elle affiche l'état : « Modifications non enregistrées », « Enregistré à
     9 h 42 », « En attente d'envoi » (file hors ligne) ou l'erreur.
2. Une garde `canDeactivate` commune (il n'y en a aucune aujourd'hui) pour les
   pages qui ont un brouillon : fiche de sécurité, compléter au retour,
   programme d'exercices, fiche d'un équipement, inspection TIV, génération de
   saison.
3. `core/contexte-seance.component.ts`, collé en haut : séance (date, lieu),
   milieu, mode naturel ou entraînement, groupe, et un bouton « Changer ».
   - Il signale quand la séance choisie n'est pas celle du jour.
   - Il remplace les blocs « choix de la séance » des présences, de la grille,
     du programme et de la synthèse.
4. Brancher ces deux composants sur les écrans cités. La refonte de fond de
   chaque écran se fait dans les lots 4 à 6.

**Aide et vidéos.** Les scénarios qui choisissent une séance par son
`<select>` changent de sélecteur. Mettre à jour les manuels de la grille, des
présences, du programme et de la fiche de sécurité (« la barre en bas de
l'écran »).

**Fini quand.**
- Sur ces écrans, plus besoin de remonter ou de descendre pour enregistrer.
- Quitter une page non enregistrée demande une confirmation.

## Lot 4 — Grille de notation

**But.** Noter vite au bord du bassin : les critères au premier écran,
l'élève suivant à portée de pouce, le refus visible là où l'on a touché.

**Références.** `audit-bassin.md` §4 (défauts forts 1 à 4), §5 et §6.

**Étapes.**
1. Réduire l'en-tête de la grille.
   - La jauge, la légende, les alertes et les cartes de programme et
     d'exercices se replient en une ligne de résumé (« ⓘ » pour la légende).
   - Le premier critère doit apparaître dans le premier écran d'un téléphone de
     390 × 800.
2. Contexte de séance collé en haut (lot 3). Un bandeau signale une séance
   choisie d'office qui n'est pas du jour.
3. Élève précédent et suivant dans la barre d'action du bas, avec le prénom de
   l'élève visé.
4. Un refus de note s'affiche sous le critère touché, pas en haut de page.
5. Vue globale (matrice) : en-tête et première colonne figés, séance la plus
   récente à gauche sur téléphone (selon D5). Synthèse de l'élève : le détail
   d'un critère ne passe plus par un simple `title`.

**Aide et vidéos.** Manuels de la grille, de la vue globale et de la synthèse.
Scénarios M04, M19, M20 et E1 (vérifier avec une recherche de `app-grille`,
`/cursus/`, `Noter` et `matrice`). C'est le lot qui change le plus de vidéos.

**Fini quand.** Un moniteur note trois critères de deux élèves sur téléphone
sans remonter la page.

## Lot 5 — Présences, notation groupée, Infos élèves

**Références.** `audit-bassin.md` §2, §3, §8, §12, §13 et §14.

**Étapes.**
1. Feuille de présence : la liste des élèves arrive en premier, après le
   contexte de séance. Les blocs secondaires (synthèse, filtres, notation
   groupée) passent dans une ligne d'actions compacte ou dans « Plus ».
2. Notation groupée, déjà migrée sur `app-dialogue` au lot 2 : « Valider » dans
   le pied collant, et les élèves et critères choisis rappelés en tête.
3. Infos élèves sur téléphone : vue en cartes par élève, séance la plus
   récente d'abord (D5). Le CACI affiche « valide jusqu'au … » ou « expire
   bientôt » en toutes lettres, plus seulement par la couleur.
4. Synthèse de séance : « ECA » au lieu de « EC ».
5. Aujourd'hui : les liens vers l'appel, le programme et la fiche de sécurité
   en gros boutons, dans l'ordre de la soirée.

**Aide et vidéos.** Manuels des présences, de la notation groupée, d'Infos
élèves et d'Aujourd'hui. Scénarios M03, M17 et M18, et ceux d'Infos élèves (à
retrouver en cherchant `/eleves`).

## Lot 6 — Fiche de sécurité et compléter au retour

**Références.** `audit-bassin.md` §9, §10 et §11 (défauts forts 7 et 8).

**Étapes.**
1. Une ligne par plongeur (nom, aptitude, fonction), le détail se déplie à la
   demande. C'est le même principe que les groupes de plongeurs, refaits en
   octobre 2026 : reprendre leur composant comme modèle.
2. « Enregistrer » dans la barre d'action, avec l'état de l'enregistrement, et
   garde de sortie de page (lot 3).
3. Liste des fiches : ouverte sur les prochaines séances, pas sur les plus
   lointaines.
4. Compléter au retour : une palanquée en dépassement remonte en tête ou est
   signalée dans la barre. Retoucher « Immersion » ne doit plus écraser une
   heure déjà saisie sans prévenir.
5. Planning des encadrants : les avertissements de sécurité d'une soirée
   passent en tête de sa carte.

**Aide et vidéos.** Manuels de la fiche de sécurité, de compléter au retour et
du planning. Scénarios correspondants : chercher `fiche-securite` et
`Compléter`.

## Lot 7 — Matériel et prêts

**Références.** `audit-materiel-sorties.md` §1 à §5 (défauts forts : prêts
d'une sortie, retour groupé, retour depuis l'étiquette), principes 2 et 3.

**Étapes.**
1. Prêter à toute une sortie : après un prêt, garder la sortie et les dates.
   Ajouter « Enregistrer et prêter à quelqu'un d'autre ». La case de
   désinfection du détendeur (obligatoire, A322-81) remonte près du choix de
   l'équipement.
2. Retour groupé par sortie : tous les prêts de la sortie cochés « rendu sans
   incident » par défaut, le détail seulement pour les exceptions.
3. Fiche d'un équipement prêté : un bouton « Enregistrer le retour » qui ouvre
   directement ce prêt. Le scanner propose d'abord le geste du moment (rendre,
   prêter, inspecter si la TIV est due) et sert aussi dans le dialogue de prêt.
4. La mise au rebut et la mise hors service passent par une fenêtre, et sortent
   du formulaire toujours affiché ou de « Modifier ».
5. Journée TIV : « Inspecter le bloc suivant » garde le nom et le n° de TIV.
   Garde de sortie de page.
6. Inventaire : une action principale, le reste dans le menu `.menu-actions`.

**Aide et vidéos.** Manuels du matériel, des prêts et du TIV. Scénarios D02 à
D10.

## Lot 8 — Administration (1) : élèves, inscriptions, saisons, moniteurs

**Références.** `audit-admin.md` §1 à §5, §14, et les principes 1 à 5.
Décision **D1**.

**Étapes.**
1. Selon D1 : un écran « Élèves de la saison » qui réunit le dossier, la
   formation et le groupe. Sinon, au minimum, des statuts en toutes lettres
   (plus de `EN_COURS`), la formation et le groupe de la saison sur la fiche
   d'un élève, et un filtre de saison, de niveau et de statut sur les
   inscriptions.
2. Filtres par défaut sur la saison ouverte et les comptes actifs. Recherche
   sur toute liste qui peut dépasser une trentaine de lignes.
3. Accueil de l'administration :
   - les groupes passent avant les inscriptions dans l'ordre conseillé ;
   - des compteurs signalent ce qui attend une action (élèves sans groupe,
     CACI échus…).
4. Moniteurs : un même modèle de ligne, « Modifier » + « Actions ▾ », la
   suppression en dernier.
5. Mon compte : les quatre formulaires deviennent des sections repliées, ou des
   dialogues ouverts par un bouton.

**Aide et vidéos.** Manuels de l'administration (élèves, inscriptions,
saisons, moniteurs, mon compte). Scénarios A01 et suivants.

## Lot 9 — Administration (2) : référentiel, exercices, progressions, planning, séances

**Références.** `audit-admin.md` §6 à §13. Décision **D3**.

**Étapes.**
1. Référentiel MFT : sur chaque version, afficher le nombre de formations en
   cours qui l'utilisent. Avant de modifier une version utilisée, prévenir
   (rétroactivité, voir `CLAUDE.md`).
2. Base d'exercices : recherche et filtres (formation, compétence, phase). Sur
   un exercice déjà noté, proposer « Désactiver » à la place de « Supprimer ».
3. Progressions types : l'édition passe sur une page entière (formulaire long),
   avec la barre d'action et la garde de sortie du lot 3.
4. Planning du bassin : dans la fenêtre d'une soirée, un seul mode
   d'enregistrement, tout sur le même bouton, au lieu d'une partie enregistrée
   tout de suite.
5. Séances : selon D3, renommer « Séjour de plongée », ou le faire créer une
   sortie.

**Aide et vidéos.** Manuels du référentiel, des exercices, des progressions,
du planning et des séances. Scénarios correspondants.

## Lot 10 — Sorties, séjours, page du participant

**Références.** `audit-materiel-sorties.md` §6 à §12. Décision **D2**. La tête
de la page du séjour a déjà été refaite en octobre 2026 (bandeau
« Organisation », version imprimable).

**Étapes.**
1. Selon D2 : une seule liste des sorties et séjours. Sinon, des liens croisés
   clairs entre les deux listes. Sur une carte de sortie, une action principale
   et le reste dans `.menu-actions`.
2. Séjour :
   - des onglets dans un ordre stable, le premier étant celui qui s'ouvre ;
   - les onglets restent en haut de l'écran au défilement ;
   - un seul accès aux frais, qui mène directement à « Ajouter une dépense » ;
   - un filtre « À compléter » sur les participants ;
   - le dialogue des occupants d'une chambre est raccourci.
3. Mes informations : demander d'abord le moyen de transport, puis n'afficher
   que les champs utiles (pas de numéro de vol pour une voiture).

**Aide et vidéos.** Manuels du séjour, du carnet et de la page du lien.
Scénarios A17 et E2.

## Lot 11 — Écrans publics

**Références.** `audit-transverse.md` §1.

**Étapes.**
1. Connexion :
   - les champs dans un `<form>` (Entrée pour valider, gestionnaires de mots de
     passe) ;
   - les messages d'erreur par cas (lot 1, `core/erreurs.ts`) ;
   - « Mot de passe oublié ? » en cible de 44 px.
2. Choix du mot de passe : sur un lien expiré, un bouton « Demander un nouveau
   lien ». Un bouton afficher/masquer sur le champ du mot de passe.
3. Aide : les résultats de recherche annoncés (`aria-live`).
4. Vidéos : sans réseau, dire « Pas de réseau », et non « pas encore
   publiées ».

**Aide et vidéos.** Manuel « Se connecter », scénarios de connexion s'il y en
a.

## Lot 12 — Classes communes, libellés, navigation

**But.** Finir l'harmonisation : les mêmes classes partout, les mêmes mots pour
les mêmes gestes, une navigation qui dit où l'on est.

**Références.** `audit-transverse.md` T6, T8, T9 et T10.

**Étapes.**
1. Classes et composants communs dans `styles.css` et `core/` :
   - classes : `.bouton-danger`, `.entete-page`, `.barre-actions`,
     `.titre-section`, `.champ`, `.pastille` et ses variantes,
     `.choix-segmente`, `.tableau-defilant` ;
   - composants : `app-onglets`, `app-chargement`, `app-etat-vide`.
2. Supprimer les copies locales repérées dans T6 (14 `.danger`, 24 `.case`,
   27 `.actions`…).
3. Libellés :
   - « Ajouter » pour ajouter à une liste, « Nouveau » réservé à la création
     d'un objet à part entière ;
   - « Retirer » d'une liste, « Supprimer » définitivement ;
   - « Fermer » partout pour fermer, sans mélanger ✕ et × ;
   - l'onglet du bas et le menu disent la même chose (« Infos élèves »).
4. Navigation :
   - `aria-current` sur l'entrée active ;
   - « Plus » marqué actif sur les écrans qu'il ouvre, et ouvert en `<dialog>`
     qui gère le focus ;
   - un `title` sur chaque route ;
   - style du bouton « Mettre à jour » du bandeau de nouvelle version.

**Aide et vidéos.** Beaucoup de scénarios cliquent par libellé : rechercher
chaque libellé changé dans `outils/videos/scenarios/` avant de commiter. Ce
lot touche presque tous les manuels pour les mots « Nouveau » et
« Supprimer » : à faire en dernier, d'un bloc.

---

## Suivi

| Lot | Sujet | Statut | Commit |
|---|---|---|---|
| 1 | Socle : couleurs, boutons, retours d'action | à faire | |
| 2 | Confirmations et fenêtres | à faire | |
| 3 | Barre d'enregistrement et contexte de séance | à faire | |
| 4 | Grille de notation | à faire | |
| 5 | Présences, notation groupée, Infos élèves | à faire | |
| 6 | Fiche de sécurité et compléter au retour | à faire | |
| 7 | Matériel et prêts | à faire | |
| 8 | Administration (1) | à faire | |
| 9 | Administration (2) | à faire | |
| 10 | Sorties, séjours, page du participant | à faire | |
| 11 | Écrans publics | à faire | |
| 12 | Classes communes, libellés, navigation | à faire | |

Déjà fait hors plan, en octobre 2026 : tête de la page du séjour (bandeau
« Organisation », version imprimable du carnet) et écran des groupes de
plongeurs (une ligne par plongeur, ajout en haut).
