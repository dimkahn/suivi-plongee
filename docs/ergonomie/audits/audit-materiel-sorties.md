# Audit d'ergonomie : matériel, sorties, séjours

Audit en lecture seule, fait sur les templates et les styles (aucun fichier modifié). Chemins relatifs à
`frontend/src/app/features/`. Gravité : **forte** (une tâche fréquente est pénible, ou une erreur passe
inaperçue), **moyenne** (on perd du temps, on hésite, risque modéré), **faible** (gêne ponctuelle).

---

## 1. Prêts de matériel (`materiel/prets.component.ts`)

| Gravité | Où | Problème vu par l'utilisateur | Correction proposée |
|---|---|---|---|
| **forte** | prets:405-436, 505-516 | Avant une sortie, le DT prête du matériel à 10 ou 15 personnes. Après chaque prêt, le formulaire se vide (`reinitialiserFormulaire`) : il faut rouvrir « Nouveau prêt » puis ressaisir la sortie, les dates et le motif à chaque emprunteur. | Après l'enregistrement, garder la sortie, les dates et le motif. Ajouter un bouton « Enregistrer et prêter à quelqu'un d'autre » qui ne vide que l'emprunteur et le matériel. Ou ouvrir l'écran depuis une sortie (`?sortie=`) avec la sortie déjà choisie. |
| **forte** | prets:208-213, 220-248 | Au retour d'une sortie, il faut rendre les prêts un par un : un dialogue par emprunteur, avec un champ incident et une case par équipement. Pour 15 prêts, cela fait 15 dialogues. | Ajouter un « Retour groupé » par sortie : la liste des prêts de la sortie, chacun coché « rendu sans incident » par défaut, et un bouton « Signaler un problème » sur une ligne pour ouvrir le détail actuel (incident, hors service, photos). Un seul bouton « Valider les N retours ». |
| **forte** | fiche-equipement:286-291 (lien vers prets) | Rendre un équipement depuis son étiquette prend trop d'étapes : scanner, ouvrir la fiche, « Voir les prêts », retrouver l'emprunteur dans toute la liste, puis « Enregistrer le retour ». | Sur la fiche d'un équipement prêté, mettre un bouton principal « Enregistrer le retour » qui ouvre directement le dialogue du bon prêt (par exemple `/materiel/prets?retour=<pretId>`). |
| moyenne | prets:164-216 | La liste « En cours » n'a ni recherche ni regroupement. Pendant une sortie, il faut faire défiler toutes les cartes pour trouver un nom. « Rendus » grossit sans limite et n'a pas de filtre non plus. | Ajouter une recherche (emprunteur, référence) et un regroupement par sortie avec intertitres, les prêts en retard en tête. Pour « Rendus », ajouter un filtre par saison ou par sortie. |
| moyenne | prets:127-132 | La case « détendeurs désinfectés », obligatoire selon le Code du sport, n'apparaît qu'en bas du dialogue, sous la liste du matériel, qui défile. Si on l'oublie, le refus du serveur s'affiche en haut du dialogue, hors de la vue. | Placer la case juste sous la puce du détendeur choisi dans « Matériel choisi », et désactiver « Enregistrer le prêt » tant qu'elle n'est pas cochée, avec la raison écrite à côté du bouton. |
| moyenne | prets:92-118 | Le matériel se choisit dans une liste qui défile (`max-height: 360px`) à l'intérieur d'un dialogue qui défile lui aussi : sur téléphone, deux défilements imbriqués. L'onglet de type s'ouvre sur « Blocs » même si l'emprunteur vient chercher un détendeur. Et les étiquettes QR ne servent à rien à cet endroit. | Retirer la hauteur maximale (la liste suit le défilement du dialogue). Ajouter dans le dialogue « Scanner un équipement » pour ajouter un équipement d'un coup d'appareil photo. |
| faible | prets:209-212 | « Annuler le prêt » est un bouton de même taille, placé juste à côté de « Enregistrer le retour ». | Le mettre dans un menu `.menu-actions` (« Plus… »), en rouge, avec sa confirmation actuelle. |
| faible | prets:39, 41, 220 | `message()` sert à la fois au bandeau de la page et à l'erreur des deux dialogues. Une erreur affichée dans le dialogue reste ensuite sur la page une fois le dialogue fermé. | Séparer `erreur` (dialogue) et `message` (page), comme dans `sejour.component`. |

## 2. Inventaire (`materiel/inventaire.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | inventaire:23-48 | Pour le DT, l'en-tête aligne six boutons, dont deux principaux qui se concurrencent (« Scanner », « Prêts »), plus un paragraphe juridique. Sur téléphone, ils prennent un écran entier avant les compteurs. Import et export du classeur ne servent qu'une ou deux fois par an. | Garder deux actions visibles (« Scanner » en principal, « Prêts ») et regrouper « Ajouter un équipement », « Sorties », « Importer » et « Exporter » dans un menu « Plus… » (`.menu-actions`). Mettre le paragraphe sur l'annexe III-27 dans le manuel ou en `<details>`. |
| moyenne | inventaire:94-110 | « À surveiller » liste toutes les alertes sans limite, au-dessus des filtres. Avec un parc ancien (TIV à faire en série), la liste du matériel se retrouve plusieurs écrans plus bas. | Remplacer la liste par un compteur cliquable (« 12 à surveiller », qui filtre la liste comme les compteurs de statut), ou afficher les 3 premières alertes et un lien « voir tout ». Les alertes bloquantes d'abord. |
| faible | inventaire:112-135 | Il y a trois façons de filtrer (compteurs de statut, types, case « rebut »), et cliquer le compteur « Au rebut » coche la case en silence. Cela reste lisible mais déroute. | Fusionner les deux : les types en onglets, les statuts en compteurs. Supprimer la case et ne compter le rebut que si on clique son compteur. |

## 3. Fiche d'un équipement (`materiel/fiche-equipement.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | fiche:56 et 265-270 | Le formulaire de création ou de modification est long et son bouton « Enregistrer » est en bas. L'erreur (référence déjà prise, champ obligatoire) s'affiche tout en haut de la page, donc hors de la vue : appuyer sur le bouton semble sans effet. Même problème pour les erreurs de mise au rebut (fiche:722-724). | Afficher l'erreur juste au-dessus des boutons du formulaire, comme le fait déjà `saisie-inspection-tiv:165`, ou faire défiler la page jusqu'au bandeau d'erreur. |
| moyenne | fiche:454-479 | La mise au rebut (date et motif) est un formulaire affiché en permanence en bas de chaque fiche, alors que le geste est rare et définitif. C'est contraire à la règle « modifications dans un dialogue ». | Ajouter un bouton « Mettre au rebut… » (rouge, dans un menu « Plus… » de la barre d'actions) qui ouvre un dialogue date + motif, avec un texte qui explique ce qui en découle (plus prêté, fiche conservée 3 ans). |
| moyenne | fiche:255-260 | Mettre hors service ou remettre en service (après un incident, après une révision) oblige à passer par « Modifier », à descendre jusqu'à « Divers », puis à enregistrer tout le formulaire. | Ajouter des boutons directs « Mettre hors service » / « Remettre en service » dans la barre d'actions, qui écrivent aussi une ligne au journal avec un motif saisi dans un petit dialogue. |
| faible | fiche:462-464 | « Annuler la mise au rebut » agit sans demander de confirmation. | Ajouter une confirmation. |
| faible | fiche:65-271 | En création, toutes les rubriques sont ouvertes (dates, entretien, historique). C'est long pour enregistrer un gilet. | Laisser ouvertes Type, Identification et Caractéristiques, et replier « Dates », « Entretien » et « Historique » (`<details>`) avec la mention « facultatif ». |

## 4. Scanner et étiquettes (`materiel/scanner.component.ts`, `materiel/etiquettes.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | scanner (template, l. 28-46 du fichier) | Le scanner ne sait qu'ouvrir la fiche. On scanne pourtant surtout pour prêter ou rendre (voir le § 1). | Après une lecture, ouvrir la fiche avec l'action du moment en premier (« Enregistrer le retour » si l'équipement est prêté, « Prêter » s'il est disponible). Ou proposer des modes « Prêter / Rendre / Consulter » en haut du scanner. |
| faible | scanner:42 | Sur Android, il faut encore appuyer sur « Ouvrir la caméra » alors que c'est la seule raison de venir sur cette page. | Démarrer la caméra à l'ouverture quand `BarcodeDetector` existe, en gardant « Arrêter ». |

Étiquettes : rien de bloquant.

## 5. Inspection TIV (`materiel/saisie-inspection-tiv.component.ts`, `materiel/rapport-inspection-tiv.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | saisie:303 | Une journée TIV, c'est 20 à 40 blocs. Après chaque fiche, l'appli ouvre le compte rendu et rien n'aide à passer au bloc suivant : il faut retourner à l'inventaire, rechercher, ouvrir la fiche, puis « Remplir la fiche d'inspection ». | Sur le compte rendu juste enregistré, ajouter « Fiche enregistrée » et deux boutons : « Inspecter un autre bloc » (scanner ou recherche par référence) et « Bloc suivant » (prochain bloc dont l'inspection est due). Le nom et le numéro de TIV sont déjà repris. |
| moyenne | saisie:40-174 | Le formulaire est long (une trentaine de questions) et rien n'avertit si on quitte la page : un appui sur « ← retour » de la barre de page, ou sur « Annuler », efface tout sans prévenir. | Demander une confirmation avant de quitter dès qu'une réponse ou un champ a été modifié (garde `canDeactivate` + `beforeunload`). |
| faible | saisie:149-153, 245 | La décision reste sur « Favorable » même quand un défaut qui l'interdit est coché. L'alerte rouge prévient, mais seulement en bas. | Passer d'office sur « Défavorable » dès qu'un défaut qui l'interdit est coché, et montrer en tête de la rubrique Décision le nombre de défauts relevés. |
| faible | saisie:173 | « Une fiche enregistrée ne se modifie plus » est écrit sous le bouton, donc lu après coup. | Mettre la phrase au-dessus du bouton « Enregistrer la fiche ». |
| faible | rapport:113-116 | « À enregistrer aussi sur le dispositif fédéral en ligne », une démarche que le TIV doit faire, est noyé en petit gris en bas de page. | En faire un encadré au-dessus du compte rendu (masqué à l'impression). |
| faible | rapport:68-85 | Tableau à 4 colonnes sur 390 px : il ne déborde pas mais il est très serré. | Sous 600 px, présenter chaque constat comme une ligne « libellé + Oui/Non », la décision et la date en dessous. |

## 6. Sorties (`admin/sorties.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | sorties:106-120 | Chaque carte aligne cinq boutons, dont un principal sur toutes les lignes (« Choisir les plongées ») et un « Supprimer » rouge à portée de doigt. C'est contraire à la convention du menu « Actions » (`.menu-actions`). | Rendre la carte cliquable (vers le séjour) et mettre « Choisir les plongées », « Imprimer les fiches », « Modifier » et « Supprimer » dans un menu `.menu-actions`, « Supprimer » en dernier, en rouge. |
| moyenne | sorties (tout) et sejours-liste | Il existe deux listes des mêmes sorties (`/admin/sorties` et `/sejours`). On crée et on choisit les plongées d'un côté, on organise de l'autre, et on passe de l'une à l'autre par « Gérer le séjour ». Un organisateur ne sait pas où chercher. | Refonte : une seule liste « Séjours / sorties ». « Nouvelle sortie » y est proposé à ceux qui ont le droit (ADMIN, DT), et l'onglet Programme du séjour reçoit « Choisir / créer les plongées » et « Imprimer les fiches de sécurité ». `/admin/sorties` redirige vers cette liste. |
| faible | sorties:188-211, 415-437 | « Créer les plongées » (dans un `<details>` du dialogue) crée les séances, les enregistre et ferme le dialogue d'un coup. On s'attend plutôt à voir les nouvelles plongées cochées dans la liste. | Après la création, laisser le dialogue ouvert avec les nouvelles plongées cochées, et enregistrer seulement avec « Enregistrer les plongées ». |
| faible | sorties:161, 191 | Pour une sortie d'un jour (`dateFin` vide), le texte devient « du 10/10/2026 au . » (à vérifier si le serveur remplit toujours `dateFin`). | Utiliser `periode(dateDebut, dateFin)`, comme dans la liste. |

## 7. Liste des séjours (`sejours/sejours-liste.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | sejours-liste:16-25, 47 | Aucun bouton de création. Un moniteur (ni ADMIN ni DT) qui veut organiser un séjour voit « Aucune sortie. » sans savoir quoi faire. L'ADMIN ou le DT est envoyé vers un autre écran par une simple phrase. | Mettre un bouton « Nouvelle sortie » ici pour ceux qui ont le droit (voir la refonte du § 6). Pour les autres, une phrase d'état vide qui explique : « Demandez au directeur technique ou à un administrateur de créer la sortie ; vous pourrez en être organisateur. » |
| faible | sejours-liste:27-32 | La carte « Groupes de plongeurs » est placée avant la liste et ressemble à un séjour. | La passer en lien secondaire à droite du titre, ou sous la liste. |

## 8. Séjour (`sejours/sejour.component.ts`) : onglets et dialogues

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | sejour:1015-1022, 999, 127-148 | L'onglet « Frais » est le premier de la rangée, mais la page s'ouvre sur « Programme ». En plus, un encart « Frais du séjour » se trouve au-dessus des onglets, et « Mon séjour » y renvoie aussi : trois accès au même contenu, et une rangée d'onglets dont le premier n'est pas celui affiché. | Remettre « Programme » en premier (onglet par défaut) et « Frais » à sa place logique. Réduire l'encart à une ligne (total + « mon solde ») avec un bouton direct « + Ajouter une dépense », l'action la plus fréquente pendant le séjour, au lieu de « Gérer les frais ». |
| moyenne | sejour:161-170 | Sur téléphone, les onglets arrivent après le titre, le bandeau d'organisation, « Aujourd'hui », l'encart des frais et « Mon séjour », soit à peu près deux écrans plus bas. Une fois qu'on a défilé dans un onglet, il faut remonter tout en haut pour en changer. | Rendre la rangée d'onglets collante (`position: sticky; top: 0`, sous la barre de page) dès qu'elle atteint le haut de l'écran. |
| moyenne | sejour:119, 1626-1647 | Les messages de réussite (« Trajet enregistré… ») et les erreurs d'une action faite hors dialogue (supprimer une voiture, inscrire un groupe) s'affichent tout en haut de la page, au-dessus de « Aujourd'hui », alors qu'on travaille dans un onglet plus bas. On ne les voit pas. | Afficher le message dans l'onglet actif, juste sous la rangée d'onglets, ou dans un bandeau temporaire fixé en bas au-dessus de `--hauteur-onglets`. |
| moyenne | sejour:228-236, 1432-1440 | « Inscrire un groupe de plongeurs… » est une liste déroulante qui agit dès qu'on choisit une valeur, sans bouton ni confirmation : choisir une option inscrit tout un groupe. Sur téléphone, on touche facilement la mauvaise ligne. | Remplacer par un bouton « Inscrire un groupe… » qui ouvre un dialogue : choix du groupe, aperçu de qui sera ajouté et de qui ne sera pas lié, puis « Inscrire N personnes ». |
| moyenne | sejour:246-293 | La liste des participants n'a ni recherche ni filtre. Repérer « qui n'a pas encore donné ses infos » oblige à lire chaque ligne. | Ajouter des filtres en puces : « Tous / À compléter / Plongeurs / Accompagnants », et une recherche par nom dès 15 participants. |
| moyenne | sejour:500-603 | Le dialogue d'un participant affiche d'un coup une vingtaine de champs (identité, groupe, même voyage, sept champs d'arrivée, cinq de départ, repas, urgence, remarques). Pourtant l'organisateur n'a besoin à l'inscription que du nom et de l'e-mail : le reste est rempli par le participant par le lien. | En création, ne montrer que l'identité (membre du club ou invité, e-mail, plongeur), puis « Enregistrer » ou « Compléter son voyage, ses repas… ». En modification, replier Arrivée, Départ, Repas et Urgence (`<details>`, avec un résumé de ce qui est rempli). |
| moyenne | sejour:649-685 | Les occupants se choisissent dans le dialogue du logement : chaque chambre affiche la liste des participants à cocher. Pour 6 chambres et 20 personnes, le dialogue devient très long, et pour changer quelqu'un de chambre il faut rouvrir tout le logement. | Séparer la structure (logement + chambres, dans le dialogue) de la répartition : sur la carte de chaque chambre, un bouton « Choisir les occupants » qui ouvre un petit dialogue propre à cette chambre (même principe que les passagers d'une voiture). |
| faible | sejour:105-114 et 221-227 | « Demander les informations… » apparaît deux fois (bandeau et onglet Participants), avec deux libellés proches de « Lui demander ses informations ». | Le garder dans l'onglet Participants (là où se voient les infos manquantes) et dans le bandeau ne laisser que les actions sur le carnet. |

## 9. Frais (`sejours/sejour-frais.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| faible | frais:200-203 | Le menu « Payé par » est grisé sans explication pour un participant qui ne peut saisir que ses propres dépenses. | Remplacer le menu par le texte « Payé par vous », avec une ligne d'aide. |
| faible | frais:191-283 | Sur téléphone, la photo de la note se place après le libellé et le montant. Au restaurant, on photographie d'abord le ticket. | Mettre « Prendre une photo » en tête du dialogue de création. |

Le reste de l'écran est bien construit : partage « tout le monde » par défaut, « C'est remboursé » qui pré-remplit le remboursement, confirmations avant suppression.

## 10. Page publique du participant (`sejours/espace-participant.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| faible | espace-participant:203 | Quelqu'un qui arrive par l'e-mail « renseignez vos informations » tombe sur l'onglet « Carnet ». C'est atténué par la carte « Mon séjour », qui signale en orange ce qui manque. | Ouvrir « Mes informations » d'abord tant que le participant n'a rien renseigné (ou si le lien porte `?infos`), et « Carnet » ensuite. |
| faible | espace-participant:124-136 | « Changer d'adresse ou renvoyer » mélange deux gestes et oblige à retaper l'adresse pour renvoyer le code. | Séparer en deux boutons : « Renvoyer le code » (actif après 60 s, avec le délai affiché) et « Changer d'adresse ». |

## 11. Mes informations (`sejours/mes-informations.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | mes-informations:24-54 | Pour chaque sens, sept champs, dont « N° de vol ou de train », « Heure de départ de l'avion » et « Aéroport ou gare », même pour quelqu'un qui vient en voiture. Le choix du moyen de transport n'arrive qu'en troisième. Pour un élève ou un parent sur téléphone, c'est le formulaire le plus long du parcours. | Commencer chaque sens par « Comment venez-vous ? » (gros boutons Voiture / Train / Avion / Autre), puis n'afficher que les champs utiles : voiture → jour, heure ; train ou avion → numéro, gare ou aéroport, heure de départ. Même règle dans le dialogue participant de l'organisateur (sejour:547-574). |

## 12. Carnet (`sejours/carnet-sejour.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| faible | carnet:148-153 | Les infos pratiques (numéros d'urgence, caisson, centre de plongée), précieuses sur place, arrivent en dernier, après tout le programme. | Pendant le séjour, remonter les infos pratiques juste après « Mon séjour », ou au moins garder dans le sommaire un bouton « Urgences » en premier. |

---

## Principes transverses

1. **Une erreur s'affiche là où on regarde.** Plusieurs écrans écrivent leurs erreurs et leurs confirmations tout en haut de la page ou du dialogue, alors que le bouton est en bas : fiche équipement, prêts, séjour, et le `DialogueComponent` lui-même, dont la zone d'erreur ne colle pas au haut de l'écran contrairement à `.actions-dialogue`. Il faut une règle commune : erreur juste au-dessus des boutons, collée en bas avec eux, ou défilement automatique jusqu'à elle. Le plus efficace est de corriger une fois dans `core/dialogue.component.ts`.
2. **Les tâches répétées se font en série.** Prêter à 15 élèves, rendre 15 prêts, inspecter 30 blocs : chaque écran est pensé pour un seul élément. Il faut garder le contexte d'un élément à l'autre (sortie, dates, nom du TIV), proposer « …et un autre », et des actions groupées par sortie avec le détail seulement pour les exceptions.
3. **L'étiquette QR mène à l'action, pas seulement à la fiche.** Le scanner et la fiche doivent proposer en premier le geste du moment (rendre un équipement prêté, prêter un équipement disponible, inspecter un bloc dont la TIV est due), et le scanner doit être disponible là où l'on choisit du matériel (dialogue de prêt).
4. **Une seule action principale par écran et des menus pour le reste.** Rangées de cinq ou six boutons (inventaire, sorties) et « Supprimer » rouge à côté des autres : il faut appliquer partout le menu `.menu-actions` déjà utilisé pour Moniteurs et Élèves, et mettre les gestes rares ou définitifs (rebut, import, suppression) derrière un dialogue.
5. **Un objet, un endroit.** Une sortie et son séjour sont le même objet vu par deux listes, et les frais ont trois accès sur la même page. Il faut réunir ces accès (une liste des sorties et séjours, création comprise, et un accès aux frais qui mène directement à l'ajout d'une dépense) et garder des onglets dans un ordre stable, le premier étant celui qui s'ouvre.
