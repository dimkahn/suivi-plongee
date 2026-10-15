# Audit d'ergonomie : administration (lecture seule)

Périmètre : `frontend/src/app/features/admin/*` (sauf `groupes/groupes.component`), `seances/seances.component`,
`seances/generation-saison.component`, `compte/mon-compte.component`. Chemins relatifs à
`frontend/src/app/features/`. Les numéros de ligne renvoient au fichier `.ts` (template en ligne).

Gravité : **forte** (un geste courant échoue, se perd ou crée une erreur de données), **moyenne** (gêne
réelle, contournable), **faible** (friction).

---

## 1. Accueil de l'administration — `admin/admin-accueil.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 16-27 | La rubrique « Début de saison » annonce un ordre « la saison, ses séances, les inscriptions, puis les groupes ». Or l'inscription propose de ranger l'élève dans un groupe (`cursus-admin` 124-141, `eleves` 145-158) et répond « Aucun groupe pour cette saison : créez-les d'abord » : l'ordre conseillé pousse l'admin dans une impasse. « Élèves » (créer le dossier) est rangé à part, dans « Personnes », alors qu'il faut le faire avant l'inscription. | Remettre l'ordre réel : 1. Saison, 2. Groupes d'entraînement, 3. Séances (générer), 4. Élèves et inscriptions. Numéroter les cartes (1, 2, 3…) pour que la rubrique se lise comme une liste à suivre. |
| moyenne | 84-99 | Les cartes sont statiques : rien ne signale ce qui demande une action (CACI à vérifier, élèves sans groupe, saison sans progression, soirées sans DP). L'admin doit ouvrir chaque écran pour le savoir. | Ajouter sur les cartes concernées un compteur « à faire » calculé côté serveur (« 4 CACI à vérifier », « 7 élèves sans groupe », « 3 soirées sans DP fosse »). Les pastilles d'alerte existent déjà dans les écrans. |
| faible | 38-46 | « Personnes » ne mentionne pas les comptes « Sécurité surface », cachés en bas de l'écran Moniteurs. Un admin qui cherche « créer un compte pour la sécurité surface » ne le trouve pas. | Compléter le détail de la carte Moniteurs (« … et comptes Sécurité surface »), ou en faire un onglet de cet écran (voir §2). |
| faible | 23 | Le nom « Inscriptions » (route `/admin/cursus`) et l'écran Élèves font presque le même travail (voir §3 et §4). | Voir la fusion proposée au §4. |

## 2. Moniteurs — `admin/moniteurs.component.ts` (+ `admin/comptes-securite-surface.component.ts`)

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 38, 40, 224, 302 | Un seul signal `message` sert à la fois au bandeau de la page et à l'erreur de chaque dialogue. Une erreur de saisie s'affiche dans le dialogue et aussi derrière lui, en haut de la page. Un message de réussite resté affiché peut aussi ressortir comme une alerte rouge à l'ouverture d'un autre dialogue si un chemin oublie de le remettre à zéro. | Séparer `erreurDialogue` (passé à `[erreur]`) et `message` (bandeau de page, réussites seulement), comme le fait déjà `comptes-securite-surface` (`erreur()`). |
| moyenne | 181-183, 569 | « Désactiver » part sans confirmation, alors qu'un moniteur désactivé ne se connecte plus et disparaît des groupes et des choix de DP. Un appui involontaire dans le menu, sur un téléphone, coupe l'accès d'un encadrant. | Demander une confirmation qui dit l'effet (« X ne pourra plus se connecter ; ses notes restent »). Garder l'activation sans confirmation. |
| moyenne | 184-192 | Deux gestes de mot de passe côte à côte : « Changer le mot de passe » (l'admin choisit un mot de passe, qu'il doit ensuite transmettre) et « Envoyer un lien de réinitialisation ». Le premier va contre le principe annoncé à la création (« il ne transite jamais par vous », 43-44). | Garder « Envoyer un lien pour choisir son mot de passe » comme geste par défaut. Déplacer la saisie directe en dernier recours, dans le dialogue de ce lien (« Pas d'e-mail ? Définir un mot de passe provisoire »). |
| moyenne | 109-128, 415, 419 | Pas de filtre Actif / Désactivé : les comptes désactivés sont mêlés aux actifs. Le filtre CACI « À vérifier » liste aussi les désactivés, alors que le compteur au-dessus ne compte que les actifs : les deux nombres ne concordent pas. | Ajouter un filtre « Actifs (défaut) / Désactivés / Tous », et appliquer la règle « actifs seulement » au filtre CACI comme au compteur. |
| moyenne | 330 ; surface 49-56 | Les comptes « Sécurité surface » sont collés sous une liste qui peut être longue, avec un second bouton principal. Leurs actions sont des boutons alignés (Modifier, Désactiver, Envoyer un lien, Supprimer en rouge), alors que les moniteurs juste au-dessus ont un menu « Actions ▾ » : deux règles sur un même écran. | Faire deux onglets dans l'écran (« Moniteurs » / « Sécurité surface ») et donner aux comptes surface le même modèle « Modifier + Actions ▾ », avec Supprimer en dernier, en rouge. |
| faible | 47-99, 226-289 | Les dialogues de création et de modification affichent d'un bloc environ 15 champs (identité, trois niveaux, licence, CACI, quatre rôles). Sur un téléphone, il faut beaucoup faire défiler l'écran avant le bouton. | Regrouper en sections titrées (Identité · Niveaux · CACI · Droits) ; les droits peuvent se replier, ils servent rarement. |
| faible | 159-167 | Jusqu'à cinq badges (Admin, DT, TIV, Fiches sécu, Actif) dans une colonne qui ne passe à la ligne que sous 600 px : entre 600 et 860 px, ils écrasent le nom. | Mettre les badges sous l'identité (`flex-wrap`) à toutes les largeurs, et ne garder « Actif » que pour signaler un compte désactivé. |

## 3. Élèves — `admin/eleves.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 239 | Le filtre « Statut de l'inscription » affiche les codes bruts `EN_COURS`, `VALIDE`, `DELIVRE`, `SUSPENDU`, `ABANDON`. L'écran Inscriptions a pourtant ses libellés (`cursus-admin` 11-14). | Partager `LIBELLES_STATUT` (dans `core/`) et l'utiliser dans les deux écrans. |
| forte | 274-299 | La fiche d'un élève ne dit ni la formation suivie sur la saison filtrée (N1, N2…), ni son groupe. Elle n'affiche que « Adhésion sans formation » ou « Pas de rattachement ». L'admin ne peut pas répondre à « Léa est-elle bien inscrite en N2, dans Prépa N2 ? » sans changer d'écran. | Ajouter une ligne « 2026-2027 : N2 (en cours) · groupe Prépa N2 » (données déjà chargées : cursus, groupes de la saison). |
| moyenne | 122-202, 80-120 | Le dialogue « Nouvel élève » compte environ 22 champs (identité, CACI, contacts, urgence, tailles, autorisations, saison, formation, groupe, droit à l'image, photo) d'un seul tenant. Au bord du bassin, on ne veut souvent que le nom, la saison et le groupe. | Découper en sections repliables, avec « Identité + Saison et groupe » ouvertes et « CACI », « Contacts », « Matériel », « Photo » repliées (avec la mention « à compléter plus tard »). Le bouton « Ajouter l'élève » reste toujours visible (barre `.actions-dialogue` collante). |
| moyenne | 279-281 | Le CACI d'un élève est du texte inerte. Chez les moniteurs, le même libellé est un bouton qui ouvre le détail (`moniteurs` 153-157). Même donnée, deux comportements. | Faire du CACI un bouton qui ouvre `app-detail-caci`, comme chez les moniteurs. |
| moyenne | 335-366 | « Historique des saisons » n'affiche que les adhésions sans formation. Le texte vide l'avoue (« une formation en cours figure dans l'écran Inscriptions ») : le libellé promet un historique qu'il ne donne pas. | Afficher toutes les saisons de l'élève, formations comprises (cursus + adhésions), ou renommer en « Saisons sans formation ». |
| moyenne | 323-334 | « Ajouter à la saison (sans formation) » / « Retirer de la saison » existent ici et dans Inscriptions (« Maintien »). La création d'un élève inscrit aussi en formation. Le même geste a deux noms (« adhésion sans formation » ici, « maintien » là-bas) et deux écrans. | Voir la fusion proposée au §4. À défaut, un seul vocabulaire (« Maintien, sans formation ») dans les deux écrans. |
| faible | 373-408 | Les élèves archivés, et le geste destructeur « Supprimer définitivement », sont en bas d'une liste qui peut compter plus de 100 fiches. On ne les trouve qu'en faisant défiler toute la page. | En faire une valeur du filtre (« Dossiers : actifs / archivés ») plutôt qu'une section en pied de page. |

## 4. Inscriptions — `admin/cursus-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 151-157, 398 | La liste charge toutes les inscriptions de toutes les saisons, sans filtre de saison, de niveau ni de statut, et dans l'ordre du serveur. Après deux ou trois saisons, retrouver « les N1 de cette année » demande de tout parcourir. La section « Maintien » (219-237), elle, ne montre que la saison ouverte : la page mélange deux périmètres. | Ajouter des filtres Saison (ouverte par défaut), Niveau et Statut, comme dans Élèves, et trier par niveau puis par nom. |
| moyenne | 168-181, 186-217 | La fiche d'une inscription ne montre pas le groupe, et « Modifier » ne permet pas d'en changer : pour déplacer un élève, il faut aller dans « Groupes d'entraînement ». | Afficher le groupe sur la fiche et ajouter le choix du groupe dans le dialogue de modification (même liste qu'à la création). |
| moyenne | (écran entier) + `eleves` 127-158, 323-334 | **Doublon d'écran.** Élèves et Inscriptions font chacun « rattacher un élève à une saison, avec ou sans formation, et le ranger dans un groupe ». L'admin ne sait pas lequel ouvrir, et les deux évoluent séparément (libellés de statut, vocabulaire « maintien » / « adhésion »). | **Refonte :** un seul écran « Élèves », filtré sur la saison ouverte. Chaque fiche montre le dossier, la formation et le groupe de la saison. « Actions ▾ » contient Modifier le dossier · Inscrire / changer de formation · Changer de groupe · Maintien · Archiver. Le dialogue « Nouvelle inscription » (avec sa recherche d'élève et sa proposition de niveau, très réussie) devient l'action « Inscrire » d'un élève existant. |
| faible | 219-237 | « Maintien, sans formation » est sous la liste des inscriptions : un élève en maintien est invisible tant qu'on n'a pas fait défiler la page. | Intégré au filtre Statut (« Maintien ») de la liste unique. |

## 5. Saisons — `admin/saisons.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 47-49 | « Fermer » une saison part sans confirmation. Cela change la saison proposée par défaut dans tous les écrans (planning, groupes, inscriptions, filtres) : les moniteurs ne trouvent plus « leur » saison. | Confirmer en disant l'effet (« Elle ne sera plus proposée par défaut ; rien n'est effacé »). |
| moyenne | 31-73 | Après « Créer la saison », rien n'indique la suite : la saison est créée, puis l'admin doit retourner à l'accueil pour trouver groupes, génération des séances et progressions. | Sur la fiche d'une saison sans séance ni groupe, afficher une liste d'étapes avec liens : « Choisir les progressions », « Créer les groupes », « Générer les séances », « Inscrire les élèves », chacune cochée quand elle est faite. |
| faible | 44-46 | Le bouton « Modifier les dates » modifie aussi le libellé. | Renommer en « Modifier », ou « Modifier (nom, dates) ». |

## 6. Référentiel MFT — `admin/referentiel-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 109-116, 154-160, 203-275 | Rien ne dit qu'une version est **utilisée par des cursus en cours**. Or CLAUDE.md précise qu'une modification ici s'applique rétroactivement et que « c'est à l'admin de ne pas modifier un référentiel figé sur des cursus en cours ». L'admin n'a aucun moyen de le savoir depuis l'écran. | Afficher en tête de la fiche « Utilisée par 23 formations en cours (saison 2026-2027) ». Mettre un avertissement visible dans chaque dialogue de modification d'une version, d'un bloc ou d'un critère utilisés (« Le changement s'applique aussi aux 23 élèves en cours »). Le serveur connaît déjà ce lien, puisqu'il bloque la suppression. |
| moyenne | 154-160, 165, 183-188, 485 (`.mini`) | Les boutons « Modifier / Supprimer » de chaque critère et de chaque bloc font 32 px de haut (`.mini`, sous les 44 px de la convention). Ils sont serrés au bout de chaque ligne de critère : un « Supprimer » rouge à côté de « Modifier », répété des dizaines de fois. | Une seule cible par critère : toucher la ligne ouvre le dialogue de modification, qui porte un bouton « Supprimer ce critère » en bas. Boutons d'au moins 44 px. |
| moyenne | 128-196 | Tous les blocs, avec tous leurs critères, comportement, théorie et modalités, sont dépliés sur une seule page : plus de 10 blocs pour le N2/N3. « Ajouter un bloc » est tout en bas. | Afficher les blocs repliés (`<details>`, avec intitulé, regroupement et nombre de critères) et monter « Ajouter un bloc » en tête de la liste des blocs. |
| moyenne | 109-116 | « Supprimer cette version » est à côté de « Modifier cette version », au même niveau visuel (bouton discret). | Mettre la suppression dans le dialogue de modification (zone « danger » en bas), ou dans un menu « Actions ▾ ». |
| faible | 258-260 | « Profondeur max. de formation » n'est plus opposée à la notation (choix révisé de 2026), mais le libellé ne le dit pas : un admin croira qu'elle bloque. | Ajouter l'aide « À titre indicatif : n'empêche pas de noter ». |
| faible | 67-68 | Pas de phrase d'introduction (deux lignes vides), alors que c'est l'écran le plus délicat. | Une phrase : « Ce que contient chaque version du MFT. Une nouvelle révision fédérale s'importe par une migration ; ici on corrige. » |

## 7. Base d'exercices — `admin/exercices-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 56-97 | Entre 90 et 99 exercices par formation sur une seule page, tous dépliés, sans recherche ni filtre. Retrouver « 4.3 » ou les exercices « sans conseils » / « désactivés » oblige à tout faire défiler. | Ajouter une recherche (numéro ou intitulé) et des filtres (Phase, « sans conseils », « sans schéma », « désactivés »). Replier les compétences (`<details>` avec le nombre d'exercices). |
| moyenne | 89, 552-561 | « Supprimer » est proposé sur tous les exercices. Pour un exercice déjà noté, le serveur refuse et l'admin lit une erreur en haut de page (souvent hors de vue). La règle « on désactive » n'est que dans le texte d'introduction. | Si l'exercice a des notes, remplacer « Supprimer » par « Désactiver » (ou proposer la désactivation dans la confirmation). Mettre la suppression dans le dialogue, pas en bouton rouge sur chaque ligne. |
| moyenne | 100-231 | Le dialogue de modification empile la fiche (numéro, phase, critères, trois textes longs), puis le schéma, les photos (légende, accord, dépôt) et les vidéos. Les médias s'enregistrent tout de suite, la fiche seulement avec « Enregistrer » : deux façons d'enregistrer dans la même fenêtre, et Échap fait perdre la fiche en cours. | Faire de la modification d'un exercice une page (`/admin/exercices/:id`, formulaire long, conforme à la convention), avec deux sections : « Fiche » (bouton Enregistrer) et « Schéma, photos, vidéos » (enregistrés aussitôt, comme indiqué). |

## 8. Groupes d'entraînement — `admin/groupes-entrainement.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 93-95 | « Nouveau groupe » est un bouton discret **sous** la liste des groupes, alors que c'est le premier geste d'une saison neuve. Tous les autres écrans mettent « Nouveau… » en bouton principal, en haut à droite. | Bouton principal « Nouveau groupe » dans l'en-tête, comme ailleurs. |
| moyenne | 39-195 | Quatre travaux sur une seule page qui défile : groupes, moniteurs sans groupe, rangement de tous les élèves (une liste par élève), configuration du bassin. Sur un téléphone, la liste des élèves repousse le bassin très loin. | Faire trois onglets : « Groupes » (avec moniteurs sans groupe), « Ranger les élèves », « Bassin ». La configuration du bassin pourrait aussi aller dans le Planning, qui est le seul à s'en servir. |
| moyenne | 82-89 | Quatre boutons alignés par groupe (Modifier, Monter, Descendre, Supprimer en rouge). Monter/Descendre servent rarement, et Supprimer est collé à Descendre. | « Modifier » + menu « Actions ▾ » (Monter, Descendre, Supprimer), comme dans Moniteurs et Élèves. |
| faible | 63-81 | La carte d'un groupe n'affiche que le nombre d'élèves. Pour vérifier qui est dans « Prépa N2 », il faut filtrer la liste des élèves plus bas. | Liste des élèves repliable dans la carte (« 12 élèves ▸ »). |
| faible | 323-326 | Les croix « × » qui retirent un référent ou un encadrant font 32 × 32 px. | Les porter à 44 px. |

## 9. Planning du bassin — `admin/planning-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 217, 391, 558, 649, 667-672 | L'écran utilise son propre `<dialog>` au lieu de `app-dialogue` : pas plein écran sur téléphone, pas de zone d'erreur. Sur un refus du serveur, le code **ferme la fenêtre** puis affiche l'erreur en haut de page, souvent hors de vue sous un tableau large. La saisie est perdue et l'admin ne sait pas pourquoi. | Passer à `app-dialogue` (plein écran sur téléphone, `[erreur]` dans la fenêtre), et garder la fenêtre ouverte sur une erreur. |
| moyenne | 277-329 | Le dialogue d'une soirée mélange deux façons d'enregistrer. DP et note ne partent qu'avec « Enregistrer », placé **au milieu**. Les présences (✓/✗) et le groupe du soir, en dessous, partent tout de suite. Un admin qui coche des présences puis touche « Annuler » croit les avoir annulées. | Séparer : « Soirée » (DP fosse, DP piscine, note ; Enregistrer en bas) et « Présences des encadrants » (enregistrées aussitôt), en deux onglets du dialogue ou deux dialogues ouverts depuis les lignes « DP » et « Encadrants », qui font aujourd'hui la même chose. |
| moyenne | 17, 421 | La période par défaut est « Toute la saison » : une trentaine de colonnes, et il faut faire défiler l'écran de côté jusqu'à la date du jour. | Ouvrir par défaut sur la période qui contient aujourd'hui (ou « à partir d'aujourd'hui »), et faire défiler le tableau jusqu'à la prochaine soirée. |
| faible | 204-213 | Les avertissements (« À vérifier ») sont sous le tableau et la légende : sur un téléphone, on ne les voit pas sans faire défiler l'écran. | Afficher en haut un résumé (« 3 soirées à vérifier ▾ ») qui renvoie à la liste. |

## 10. Progressions types — `admin/progressions-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 214-330 et suite | Toute la progression (nom, description, puis chaque période avec mois, milieu, note, blocs cochés et la liste dépliable de tous les exercices de la base) se modifie dans **un seul dialogue**. C'est le formulaire le plus long de l'appli, contre la convention qui garde les formulaires longs en pages entières. Échap ou la croix fait perdre d'un coup toutes les périodes modifiées. | Page entière `/admin/progressions/:id` : une carte par période, chaque période modifiable dans son propre dialogue (intitulé, mois, milieu, blocs, exercices), avec Monter/Descendre/Retirer dans le menu de la carte. L'enregistrement se fait par période. |
| moyenne | 92-104 | Rien n'indique quelles saisons suivent la progression. « Supprimer » et « Modifier » ne préviennent pas que le changement touche le programme affiché sur les séances et le retard calculé pour les élèves de la saison. | Afficher « Suivie par : 2026-2027 » sous le titre, avec un avertissement dans la confirmation de suppression. |
| faible | 100-104 | « Supprimer » (rouge) est à côté de « Dupliquer » dans une barre de trois boutons. | Menu « Actions ▾ » (Dupliquer, Supprimer). |

## 11. Identité de la structure — `admin/identite-admin.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| faible | 88-99 | Les trois couleurs se choisissent sans aperçu ni contrôle de contraste. Un accent clair sur blanc rend les boutons illisibles au soleil, au bord du bassin, et on ne s'en rend compte qu'après l'enregistrement. | Aperçu en direct dans le dialogue (un bouton principal, un titre, une barre), et un avertissement si le contraste texte/fond est inférieur à 4,5:1. |

## 12. Séances — `seances/seances.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| forte | 69, 116-122 | Le bouton « Séjour de plongée » crée **une série de séances**. Depuis V75, « Séjour » désigne autre chose dans l'appli : `/sejours`, avec participants, voitures, chambres et frais, rattaché à une Sortie. Un admin qui veut « préparer le séjour à Port-Cros » crée ici des séances orphelines, sans sortie ni séjour. | Renommer en « Plusieurs plongées d'un coup » (ou « Série de plongées »), et ajouter un renvoi : « Pour un week-end ou un séjour, créez plutôt la sortie dans Sorties : elle crée ses plongées. » |
| moyenne | 67-74 | Quatre portes d'entrée pour créer des séances : « Nouvelle séance », « Séjour de plongée », le lien « Générer toutes les séances… » sous l'en-tête et, ailleurs, les plongées créées depuis Sorties. Leur rôle n'est expliqué nulle part. | Un seul bouton principal « Nouvelle séance ▾ » qui propose : Une séance · Toute la saison (chaque semaine) · Plusieurs plongées d'un coup, chacun avec une ligne d'explication. |
| moyenne | 209-267, 398 | La liste affiche toutes les séances de la saison courante, passées comprises, sans filtre « à venir » ni choix de saison. En cours d'année, l'admin fait défiler des dizaines de séances passées avant d'arriver à la semaine prochaine. | Filtre « À venir (défaut) / Passées / Toutes », et un choix de saison (le texte d'en-tête dit « saison courante » sans permettre d'en changer). |
| faible | 256 | Le lien « Exercices » mène au programme de la séance, appelé « Programme » partout ailleurs (Aujourd'hui, liste des séances des moniteurs). | Renommer en « Programme ». |

## 13. Générer les séances d'une saison — `seances/generation-saison.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| faible | 70-73 | Pour deux séances le même soir (piscine + fosse), il faut lancer la génération deux fois. | Permettre « Séances par soir : 1 / 2 », chacune avec son milieu et son lieu (même aperçu, même création). |
| faible | 152-159 | L'aperçu ne permet pas de retirer une date précise (gala, piscine fermée) : il faut supprimer les séances une par une ensuite. | Une case à décocher par date dans « Voir toutes les dates ». |

L'écran est par ailleurs exemplaire : il garantit « aperçu puis création », signale les séances déjà existantes et les paramètres modifiés depuis l'aperçu.

## 14. Mon compte — `compte/mon-compte.component.ts`

| Gravité | Où | Problème | Correction proposée |
|---|---|---|---|
| moyenne | 88-146 | Quatre formulaires toujours ouverts, avec quatre grands boutons principaux pleine largeur (Enregistrer la licence, Changer d'e-mail, Changer le mot de passe, plus la photo). Le changement d'e-mail et de mot de passe sert une fois par an, mais occupe l'écran à chaque visite. Le moniteur vient surtout pour la photo, le CACI ou se déconnecter. | Une page « carte d'identité » en lecture (photo, nom, niveaux, CACI, licence, e-mail), avec des boutons « Modifier ma licence », « Changer d'e-mail », « Changer de mot de passe » qui ouvrent chacun un dialogue. Garder « Se déconnecter » visible en bas. |
| faible | 88-104 | La section « Identité » n'a qu'un champ modifiable (licence) ; nom, niveau de plongeur, niveau préparé et rôles (DT, TIV, fiches de sécurité) ne sont pas montrés. Le moniteur ne sait pas quels droits il a. | Afficher niveau de plongeur, niveau préparé et rôles en lecture (« Vos droits : fiches de sécurité, TIV »). |

---

## Principes transverses

1. **Un seul modèle de fiche dans une liste.** Bouton « Modifier » + menu « Actions ▾ » (`.menu-actions`), destructif en dernier, en rouge. Moniteurs et Élèves le suivent. Comptes surface, Groupes, Référentiel, Exercices, Progressions et Séances alignent encore 3 ou 4 boutons, dont « Supprimer » collé aux autres. Mieux encore pour les lignes d'un contenu (critères, exercices) : toucher la ligne ouvre le dialogue, et la suppression est dans le dialogue.
2. **L'action de création en haut, en bouton principal ; un formulaire long est une page.** « Nouveau groupe », « Ajouter un bloc », « Nouvelle version » sont aujourd'hui en bas ou discrets. Progressions et Exercices contredisent la convention des dialogues courts. Un seul `app-dialogue` partout (le Planning a le sien), avec une erreur affichée **dans** la fenêtre, qui reste ouverte, et un signal d'erreur distinct du bandeau de la page.
3. **Filtrer par défaut sur ce qui sert maintenant.** Saison ouverte, séances à venir, période qui contient aujourd'hui, comptes actifs. Toute liste qui peut dépasser environ 30 éléments (inscriptions, exercices, séances, élèves à ranger) a une recherche et des filtres ; les archives et les éléments désactivés passent par une valeur de filtre, pas par une section en pied de page.
4. **Un même concept, un nom et un écran.** « Séjour » (série de séances ou séjour V75), « maintien » ou « adhésion sans formation », « Exercices » ou « Programme », statuts bruts ou libellés. La paire Élèves / Inscriptions est à fusionner en un écran « Élèves de la saison ».
5. **Montrer les conséquences avant le geste.** Confirmer les gestes qui retirent un accès ou changent les valeurs par défaut (désactiver un moniteur, fermer une saison). Afficher qui dépend de ce qu'on modifie : formations en cours sur une version du MFT, saisons qui suivent une progression, notes qui empêchent de supprimer un exercice. Signaler sur l'accueil de l'administration ce qui attend une action (compteurs).
