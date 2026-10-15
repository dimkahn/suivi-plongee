# Audit d'ergonomie : écrans « bord du bassin » des encadrants

Périmètre : `frontend/src/app/` (chemins relatifs à ce dossier). Lecture seule, aucune modification.
Gravité : **forte** = gêne ou erreur probable à chaque séance ; **moyenne** = ralentit ou embrouille ; **faible** = finition qui a quand même un effet sur l'usage.

---

## 1. Navigation générale : `app.component.ts`, `core/barre-page.component.ts`

| Gravité | Où | Problème vu par un moniteur | Correction proposée |
|---|---|---|---|
| moyenne | app.component.ts:99-103 | « Préparer hors ligne », LE geste à faire avant de partir au bassin, est caché dans « Plus » (téléphone), entre deux séparateurs, sans indiquer quand il a été fait pour la dernière fois. | Le mettre en carte sur `/aujourdhui` (« Préparé hors ligne le … · Mettre à jour »), et le laisser aussi dans le menu. |
| faible | app.component.ts:56-58 et 265 | Le même écran s'appelle « Infos élèves » dans le menu et « Élèves » dans l'onglet du bas. | Un seul nom (« Élèves » partout, titre de page compris), ou « Infos élèves » partout si la largeur le permet. |
| faible | app.component.ts:52-112 | Entre 861 et ~1300 px (tablette posée au bord du bassin), l'en-tête aligne 11 à 13 liens de même poids sur deux ou trois lignes : rien n'aide à trouver le bon. | Regrouper en 4-5 entrées (Aujourd'hui, Séances [Présences, Fiches, Planning], Élèves [Infos, Trombinoscope, Parcours], Séjours, Admin) ou passer au menu « Plus » dès 1100 px. |
| faible | core/barre-page.component.ts:20-35 | La barre de retour n'est pas collante. Sur les pages longues (grille, fiche de sécurité), revenir oblige à remonter tout en haut. | Rien à changer dans la barre elle-même. C'est la barre d'action en bas (principe transverse 1) qui doit porter les gestes de sortie utiles (élève suivant, enregistrer). |

## 2. Aujourd'hui : `features/accueil/aujourdhui.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :90-96 | « 3 présents sans évaluation » est en gras mais on ne peut pas le toucher. Le moniteur doit passer par « Appel et notes » puis trouver le bouton de filtre. | En faire un lien vers `/presences?seance=…&nonNotes=1` (feuille ouverte directement sur le filtre « présents sans évaluation »). |
| moyenne | :129-135 | Les raccourcis du bas (« Infos élèves », « Trombinoscope ») doublent les onglets. L'état de la synchro (« 3 saisies en attente ») y est relégué en petit texte gris. | Remplacer ce bloc par une carte « Sur cet appareil » : saisies en attente (avec le bouton Envoyer), dernière préparation hors ligne et le bouton « Préparer hors ligne ». |
| faible | :101-118 | Une sortie de 2 plongées affiche 2 cartes de 3-4 boutons chacune. « Compléter au retour de plongée » (le geste du jour) a le même poids que « Programme d'exercices ». | Le jour J, après l'heure de la séance, faire de « Compléter au retour » le bouton principal de la carte (la notation reste dans « Appel et notes »). |

## 3. Présences / appel : `features/presences/presences.component.ts` (+ `notation-groupee.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| **forte** | :148-293 | Sur téléphone, avant le premier élève on traverse : le choix de séance, le programme de la période, le bloc « Exercices de la séance », le filtre de groupe, la recherche, le bilan, le bouton de filtre, « Synthèse des notes », « Noter les présents » et sa phrase d'aide. Le premier élève arrive à environ deux écrans du haut, alors que l'appel est le geste n° 1. | Ouvrir la page sur la liste : séance en barre compacte collante, filtre de groupe et recherche sur une ligne, bilan collant. Programme et exercices dans un bouton « Programme (5) » qui ouvre un dialogue. « Noter les présents » et « Synthèse » dans une barre d'action en bas, au-dessus des onglets. |
| **forte** | notation-groupee.component.ts:34-149 | La notation groupée s'ouvre dans `<dialog class="dialogue-seance">` et non dans `app-dialogue`. Elle n'est donc pas en plein écran sur téléphone et son pied n'est pas collant. « Valider la notation » se trouve tout en bas, après la liste des élèves et tous les blocs dépliés. Le compte des commentaires manquants n'est visible qu'une fois arrivé là. | Passer sur `app-dialogue [large]`, `.actions-dialogue` collant (« Valider · 3 élèves × 2 critères », plus « 1 commentaire manquant »). Mieux : un assistant en 2 étapes (1. élèves, 2. critères et commentaires, avec un récapitulatif avant de valider). Raccourcir le paragraphe :40-44 à une ligne. |
| moyenne | :107 et :913-926 | Une présence refusée ou en échec (« La présence de X n'a pas pu être enregistrée ») s'affiche en haut de page. Le moniteur, qui a fait défiler jusqu'au 15ᵉ élève, ne la voit pas. | Montrer l'échec sur la carte de l'élève (bordure rouge, « Échec, toucher pour réessayer »), et dans un toast commun en bas d'écran. |
| moyenne | :303, :348-363, :892 | Sur téléphone, chaque choix referme la barre (`choisirEtFermer`). « Bloc + théorie » demande donc deux ouvertures. Le cas le plus courant (tout le monde en « Bloc ») coûte 2 touchers par élève. | Mode « appel rapide » : choisir une fois l'atelier du soir en tête (« Ce soir : Bloc »), puis un toucher sur la carte bascule présent/absent. La barre du bas reste pour les exceptions, et la théorie ne la referme pas. |
| faible | :267-279 | « Voir les présents sans évaluation » et « Synthèse des notes » sont des boutons isolés entre le bilan et la liste. On croit qu'ils agissent sur la séance, alors que le premier filtre la liste. | Faire de « sans évaluation » une puce de filtre dans le bilan collant (« 12 présents · 3 sans évaluation ▸ »). La synthèse passe dans la barre d'action. |

## 4. Fiche de suivi / notation : `features/grille/grille.component.ts` (écran prioritaire)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| **forte** | :110-182, :280-482 | Avant la première compétence : un en-tête avec une jauge SVG de 168 px de haut, quatre boutons d'action, une ou deux alertes, la séance, « Noter au nom de », la légende, le message, la carte « Au programme » et la carte « Exercices de la séance ». Sur un téléphone de 390 px, le premier critère à noter est à 2-3 écrans du haut. | En-tête compact sur une ligne (photo 40 px, nom, barre horizontale « 34/80 acquis »). « Vue globale », « Synthèse » et « Tout ouvrir » passent dans « Plus d'actions ». Les alertes de mode deviennent une pastille dans la barre de séance (voir ci-dessous). Les cartes programme et exercices sont repliées par défaut avec leur compte. |
| **forte** | :306-314, :1955 | La séance évaluée et le mode (naturel ou entraînement) ne restent pas visibles. Une fois dans les blocs, le moniteur ne sait plus sur quelle séance il note. À l'ouverture, la séance présélectionnée est « la dernière où l'élève est présent », qui peut dater de plusieurs semaines si l'appel du jour n'est pas fait, et rien ne le signale. | Barre de contexte collante en haut : « 📅 sam. 12/10 · Fosse · entraînement [Changer] ». Si la séance présélectionnée n'est pas celle du jour, le dire (« Dernière séance où il est noté présent : 14/09. Faites l'appel du jour pour noter aujourd'hui »). |
| **forte** | :93-109 | « ‹ Élève précédent | 3/12 | Élève suivant › » n'existe qu'en haut. Après avoir noté le dernier critère, il faut remonter toute la page pour passer à l'élève suivant. | Barre collante en bas, au-dessus des onglets, quand on vient de la feuille de présence : « ‹ Léa · 3/12 · Hugo › ». Remettre la page en haut au changement d'élève. |
| **forte** | :382, refus dans `noter()` :2060-2068 | Un refus (« Choisissez d'abord la séance évaluée », « pas noté présent », règle de maîtrise) s'écrit dans l'alerte de la ligne 382, au-dessus du programme. Le moniteur, qui a touché « A » 3 écrans plus bas, ne voit rien se passer. | Retour sur le critère lui-même (ligne d'erreur sous les boutons NA/ECA/A, bouton qui tremble), plus le toast commun. L'alerte du haut reste réservée aux messages de page. |
| moyenne | :422-482 et :484-587 | Un même critère s'affiche deux fois : sous l'exercice de la séance (on note l'exercice) et dans sa compétence (on note le critère ou l'exercice choisi). Les deux jeux de boutons NA/ECA/A ne montrent pas forcément le même état, ce qui sème le doute (« je l'ai noté ou pas ? »). | Deux onglets : « Séance du jour » (les exercices du programme et leurs critères, onglet par défaut s'il existe un programme) et « Toutes les compétences ». Un critère n'apparaît qu'une fois par vue. |
| moyenne | :610-773 | Une ligne de critère peut cumuler : libellé, « Exercice : … », critère de réalisation, trace, commentaire, « Critère : … », autre suivi, puis « 1. Exercice », les exercices déjà notés, la réussite, le schéma, le conseil, « Fiche complète », « 2. Note », NA/ECA/A, « Commenter » et « Voir l'historique ». Avec les mains mouillées, on ne trouve plus les trois boutons. | Garder sur la ligne : le libellé, l'état, la puce de l'exercice (qui ouvre le choix), NA/ECA/A et « ⋯ » (commenter, historique). La réussite, le schéma, le conseil et la fiche ne vivent que dans le dialogue de choix d'exercice, qui les montre déjà en partie (:828-898). |
| moyenne | :761-789 | Le commentaire est un geste à part : « Commenter », puis la zone de texte, puis « Enregistrer le commentaire ». Il n'est pas proposé juste après une note, alors que c'est là qu'on a quelque chose à dire. | Après un toucher sur NA/ECA/A, afficher quelques secondes sous le critère une puce « + Ajouter un commentaire » qui ouvre un petit dialogue (texte et Enregistrer). |
| moyenne | :570-576 | Un paragraphe d'aide de trois lignes se répète en haut de chaque compétence dépliée. | L'afficher une seule fois (ou le mettre dans « Comment faire ? »). |
| faible | :736 ; aussi programme-exercices.component.ts:222, :441 | « Fiche complète ↗ » s'ouvre avec `target="_blank"`. Dans l'appli installée (surtout sur iPhone), la fiche s'ouvre hors de l'appli, sans la session (le jeton vit dans un signal), d'où une reconnexion ou une page vide. | Ouvrir la fiche dans un `app-dialogue large` (le composant de fiche existe), ou par `routerLink` dans le même onglet (le retour est géré par la barre de page). |
| faible | :899-906 | Toute erreur de chargement affiche « Cette grille n'est pas disponible hors ligne », même en ligne (droits, erreur serveur). | Distinguer hors ligne et erreur serveur, et montrer le `detail` du ProblemDetail. |

## 5. Vue globale : `features/grille/matrice.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :29-78 | Sur téléphone : 2 cases à cocher, 3 boutons de milieu, un paragraphe d'explication et 2 à 3 paragraphes de légende avant le tableau. | Garder les filtres sur une ligne et mettre légende et explication dans un « Légende ⓘ » qui ouvre un dialogue. |
| moyenne | :83-174, :305-316 | Sous 721 px, l'en-tête des dates n'est plus collant et la colonne figée prend 45vw. On voit environ 2 séances, et la plus récente est tout à droite, au bout d'un long défilement horizontal. | Sur téléphone, mettre la séance la plus récente à gauche ou faire défiler automatiquement jusqu'à la dernière colonne, et garder l'en-tête collant. Variante : une liste de critères (état actuel) dont un toucher ouvre l'historique du critère. |
| faible | :146-147 | Les cases notées s'ouvrent par un clic sur `<td>`, ni focalisable ni annoncée. | Mettre un `<button>` plein-case dans les cellules notées. |

## 6. Synthèse A / ECA / NT : `features/grille/synthese-eleve.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :55-107 | Trois représentations de la même chose (compteurs, camembert avec une légende de trois lignes, grille de 10 anneaux) avant les listes. Ce que le moniteur lit vraiment, les critères des compétences en cours, arrive après deux écrans. | Garder les compteurs et une seule figure (les anneaux, cliquables). Réserver le camembert à l'impression ou le retirer. |
| faible | :117-152 | Une compétence « ECA » ne mène pas à sa compétence dans la grille, pour la noter. | Lien « Noter » vers `/cursus/:id` avec la compétence ouverte (`?bloc=`). |

## 7. Programme d'exercices : `features/seances/programme-exercices.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :96-103 | La séance se choisit dans un `<select>` natif qui liste toute la saison, alors que les Présences, la grille et les fiches utilisent le bouton et le calendrier (`choix-seance`). C'est un geste différent pour la même chose. | Reprendre `choix-seance` et `app-calendrier-seances`. |
| moyenne | :105-111 | Un paragraphe de cinq lignes en tête, à chaque visite. | Une ligne (« Préparer un programme ne note aucun élève »), le reste dans « Comment faire ? ». |
| moyenne | :233-346 | Un exercice libre s'édite dans la liste avec 8 champs visibles d'un coup (intitulé, phase, formation, durée, consignes, réussite, schéma, critères), plus le choix des critères déplié dans la carte et trois boutons ↑ ↓ Supprimer. Avec 6 exercices, la page devient interminable sur téléphone. | Carte compacte (n°, phase, intitulé, durée, « 3 critères ») avec un bouton « Modifier » qui ouvre un `app-dialogue large`. Monter et descendre passent dans un menu « ⋯ » ou deviennent des poignées de glisser. |
| moyenne | :117 et :946-967 | Les messages (« 3 exercices repris : vérifiez-les puis enregistrez », erreurs) s'affichent en haut, alors que les gestes se font en bas (ajouts, barre d'enregistrement). | Afficher le message dans la barre d'enregistrement collante (:378-386), qui a déjà « Modifications non enregistrées ». |
| moyenne | :655, :673 (aucun `canDeactivate` dans l'appli) | La confirmation de perte des modifications n'existe qu'au changement de séance ou de groupe. Le retour de la barre de page ou un onglet du bas jettent le programme en cours sans prévenir. | Une garde commune `canDeactivate` (« modifications non enregistrées »), branchée ici et sur la fiche de sécurité. |
| faible | :369 | « Reprendre les exercices d'une autre séance » agit dès le `change` du select : un choix fait par erreur en faisant défiler ajoute des exercices. | Un dialogue « Reprendre » : choix de la séance, aperçu, puis bouton « Ajouter ces 4 exercices ». |

## 8. Synthèse des notes d'une séance : `features/seances/synthese-seance.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :72-120 | La vue d'ouverture est le tableau aux en-têtes verticaux, large sur téléphone. Le détail d'une case n'est que dans un `title` (:102), invisible au doigt. | Sous 600 px, ouvrir sur « Par élève ». Les cases deviennent des boutons qui ouvrent le détail (exercice, encadrant, commentaire). |
| faible | :120, :308-309 | La légende et les cases disent « EC » alors que tout le reste de l'appli dit « ECA ». | Aligner sur « ECA ». |
| faible | :223 | Lien élève de la colonne figée : `min-height: 32px`, sous les 44 px. | 44 px. |
| faible | :52 | « Imprimer » est rangé dans le groupe des niveaux et ressemble à un niveau de plus. | Le placer à droite du titre, comme dans la synthèse élève. |

## 9. Liste des fiches de sécurité : `features/fiche-securite/fiches-securite-liste.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :204 (`tri = 'DATE_RECENTE'`), :28-54 | Le tri par défaut, « la plus récente d'abord », met en tête les séances les plus lointaines de la saison générée. La plongée du jour est au milieu de la liste, sous trois champs de filtre. | Ouvrir sur une rubrique « Aujourd'hui », puis « À venir » et « Passées ». Replier les filtres derrière un bouton « Filtrer ». |
| moyenne | :20-26 | Un paragraphe juridique de cinq lignes (A322-72, A322-98) à chaque ouverture. | Une ligne « Séances en milieu naturel ou de plus de 6 m », le reste dans « Comment faire ? ». |
| faible | :141-145 | « Compléter au retour de plongée » est proposé aussi pour les séances futures. Les deux boutons de la ligne ont le même poids, quelle que soit l'heure. | N'afficher « Compléter » qu'à partir du jour J, et en faire le bouton principal ce jour-là. |

## 10. Fiche de sécurité : `features/fiche-securite/fiche-securite.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| **forte** | :445-479 | Chaque plongeur affiche un champ de recherche et 9 champs (prénom, nom, aptitude, aptitude du DP, qualification, fonction, gaz, désaturation, observations) plus « ✕ ». Pour 4 palanquées de 4, cela fait plus de 150 champs, et environ un écran par plongeur sur téléphone. Sur un bateau, on ne lit plus la composition des palanquées. | Une ligne par plongeur (« Léa M. · N1 · Plongeur », badge « en formation PE40 »), dont un toucher ouvre un `app-dialogue` avec tous les champs. Mettre au niveau de la palanquée des valeurs par défaut (gaz, désaturation) que chaque plongeur peut changer. |
| **forte** | :508-519 et :125 (+ :1196-1204) | « Enregistrer la fiche » n'est qu'au bas d'une page très longue, sans barre collante. Le résultat (« Fiche enregistrée », « gardée sur l'appareil », refus) s'écrit en haut, hors de vue. Rien ne signale des modifications non enregistrées. | Barre d'enregistrement collante au-dessus des onglets (comme le programme) : bouton, état « Modifications non enregistrées » ou « Enregistrée à 9:42 » ou « En attente d'envoi », et message d'erreur. Plus la garde de sortie commune. |
| moyenne | :144-196 | Le directeur de plongée (obligatoire), 6 champs de conditions et 3 zones de texte passent avant les palanquées, à chaque ouverture, même pour modifier une palanquée. | DP en tête. « Conditions et secours » repliés, avec un résumé une fois remplis (« Mer 2, visi 15 m, courant faible »). |
| moyenne | :198-320 | Le panneau « Groupe de plongeurs » mêle le geste du jour (choisir le groupe, placer, proposer) et la gestion (créer, « Supprimer ce groupe » en rouge, « Gérer les groupes », lier ou délier des séances avec un long texte). Un bouton destructeur se trouve au milieu de la saisie. | Garder dans le panneau le choix du groupe, le vivier et « Proposer les palanquées ». Créer, supprimer, gérer, lier et délier passent dans un menu « ⋯ Groupe et séances liées ». |
| moyenne | :429, :812-814 | « Retirer » une palanquée la supprime sans confirmation, avec tout ce qui a été saisi pour ses plongeurs (pas encore enregistré). | Demander confirmation si la palanquée a des membres, ou proposer « Annuler » quelques secondes. |
| faible | :447 | « Plongeur du club (optionnel…) » est un `<label>` sans `for`, et le champ n'a pas de nom accessible. | Associer le libellé (ou `aria-label`). Avec la refonte en dialogue, cette recherche devient le premier champ. |

## 11. Compléter au retour : `features/fiche-securite/fiche-securite-realise.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :67-112 | Les palanquées sont dans l'ordre de leur numéro. Avec 6 à 8 palanquées, celle qui est en « ⛔ durée dépassée » peut se trouver hors de l'écran. C'est pourtant l'information de sécurité la plus urgente de l'appli. | Bandeau collant en haut : « À l'eau : 3 · ⚠ P4 sort dans 3 min · ⛔ P2 dépassée », chaque mention étant une ancre. Mettre les palanquées en alerte en premier. |
| moyenne | :88-95, :262-268 | Toucher de nouveau « Marquer l'immersion » écrase l'heure sans prévenir (geste facile avec un doigt mouillé). « Marquer la sortie » est actif avant toute immersion. | Une fois l'heure marquée, le bouton devient « Immergée à 10:42 · Corriger ». Sortie désactivée tant que l'immersion n'est pas marquée. « Annuler » quelques secondes après chaque marque. |
| moyenne | :31 | L'enregistrement automatique après chaque marque répond en haut de page (« enregistré », « en attente d'envoi »), loin de la palanquée touchée. | État d'envoi dans la carte de la palanquée (« ✓ enregistré » ou « en attente d'envoi »). |
| faible | :50-61 | Le seuil d'alerte (en minutes) occupe en permanence la tête de page, à côté de la recherche. | Le replier (« Réglages ») et ne montrer la recherche qu'au-delà de 4 palanquées. |
| faible | :114-130 | Quatre boutons (enregistrer, PDF, Excel, PDF de la sortie) sont alignés. Les exports ont le même poids qu'« Enregistrer ». | « Enregistrer » dans la barre collante, les exports dans un menu « Télécharger ▾ ». |

## 12. Infos élèves : `features/roster/roster.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| **forte** (téléphone, c'est l'onglet « Élèves ») | :52-125, :174 | Tableau des séances de toute la saison. La colonne figée fait 200 px sur 390, ce qui laisse 1 à 2 dates visibles, et la séance la plus récente est tout à droite, au bout d'un défilement horizontal de 30 dates ou plus. Pour retrouver un élève et voir s'il était là la dernière fois, c'est pénible. | Sur téléphone, une liste de cartes (photo, nom, niveau, CACI, bloc/nage, avancement, dernière présence) dont un toucher ouvre la grille. Le tableau des présences reste en option (« Vue tableau »), en ordre antichronologique ou défilé jusqu'à aujourd'hui. |
| moyenne | :102-109, :203-205 | CACI valide et CACI qui expire dans moins d'un mois affichent tous deux « OK », seule la couleur change : trompeur au soleil et pour les daltoniens. | Un texte distinct : « OK », « < 1 mois », « < 15 j », « ⚠ expiré » (ou la date). |

## 13. Trombinoscope : `features/roster/trombinoscope.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| faible | :149-209 | Le dialogue d'actions utilise `<dialog class="dialogue-seance">` et non `app-dialogue` : pas en plein écran sur téléphone, croix « ✕ » au lieu de « Fermer ». Il diffère des autres écrans. | Passer sur `app-dialogue`. |
| faible | :106-116 | Le même toucher sur une photo ouvre la grille pour un moniteur et un menu pour un admin. | Acceptable. Sinon, toujours le même menu, avec « Fiche de suivi » en action principale. |

## 14. Formations en cours : `features/cursus/cursus-liste.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| faible | :63-66 | Une erreur de chargement affiche « Aucune formation ouverte sur cette saison » : faux et trompeur. Le titre « Formations en cours » ne correspond pas à l'onglet « Ma formation » de l'élève. | Un état d'erreur distinct. Titrer « Ma formation » pour un élève. |

## 15. Planning : `features/planning/planning.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | :121-128 | Les avertissements de sécurité (fosse au-delà de sa capacité, aucun E3 présent, DP absent) sont au bas de la carte de la soirée, après la liste des groupes. | Les monter juste sous la date, en `.alerte`. Mettre « ⚠ » sur la ligne du groupe concerné. |
| faible | :178-181 | La légende des codes (F10, F6, —) est tout en bas, et le code est `aria-hidden`. | Mettre la légende dans un « ⓘ » près des codes. Le libellé (`place`) suffit pour les lecteurs d'écran. |

## 16. Parcours et fiche d'exercice : `features/exercices/parcours.component.ts`, `fiche-exercice.component.ts`

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| moyenne | parcours :43 ; fiche :31 | Ces deux écrans exigent le réseau, alors que c'est au bord du bassin qu'un encadrant veut relire un déroulement ou un schéma (et le sous-sol d'une piscine capte mal). | Embarquer parcours et fiches (sans les vidéos) dans « Préparer hors ligne », comme la grille et les schémas. |
| moyenne | parcours :83-125 | Toutes les périodes sont dépliées. La période « En ce moment » n'est ni en tête ni défilée, ce qui fait un long défilement sur téléphone. | Défiler jusqu'à la période en cours à l'ouverture. Replier les périodes passées (en-tête seul). |
| faible | parcours :37-41 | Paragraphe d'introduction de trois lignes. | Une ligne. |
| faible | fiche :45-81 | Les « Critères travaillés » passent avant le déroulement, la réussite et le schéma, alors que ces trois-là sont ce qu'on lit au bord de l'eau. | Ordre : déroulement, réussite, schéma, conseils, puis critères et parcours. |

---

## Principes transverses

1. **Action principale et retour d'état collés en bas.** Créer un composant commun `core/barre-action.component.ts`, collant au-dessus des onglets (`--hauteur-onglets`). Il porte le bouton principal et l'état de la saisie (« Modifications non enregistrées » / « Enregistré à 9:42 » / « En attente d'envoi » / l'erreur du serveur). À utiliser pour la fiche de sécurité, « Compléter au retour », le programme, la notation groupée, et pour l'élève précédent/suivant de la grille. Y joindre une garde `canDeactivate` commune (il n'y en a aucune dans l'appli) pour les pages avec brouillon.
2. **Contexte de saisie collant en haut.** Un composant `core/contexte-seance.component.ts` (séance, milieu, mode naturel ou entraînement, groupe, « Changer »), partagé par les Présences, la grille et la synthèse. Il remplace les blocs « label + choix-seance » répétés et le `<select>` du programme. Le moniteur doit toujours voir sur quelle séance il agit.
3. **Le retour d'information se place près du geste.** Une erreur ou une confirmation s'affiche sur l'élément touché (carte d'élève, critère, palanquée) et dans un toast commun en bas d'écran (`core/toast.service.ts`), jamais seulement dans une `.alerte` en haut de page. Aujourd'hui, la grille, les Présences, le programme et les deux écrans de fiche de sécurité écrivent tous leurs messages là où le moniteur ne regarde pas.
4. **Une page s'ouvre sur ses données, l'explication va dans « Comment faire ? ».** Retirer les paragraphes d'introduction de 3 à 5 lignes (programme, fiches, parcours, matrice, notation groupée, aide de la grille). Garder au plus une ligne, et mettre les légendes dans un « ⓘ » qui ouvre un dialogue. Les formulaires longs gardent à l'écran l'essentiel (DP, palanquées) et replient le secondaire.
5. **Un seul dialogue, des tableaux pensés pour 390 px.** Remplacer les `<dialog class="dialogue-seance">` utilisés pour autre chose que le calendrier (notation groupée, trombinoscope) par `app-dialogue`, en plein écran sur téléphone avec un pied collant. Pour les tableaux larges (Infos élèves, vue globale, synthèse de séance) : sur téléphone, une vue en cartes par défaut, ou au minimum l'ordre antichronologique, l'en-tête collant et une colonne figée d'au plus 40vw. Le détail d'une case ne passe jamais par un simple `title`.
