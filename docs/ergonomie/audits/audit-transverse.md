# Audit d'ergonomie : écrans publics et cohérence transverse

Périmètre : `features/connexion/*`, `features/aide/aide.component.ts`, `features/videos/videos.component.ts`,
`frontend/src/styles.css`, `app.component.ts`, `core/*.component.ts`, et un échantillon des templates
de `features/**` (hors `groupes/groupes.component`). Lecture seule : rien n'a été modifié.

Chemins relatifs à `frontend/src/app/` sauf `styles.css` (`frontend/src/styles.css`).

---

## 1. Écrans publics

### 1.1 Connexion (`features/connexion/connexion.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| **Forte** | l.139-143 | Toute erreur qui n'est pas un 422 affiche « E-mail ou mot de passe incorrect. », y compris **pas de réseau** (status 0), serveur en panne (5xx) ou trop d'essais (429). Au bord du bassin, sans réseau, le moniteur croit s'être trompé de mot de passe, réessaie, puis demande une réinitialisation. | Un message par cas : `status === 0` → « Pas de connexion internet : la connexion demande le réseau. » ; 401/403 → identifiants ; 429 → « Trop d'essais, réessayez dans une minute » ; ≥ 500 → « Le serveur ne répond pas, réessayez plus tard ». Mettre ce mapping dans une fonction commune `core/erreurs.ts` (`messageErreur(e, defaut)`), réutilisable partout (voir T4). |
| Moyenne | l.30-48 | Les champs ne sont pas dans un `<form>` : Entrée est simulée par `(keyup.enter)` sur chaque champ. Les gestionnaires de mots de passe (iOS, Android) proposent moins bien d'enregistrer l'identifiant sans soumission de formulaire, et la touche « Aller » du clavier téléphone n'a pas de cible. | `<form (ngSubmit)="connecter()">` avec `<button type="submit">`, `enterkeyhint="go"` sur le mot de passe ; retirer les `(keyup.enter)`. Même chose pour le formulaire « mot de passe oublié » (l.67-74). |
| Moyenne | l.50-52, styles l.98-102 | « Mot de passe oublié ? » et « Retour à la connexion » : `min-height: auto; padding: 0` → cible d'environ 21 px de haut, sous les 44 px de la convention. (Les deux liens vers l'aide et les vidéos ont `.lien-videos` qui leur rend 44 px ; pas ces deux-là.) | Appliquer `min-height: 44px; display:flex; align-items:center; justify-content:center` à `.lien-oubli` lui-même. |
| Moyenne | l.28 | L'erreur n'a ni `role="alert"` ni `aria-live` : un lecteur d'écran ne l'annonce pas, et le focus reste sur le bouton. | `role="alert"` (et classe `.alerte erreur`, voir T3). |
| Moyenne | l.35-36 | Pas de bouton « Afficher le mot de passe » : saisie difficile au doigt mouillé sur un clavier de téléphone. | Bouton œil de 44 px dans le champ (`type` qui bascule entre `password` et `text`) ; en faire un petit composant `core/champ-mot-de-passe.component.ts`, repris par Réinitialisation et Mon compte. |
| Faible | l.154 | « Envoyer le lien » avec un e-mail vide : retour silencieux, rien ne se passe. | Message « Indiquez votre adresse e-mail. » comme pour la connexion, ou bouton désactivé tant que le champ est vide. |
| Faible | l.17, l.14-16 | Le `h1` reste « Suivi des formations de plongée » ; le nom de la structure n'apparaît que dans l'`alt` du logo. Un centre de plongée qui règle son identité ne voit pas son nom à l'écran. | Afficher `identite.nom()` (ou le nom d'origine) sous le logo, en texte. |
| Faible | styles l.86 + `app.component.ts` l.145-146 | `.accueil { min-height: 100dvh }` est posé **dans** `<main>` (padding) sous la barre de page (« Comment faire ? ») et au-dessus du pied « Version » : la page de connexion défile toujours un peu, sur téléphone le bouton « Se connecter » peut passer sous le pli quand le clavier s'ouvre. | `min-height: calc(100dvh - <barre> - <padding>)` ou, mieux, `min-height: auto` avec un simple `margin-block: auto` ; le centrage vertical n'a pas d'intérêt sur téléphone. |
| Faible | l.104-106 | `.succes` codé en dur (`#e6f4ea` / `#1e4620`), dupliqué dans Réinitialisation l.64-66. | Classe globale `.alerte.succes` (T3). |

### 1.2 Choix du mot de passe (`features/connexion/reinitialisation.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| Moyenne | l.98-101 | Lien expiré ou déjà utilisé : message « Ce lien est invalide ou a expiré. » et plus rien ; le formulaire reste affiché comme si on pouvait réessayer. Seul le retour « ← Connexion » de la barre de page permet d'en sortir, et il faut alors deviner qu'il faut cliquer « Mot de passe oublié ? ». | Sur 4xx du jeton : masquer le formulaire et proposer un bouton principal « Demander un nouveau lien » qui ouvre `/connexion?oubli=1` (la connexion lit ce paramètre et ouvre directement le mode oubli, e-mail prérempli si connu). Même bouton dans le cas `jetonAbsent` (l.24-28), qui n'offre aujourd'hui aucune action. |
| Moyenne | l.39-45 | Deux champs mot de passe sans « Afficher », règle « Au moins 10 caractères » donnée une fois en haut, contrôle seulement au clic. | Composant `champ-mot-de-passe` (voir 1.1) ; compteur « 7 / 10 caractères » sous le champ, en direct ; `<form (ngSubmit)>`. |
| Faible | l.35 | Erreur sans `role="alert"`. | Idem 1.1. |
| Faible | l.33 | Après succès, « Se connecter » oblige à retaper e-mail et mot de passe. | Si le serveur le permet, connecter directement ; sinon passer l'e-mail dans `/connexion?email=…` pour le préremplir. |

### 1.3 Aide (`features/aide/aide.component.ts`)

Écran bien construit (recherche locale, hors ligne, cartes cliquables en entier). Défauts mineurs :

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| Moyenne | l.37 | Le nombre de réponses change à chaque frappe sans `aria-live` : un lecteur d'écran n'entend rien. | `<p class="secondaire" aria-live="polite">`. |
| Faible | l.52-59 | Sur téléphone, 8 à 10 boutons de rubrique en vrac avant le premier manuel (≈ 3 à 4 lignes de boutons) ; « Toutes les vidéos » (lien, change de page) a le même aspect que les boutons de rubrique (sautent dans la page). | Rubriques en défilement horizontal sur une ligne (`overflow-x:auto; flex-wrap:nowrap`) sous 600 px ; « Toutes les vidéos » sorti de la rangée, en lien texte sous l'intro (comme sur la connexion). |
| Faible | l.44-47 | Aucun résultat : « demandez à un administrateur du club », sans moyen de le faire. | Lien `mailto:` vers une adresse de contact réglée dans l'identité de la structure (`identite_structure`), sinon retirer la phrase. |
| Faible | l.93-95, l.100-103, l.118-121 | `.visuellement-cache`, `.compte`, `.pastille` redéfinis localement, à l'identique de `videos.component.ts` et `core/barre-page.component.ts`. | Classes globales (T6). |

### 1.4 Vidéos (`features/videos/videos.component.ts`)

| Gravité | Où | Problème | Correction |
|---|---|---|---|
| Moyenne | l.203-205, l.35-36 | Toute erreur de chargement du catalogue (réseau absent, 500) affiche « Les vidéos ne sont pas encore publiées. » : faux hors ligne. | Distinguer `status === 0` / hors ligne : « Les vidéos demandent une connexion internet. » ; garder « pas encore publiées » pour le 404. |
| Moyenne | l.78-102, l.149-153 | Lecteur dans un `<dialog>` à lui, hors du composant commun : pas plein écran sur téléphone (marges de 32 px, vidéo réduite), bouton « Fermer » texte en haut alors que les autres dialogues ont ✕, aucun bouton de fermeture en bas (il faut remonter après avoir lu la transcription). | Passer par `app-dialogue` avec une variante plein écran (T2) ; ou au minimum reprendre `.dialogue-formulaire` et son en-tête collant. |
| Faible | l.53-54 | `aria-label="Voir la vidéo : titre"` sur la carte entière masque aux lecteurs d'écran le résumé et la durée. | Retirer l'`aria-label` (le contenu du bouton est déjà lisible) ou utiliser `aria-describedby` vers le résumé. |
| Faible | l.53, l.62, l.127 | Les vidéos « À venir » occupent autant de place que les vraies, grisées (opacity .7, texte `--craie` réduit à environ 3,5:1), dans chaque rubrique. | Les regrouper en fin de rubrique en simple liste de titres, ou les masquer. |
| Faible | l.33-34 | « Chargement… » sans `role="status"`. | Composant de chargement commun (T7). |

---

## 2. Incohérences transverses (par priorité)

### T1. Confirmations natives `confirm()` : 42 appels dans 20 écrans — **forte**

`confirm()` bloque le fil, a l'aspect du navigateur (sur Android : « cppjvo.fr indique… », OK / Annuler en petit), ignore la charte, n'est pas plein écran, et ne dit pas ce que fait le bouton (« OK » pour « Supprimer définitivement »). Sur iOS en mode application installée, les boîtes natives sont en plus parfois masquées ou supprimées après plusieurs appels.

Fichiers (nombre d'appels) : `sejours/sejour.component.ts` (5 : l.1286, 1428, 1489, 1530, 1581), `admin/exercices-admin.component.ts` (4), `sejours/sejour-frais.component.ts` (3), `admin/referentiel-admin.component.ts` (3), `admin/moniteurs.component.ts` (3), `seances/seances.component.ts` (2), `seances/programme-exercices.component.ts` (2, abandon de saisie l.655, 673), `materiel/fiche-equipement.component.ts` (2), `admin/groupes-entrainement.component.ts` (2), `admin/cursus-admin.component.ts` (2), `admin/eleves.component.ts` (2), `admin/comptes-securite-surface.component.ts` (2), `fiche-securite/fiche-securite.component.ts` (2), `seances/generation-saison.component.ts` l.292, `admin/sorties.component.ts` l.365, `admin/progressions-admin.component.ts` l.681, `materiel/photos-pret.component.ts` l.188, `materiel/prets.component.ts` l.487, `materiel/saisie-inspection-tiv.component.ts` l.274, `compte/mon-compte.component.ts` l.277 (+ `groupes/groupes.component.ts`, hors zone).

Correction :
- `core/confirmation.service.ts` : `demander({ titre, texte, confirmer: 'Supprimer', danger?: true }): Promise<boolean>` ; rendu par un unique `<app-confirmation>` posé dans `app.component.ts`, construit sur `app-dialogue` (bouton principal ou `.bouton-danger` à gauche avec le **verbe exact**, « Annuler » à côté, focus initial sur « Annuler » pour les actions destructives).
- Remplacement mécanique : `if (!confirm(x)) return;` → `if (!(await this.confirmation.demander({...}))) return;`.
- Les confirmations de **création** (« Créer 32 séances… ? », generation-saison l.292, seances l.449) et d'**envoi d'e-mail** (moniteurs l.669, sejour l.1286, comptes-securite-surface l.173) deviennent des résumés dans le dialogue de saisie lui-même (« 32 séances seront créées du … au … » au-dessus du bouton « Créer les 32 séances ») : une étape de moins.
- Pour une action réversible (retirer une photo de note, une ligne non enregistrée), préférer **annuler après coup** : l'action se fait, un message « Photo retirée — Annuler » reste 6 s (s'appuie sur T4).

### T2. Six façons d'ouvrir une fenêtre — **forte**

`core/dialogue.component.ts` est la règle (25 écrans), mais coexistent :
- `.dialogue-seance` (`styles.css` l.146-159) utilisé en `<dialog>` brut par `presences/presences.component.ts` l.116, `grille/grille.component.ts` l.334, `roster/trombinoscope.component.ts` l.149, `fiche-securite/fiches-securite-liste.component.ts` l.77, et `presences/notation-groupee.component.ts` l.34 (un formulaire complet, notation groupée, **pas plein écran sur téléphone**, alors que c'est l'écran le plus utilisé au bord du bassin) ;
- `.dialogue` local de `admin/planning-admin.component.ts` l.217 ;
- `.dialogue-photo` de `materiel/photos-pret.component.ts` l.78 ;
- `.lecteur` de `videos/videos.component.ts` l.78 ;
- `div role="dialog"` sans `aria-modal` de `core/recadrage-photo.component.ts` l.32-33 (aucune gestion d'Échap : Échap ferme **le dialogue parent** et perd la photo et la saisie du dossier).

Fermeture nommée de trois façons : ✕ (dialogue commun, trombinoscope), « Fermer » en haut (présences l.121, grille l.195/221/254/339, notation-groupée l.39, photos-pret l.82, vidéos l.82), × (combobox).

Défauts du composant commun lui-même :
- l.22 : le contenu n'est rendu qu'à `@if (ouvert())`, alors que `showModal()` est appelé dans un `effect` (l.47-51) qui peut s'exécuter avant le rendu du contenu : le focus initial tombe sur la fenêtre et non sur le premier champ (à vérifier en vrai ; seuls `admin/eleves.component.ts` l.792 et `groupes` posent le focus à la main par `setTimeout`). Correction : `afterNextRender` puis focus du premier élément `[autofocus]` ou du premier champ.
- l.21, l.26 : Échap, ✕ et — sur Android — **le geste « retour »** (Chrome ferme un `<dialog>` modal au retour système) ferment sans prévenir et la saisie est perdue. Le commentaire l.14-15 protège le toucher à côté mais pas ces trois cas. Correction : entrée `modifie = input(false)` ; si vrai, l'événement `cancel` est intercepté et une confirmation interne « Abandonner la saisie ? » s'affiche dans la fenêtre (via T1). Le `confirm()` de `programme-exercices` l.655/673 entre dans le même mécanisme (garde de route `canDeactivate` commune).
- Le retour du focus à la fermeture est assuré par le navigateur pour un `<dialog>` natif ; garder ce choix (ne pas passer à des `div`).

Correction : un seul `app-dialogue` avec variantes `taille="normal|large|choix"` (choix = l'actuel `.dialogue-seance`, liste de choix courte), toujours plein écran sous 600 px, toujours ✕ avec `aria-label="Fermer"` en haut et actions collantes en bas ; migrer les 9 fenêtres ci-dessus ; `recadrage-photo` devient un vrai `<dialog>` imbriqué (le top layer gère l'empilement et Échap ne ferme que lui). Supprimer `.dialogue-seance` de `styles.css` à la fin.

### T3. Une seule couleur d'alerte pour l'erreur, l'avertissement, l'info et le succès — **forte**

`.alerte` (`styles.css` l.121-127) est ambre. Elle sert à **71 endroits** pour tout : refus du serveur, avertissement métier, information, et confirmation de réussite (« Programme enregistré. », « 32 séance(s) créée(s)… », seances l.468, generation-saison l.300, programme-exercices l.983). Un succès ressemble à un avertissement ; une erreur bloquante aussi. Quelques variantes locales existent (`alerte succes` dans programme-exercices l.117, `alerte erreur`, `alerte bloquant`, `alerte-texte urgence`), chacune définie dans son fichier. Les rouges sont codés en dur et divergent : `#B3261E` (37 fois) et `#B91C1C`/`#FCA5A5` (17 fois).

Correction (`styles.css`) :
- jetons `--danger: #B91C1C; --danger-clair: #FEF2F2; --succes: #15803D; --succes-clair: #F0FDF4; --info: #0E7490; --info-clair: #ECFEFF` ;
- `.alerte` (avertissement, inchangée), `.alerte.erreur`, `.alerte.succes`, `.alerte.info`, chacune avec une icône en `::before` (pas seulement la couleur) ;
- `role="alert"` pour `.erreur`, `role="status"` pour les autres (aujourd'hui `role="status"` partout, y compris pour des refus).
- Séparer, dans les ~38 écrans qui ont un unique signal `message` (liste en T4), les erreurs des succès.

### T4. Messages de retour : en haut de page, jamais effacés — **forte**

Patron répété dans **38 écrans** : `@if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }` en tête de page (seances l.76, presences l.107, aujourdhui l.41, planning l.29, grille l.382, fiche-securite l.125, fiche-equipement l.56, prets l.39, inventaire l.53, sejour l.119, sejour-frais l.60, et tous les écrans d'admin : saisons l.24, eleves l.77, moniteurs l.38, cursus-admin l.31, sorties l.38, referentiel l.70, exercices l.43, progressions l.60, groupes-entrainement l.45, planning-admin l.68, identite l.28, comptes-securite-surface l.32…). Sur téléphone, après un appui en bas d'une longue page (séjour, fiche de sécurité, grille), le message s'affiche **hors de l'écran** : le moniteur ne sait pas si c'est enregistré. Et il reste affiché indéfiniment, y compris quand l'action suivante réussit. Seul `synchronisation/bandeau-sync.component.ts` l.123 l'efface (5 s).

Correction :
- `core/annonces.service.ts` : `succes(texte, { annuler?: () => void })`, `erreur(texte)`, `info(texte)` ; `<app-annonces>` posé une fois dans `app.component.ts`, fixé en bas de l'écran **au-dessus de la barre d'onglets** (`bottom: calc(var(--hauteur-onglets) + 8px)`), `aria-live`.
- Succès : disparaît après 5 s (bouton « Annuler » éventuel, T1). Erreur : reste jusqu'à fermeture (✕) ou action suivante.
- Les erreurs de **chargement** de page restent dans la page (encart `.alerte.erreur` avec bouton « Réessayer »), les retours d'**action** passent par les annonces.
- Les erreurs dans un dialogue restent dans le dialogue (déjà le cas, `[erreur]`).
- `core/erreurs.ts` : `messageErreur(e: unknown, defaut: string)` qui gère `status 0` (« Pas de connexion… »), 422 (`detail`), 403, 5xx ; remplace les dizaines de `e.error?.detail ?? '…'` et les tests `err.status === 0` épars (aujourdhui l.313, planning l.364, presences l.856, notation-groupee l.354).

### T5. Contrastes insuffisants des couleurs de la charte — **forte (lecture au soleil)**

Mesures WCAG (texte normal : 4,5:1 attendu ; éléments d'interface : 3:1) :

| Couleur | Usage | Contraste | Verdict |
|---|---|---|---|
| `--craie` #475569 sur blanc / `--fond` | textes secondaires | 7,6 / 7,2 | **bon**, rien à changer |
| `--profond` #0891B2 sur blanc | **tous les liens** (`a`), « ← retour », titres de cartes de l'aide, onglet actif, 86 `color: var(--profond)` | 3,7 | insuffisant |
| blanc sur `--profond` | pastilles 12 px, boutons de filtre actifs (`.actif`, ~15 fichiers), fin du dégradé du bouton principal | 3,7 | insuffisant en petit texte |
| `--acquis` #16A34A sur blanc / sur `--acquis-clair` | « acquis », CACI valide (`detail-caci` l.139), 36 usages | 3,3 / 3,2 | insuffisant |
| `--en-cours` #B26B00 sur `--en-cours-clair` | bandeau de nouvelle version (`app.component.ts` l.190), pastilles ECA | 3,8 | insuffisant |
| blanc sur `--accent` #F97316 | jour courant du calendrier (`calendrier-seances` l.86) | 2,8 | insuffisant |
| `--trait` #E2E8F0 sur blanc | **bordure de tous les champs** (`styles.css` l.89) et des boutons discrets | 1,2 | champs quasi invisibles au soleil (3:1 attendu) |

Correction (jetons, sans toucher à la charte pour les aplats) :
- `--profond-texte: #0E7490` (5,4:1) pour liens et textes ; `a { color: var(--profond-texte) }` ; pastilles et boutons actifs sur `#0E7490` ou `--profond-fonce`.
- `--acquis-texte: #15803D` (5,0:1 ; 4,8 sur fond clair), `--en-cours-texte: #8A5A00` (5,3:1 sur fond clair).
- `--trait-champ: #64748B` (4,8:1) pour `input, select, textarea` et `.bouton-discret` ; garder `--trait` pour les séparateurs.
- jour courant : texte `--encre` sur `--accent-clair`, ou cercle `--accent` et chiffre en gras `--encre`.
- Une passe `grep` remplace `color: var(--profond)` / `var(--acquis)` / `var(--en-cours)` par les variantes `-texte` dans les ~170 règles concernées (les aplats `background:` restent).

### T6. Styles communs recopiés d'écran en écran — **moyenne** (dette qui produit les incohérences)

| Motif | Copies | Correction (`styles.css`) |
|---|---|---|
| Bouton de suppression `.danger` | 14 définitions locales, 2 rouges différents (`fiche-equipement` l.537, `sejour-frais` l.366, `sorties` l.254, `sejour` l.968 en #B91C1C ; `seances` l.340, `progressions-admin` l.410, `groupes-entrainement` l.329, `referentiel-admin` l.415, `comptes-securite-surface` l.100, `mon-compte` l.194, `eleves` l.467, `moniteurs` l.391, `fiche-securite` l.562 en #B3261E) + `.menu-actions-liste .danger` global | `.bouton-danger` (contour `--danger`, texte `--danger`) et `.bouton-danger.plein` pour le bouton de confirmation ; supprimer les 14 copies. |
| Étiquette de champ `label { display:block; margin… ; font-weight:700; font-size:.9375rem }` | 23 copies identiques + 4 variantes (dont `core/saisie-caci` l.55 « mêmes étiquettes que… », `core/recadrage-photo` l.56) | `.champ` (étiquette + champ + aide + erreur) ou règle globale `label:not(.case)` ; classe `.aide-champ` pour le texte sous un champ. |
| Case à cocher `.case` | 24 fichiers, 6 variantes ; chaque écran corrige `input { width:100% }` global qui étire les cases (`.case input { width:auto }` ou `24px`) | `input[type=checkbox], input[type=radio] { width:24px; height:24px; accent-color: var(--profond-fonce) }` global, et `.case` (ligne de 44 px) global. |
| Barre d'actions `.actions` | 27 fichiers, 8 variantes | `.barre-actions` globale (flex, wrap, gap `--pas`) ; sur téléphone, bouton principal en premier et pleine largeur. |
| En-tête de page `.entete` (h1 + bouton « Nouveau … ») | ~10 copies identiques (seances l.318, inventaire l.210, prets l.253, cursus-admin l.242, eleves l.423, comptes-securite-surface l.88, saisons l.130, moniteurs l.345, sorties l.224…) | `.entete-page` globale. |
| Titre de section avec bouton `.titre-section` | 2 copies (`sejour` l.896, `sejour-frais` l.311) | globale, à reprendre pour les sections de la fiche de sécurité, du référentiel, de la fiche d'équipement. |
| Pastilles / sigles | `.pastille` dans 11 fichiers aux sens différents (barre-page l.94, aide l.118, carnet-sejour l.173, mon-sejour l.63, sejour l.928, synthese-eleve l.196, matrice l.291, calendrier l.89, identite-admin l.120…), `.code` (videos), `.compte` (7 fichiers), `.statut` (15), `.etiquette` (14) | `.pastille` + modificateurs `.acquis`, `.en-cours`, `.non-aborde`, `.info`, `.neutre`, `.alerte` ; `.compteur` pour les nombres dans les boutons ; tailles minimales 12 px gras. |
| Bouton bascule actif (`.actif` + profond) | ~15 fichiers ; `aria-pressed` absent dans `saisie-inspection-tiv` (3 bascules), `fiche-equipement`, `saisons`, `comptes-securite-surface`, `inventaire` (2), `moniteurs`, `etiquettes` (2), `progressions-admin`, `referentiel-admin` | `.choix-segmente > button[aria-pressed=true]` stylé **par l'attribut** (ce qui oblige à le mettre) ; `core/filtre-groupe.component.ts` en est déjà le bon modèle. |
| Onglets | `.onglets` dans 10 écrans : `role="tablist"` + `aria-selected` dans 5 (sejour, sejours-liste, sorties, espace-participant, prets), `aria-pressed` dans 3, rien dans `progressions-admin` et `referentiel-admin` | composant `core/onglets.component.ts` (tablist, flèches clavier, défilement horizontal sur téléphone). |
| Tableau défilant | `.defilement` (synthese-seance l.217, sejour-frais l.339, synthese-groupe l.140, planning-admin l.342), `.tableau-scroll` (matrice l.301, roster l.149), `.a-venir` (planning l.226) ; colonne figée sous 3 noms (`.col-eleve`, `.figee`, `.colonne-groupe`) | `.tableau-defilant` + `.col-figee` globaux ; ajouter une ombre portée à droite quand le tableau déborde (indice qu'il défile). Les 8 tableaux sont bien de vrais tableaux à deux entrées : le défilement horizontal y est le bon choix, pas de passage en cartes. Note : `thead th { position: sticky; top:0 }` de `matrice` l.310 et `planning-admin` l.345 ne colle pas à l'écran (il colle au conteneur `overflow-x`), à limiter en hauteur (`max-height: 70dvh; overflow:auto`) pour que l'en-tête reste visible. |
| Texte masqué `.visuellement-cache` | 3 copies (aide l.93…) | global. |

### T7. Boutons : états désactivés et boutons principaux multiples — **moyenne**

- `.bouton-discret` n'a **aucun style `:disabled`** (`styles.css` l.106-111) : un bouton discret désactivé a exactement l'aspect d'un bouton actif. Ajouter `.bouton-discret:disabled { opacity:.5; cursor:not-allowed }`.
- `.bouton-principal:disabled` (l.104) passe en `--craie` plein : gris foncé à 7,6:1, qui se lit comme un autre bouton actif. Préférer `background: var(--trait); color: var(--craie)` et, quand c'est possible, dire **pourquoi** le bouton est indisponible à côté.
- Pas d'état `:hover`/`:active` sur les boutons globaux : aucun retour au toucher sur téléphone. Ajouter `:active { transform: translateY(1px); filter: brightness(.95) }`.
- Boutons principaux multiples sur une même vue : `sejours/sejour.component.ts` en a **7 visibles à la fois** sur la page (« Ajouter un rendez-vous » l.178, « Ajouter un participant » l.221, « Un même vol pour plusieurs » l.321, « Ajouter une voiture » l.360, « Ajouter un logement » l.399, « Modifier la liste » l.443, « Modifier » l.483) + « Gérer les frais » l.145 ; `fiche-securite.component.ts` met « Créer à partir des plongeurs » l.279 et « Proposer les palanquées » l.315 au même rang que « Enregistrer la fiche » l.510, et `l.494` utilise `bouton-principal` pour un choix de palanquée. Règle : **un seul bouton principal par vue ou par dialogue** (l'action qui conclut) ; les « Ajouter … » de section deviennent `.bouton-discret` avec « + ».
- Les cibles réduites : `.mini { min-height: 32px }` (`referentiel-admin` l.414), boutons 32 px de `groupes-entrainement` l.324, lien élève 32 px de `synthese-seance` l.223 : remonter à 44 px.
- Bouton ✕ sans nom accessible : `fiche-securite/fiche-securite.component.ts` l.471 (`retirerMembre`) — ajouter `aria-label="Retirer {{ nom }} de la palanquée"`. `core/combobox.component.ts` l.29 : « Effacer le choix » ne réagit qu'à `mousedown`, donc **ni Entrée ni Espace** ne l'actionnent au clavier ; utiliser `(click)` avec `(mousedown)="$event.preventDefault()"` pour garder le focus.

### T8. Mêmes gestes, noms différents — **moyenne**

- Ouvrir une création : « Nouveau moniteur / Nouvel élève / Nouvelle saison / Nouvelle sortie / Nouveau prêt / Nouvelle progression / Nouvelle version » (admin, matériel) contre « Ajouter un participant / une voiture / un logement / un équipement / une dépense / un espace » (séjour, matériel, planning), avec ou sans « + » (« + Nouveau groupe », « + Nouvelle palanquée », « + Ajouter une chambre » contre « Nouveau groupe »). Puis le bouton du dialogue : « Ajouter le moniteur » (moniteurs l.102), « Créer puis choisir les plongées » (sorties l.65), « Enregistrer » ailleurs. Règle proposée : ouvrir = **« + Ajouter un … »** partout ; conclure une création = **« Ajouter »**, une modification = **« Enregistrer »** ; libellé d'attente « Enregistrement… ».
- Retirer / Supprimer : « Retirer cette photo » (exercices-admin l.417), « Retirer ma photo » (mon-compte) contre « Supprimer cette photo » (photos-pret l.188, sejour-frais l.602) pour le même geste. Règle : **Supprimer** = disparaît de l'appli ; **Retirer** = enlève d'une liste ou d'un groupe, la chose existe encore (participant d'un séjour, élève d'une saison, membre d'une palanquée).
- Fermer : ✕ / × / « Fermer » (T2).
- Écrans : l'onglet du bas dit « Élèves », le menu et le retour disent « Infos élèves » (`app.component.ts` l.57 et l.265, `core/navigation.ts` l.17) ; l'onglet « Fiches » (l.274) contre « Fiches de sécurité ». Mettre le même mot, quitte à raccourcir le menu (« Élèves »).

### T9. Navigation globale (`app.component.ts`) — **moyenne**

- l.119-125 : `routerLinkActive` sans `ariaCurrentWhenActive="page"` (0 occurrence dans l'appli) : l'onglet ou le lien actif n'est signalé que par la couleur. Ajouter sur les onglets et le menu.
- Sur un écran ouvert par « Plus » (Trombinoscope, Fiches de sécurité, Séjours, Parcours, Administration…), **aucun onglet n'est actif** : le moniteur perd son repère. Marquer « Plus » comme actif (sans l'ouvrir) quand l'adresse n'appartient à aucun onglet.
- l.51, l.116-118 : le menu « Plus » est un `nav` affiché par-dessus la page, sans gestion du focus : il n'est pas focalisé à l'ouverture, Tab part dans la page masquée derrière le voile, le geste « retour » d'Android quitte la page au lieu de fermer le menu. En faire un `<dialog>` (ou `popover`) : focus, Échap et retour gérés par le navigateur.
- l.98-103 : « Préparer hors ligne » (une **action** qui télécharge) est rangée au milieu des liens de navigation, avec le même aspect. La placer sur « Aujourd'hui » (encart « Préparer hors ligne avant la séance ») et dans « Mon compte », et la sortir du menu.
- l.165 : entre 860 px et environ 1 300 px (tablette, petit portable), les 12 entrées du menu en `flex-wrap` font deux ou trois lignes dans l'en-tête. Passer à la barre d'onglets + « Plus » jusqu'à 1 100 px, ou regrouper le menu de bureau (« Élèves », « Séances », « Séjours », « Plus ▾ »).
- l.46 : « Suivi des formations » en dur dans l'en-tête, alors que l'identité de la structure a un `nomCourt` : l'afficher quand il est réglé.
- l.137-140 : bouton « Mettre à jour » **sans classe** : texte nu sans bordure ni fond (seul `min-height` est donné), à peine identifiable comme bouton ; texte du bandeau à 3,8:1. Utiliser `.bouton-principal` et `--en-cours-texte`.
- `app.routes.ts` : **aucune route n'a de `title`** ; l'onglet du navigateur, l'historique et les lecteurs d'écran disent tous le même titre. Ajouter `title` par route (ou une `TitleStrategy` qui reprend les noms de `core/navigation.ts`).

### T10. États de chargement et listes vides — **faible**

- Chargement : 38 × `<p class="vide">Chargement…</p>` et 10 × `<p class="secondaire">Chargement…</p>` + 8 variantes ; aucun n'a `role="status"`. Composant `core/chargement.component.ts` (`<app-chargement texte="…" />`, `role="status"`, apparition après 300 ms pour éviter le clignotement, squelette de cartes facultatif).
- Vide : « Aucun… » écrit en `<p>` nu (32), `.secondaire` (14) ou `.vide` (10) ; `.vide` sert à la fois au chargement et aux listes vides. Composant `core/etat-vide.component.ts` (texte + action principale suggérée, par ex. « Aucune séance ce mois-ci — + Ajouter une séance »).
- Recadrage photo (`core/recadrage-photo.component.ts` l.36-38) : déplacement de l'image au doigt seulement, aucun moyen au clavier (flèches) ; faible.

---

## 3. Ordre proposé des lots

1. **Jetons et socle CSS** (`styles.css` seul, risque faible, effet partout) : jetons `-texte`, `--danger`, `--succes`, `--info`, `--trait-champ` (T5) ; `.bouton-discret:disabled`, `:active`, nouvel état désactivé du principal (T7) ; cases à cocher globales, `.visuellement-cache` (T6). Puis remplacement `grep` des `color: var(--profond|acquis|en-cours)`.
2. **Écrans publics** (petits, isolés, premiers vus) : `<form>`, messages d'erreur par cas avec `core/erreurs.ts`, cibles 44 px, `champ-mot-de-passe`, « Demander un nouveau lien », `aria-live` de l'aide, message hors ligne des vidéos (section 1).
3. **Retours d'action** : `AnnoncesService` + `<app-annonces>` au-dessus des onglets, `.alerte.erreur/.succes/.info` ; migrer les 38 écrans à signal `message`, en commençant par ceux du bord du bassin (présences, grille, aujourd'hui, fiche de sécurité, planning) (T3, T4).
4. **Confirmations** : `ConfirmationService` + `<app-confirmation>` ; remplacer les 42 `confirm()` ; garde « Abandonner la saisie ? » dans `app-dialogue` (Échap, ✕, retour Android) (T1, partie de T2).
5. **Fenêtres unifiées** : variantes d'`app-dialogue`, focus initial, migration des 9 fenêtres hors composant (notation groupée en priorité), recadrage en vrai `<dialog>` (T2).
6. **Classes et composants communs** : `.bouton-danger`, `.entete-page`, `.barre-actions`, `.titre-section`, `.champ`, `.pastille` + modificateurs, `.choix-segmente`, `app-onglets`, `.tableau-defilant`, `app-chargement`, `app-etat-vide` ; migration écran par écran, un commit par zone (admin, matériel, séjours, séances/présences, grille) en profitant de chaque passage pour appliquer « un seul bouton principal » et les libellés de T8 (T6, T7, T8, T10).
7. **Navigation** : `aria-current`, « Plus » actif et en `<dialog>`, titres de route, menu de bureau regroupé, « Préparer hors ligne » déplacé, libellés d'onglets alignés (T9).

Rappel de la règle du club : les lots 2, 3, 4, 5, 7 et les changements de libellés (T8) changent ce que voit l'utilisateur. Chaque commit doit mettre à jour les manuels concernés (`features/aide/manuels/*.md`) et les scénarios de vidéo qui cliquent sur ces boutons par leur libellé ou passent par un `confirm()` (dans `outils/videos/scenarios/*.mjs`, chercher `dialog`, `confirm`, les libellés « Nouveau », « Supprimer », « Fermer »). Le lot 4 change en particulier la façon dont Playwright accepte une confirmation (gestionnaire `page.on('dialog')` remplacé par un clic sur le bouton du dialogue).
