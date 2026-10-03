# Vidéos explicatives

Enregistre automatiquement les vidéos de prise en main de l'appli, avec une
voix off de synthèse et un rond orange à chaque toucher : une vidéo par
geste, rangées par rôle (découverte, moniteur, administrateur, directeur
technique, élève). La page publique `/videos` de l'appli les présente, sans
connexion. Le déroulé et le texte de chaque vidéo sont dans `SCENARIOS.md`,
réécrit à chaque enregistrement.

Tout tourne sur les **données de démonstration** (profil `dev`) : aucun
nom réel, aucune photo de personne (portraits et matériel sont des dessins
générés par `portraits.mjs`). Ne jamais lancer la préparation contre la
production.

## Tourner

En une commande, depuis la racine du dépôt. Le backend doit être arrêté :
le script en démarre un neuf et l'arrête à la fin. Un frontend déjà lancé
sur le port 4200 est réutilisé, sinon le script le démarre aussi.

```bash
outils/videos/tourner.sh              # toutes les vidéos → outils/videos/sorties/
outils/videos/tourner.sh M03 A        # M03 et toute la série administrateur
RYTHME=1.5 outils/videos/tourner.sh   # pauses 50 % plus longues
RYTHME_CLIC=2 outils/videos/tourner.sh  # touchers deux fois plus lents, le reste inchangé
FFMPEG=/chemin/ffmpeg outils/videos/tourner.sh   # ffmpeg hors du PATH
VOIX=0 outils/videos/tourner.sh       # sans voix off, sous-titres incrustés à la place
SOUS_TITRES=1 outils/videos/tourner.sh  # voix off et sous-titres
```

Il installe Playwright et Piper (voix off) la première fois, dépose les
portraits, enregistre, puis monte la voix off et convertit en MP4 si
`ffmpeg` est trouvé (l'iPhone lit mal le WebM). Sans `ffmpeg`, les vidéos
restent en WebM muet.
Environ 30 minutes pour toute la série. Journaux du backend et du frontend
dans `sorties/` ; en cas d'échec, `sorties/…-ECHEC.png` montre l'écran au
moment du problème.

À la main, en trois terminaux, depuis la racine du dépôt :

```bash
cd backend && mvn spring-boot:run          # 1. backend neuf (H2 en mémoire)
cd frontend && npm start                   # 2. frontend sur :4200

cd outils/videos
npm install && npx playwright install chromium   # la première fois
node preparer-donnees.mjs                  # 3. portraits du trombinoscope
node enregistrer.mjs                       #    toutes les vidéos → sorties/
node monter.mjs && node enregistrer.mjs --catalogue   # voix off et MP4 (ffmpeg)
```

**Pour retourner une vidéo, repartir de zéro** : arrêter le backend, le
relancer, puis `node preparer-donnees.mjs`. Beaucoup de scénarios écrivent
(présences, notes, prêts, saison, élèves…) : rejoués sur les mêmes données,
ils ne montreraient plus la même chose. Ils sont écrits pour ne pas se
gêner entre eux lors d'un passage complet ; trois en suivent un autre :
A7 inscrit l'élève créé par A6, D7 rend le prêt photographié par D6, D8
prête le bloc ajouté par D2.

## Les données filmées

La saison 2026-2027 vient des données de démonstration du backend
(`db/demo/V107__saison_2026_2027_demo.sql`, et `V108` pour une fiche de
sécurité à compléter) : élèves fictifs, groupes d'entraînement, présences
et notes de la rentrée, un week-end en milieu naturel, la prochaine soirée
du planning (calculée au démarrage du backend). `preparer-donnees.mjs`
n'ajoute que les portraits dessinés du trombinoscope, qu'une migration SQL
porte mal. Tourner pendant la saison (de fin septembre 2026 à juin 2027).

## Voir la page en local

```bash
node outils/videos/apercu.mjs      # sert sorties/ sur le port 4300
```

puis http://localhost:4200/videos : `ng serve` relaie `/medias/videos` vers
ce port (`frontend/proxy.conf.json`), comme Caddy le fait en production.

## Publier

Sur la machine de production, après un tournage :

```bash
outils/videos/publier.sh
```

Il copie vidéos, aperçus et `catalogue.json` dans le dossier que Caddy sert
sous `/medias/videos/` (`VIDEOS` du `.env` de la prod, sinon
`videos-publiees/` du dépôt de prod). Ni tag ni redéploiement : la page
relit le catalogue à chaque visite. Voir `DEPLOIEMENT.md`, « Vidéos d'aide ».

Ou laisser faire la machine : `outils/videos/surveiller-scenarios.sh --installer`
pose une tâche cron qui, toutes les 5 minutes, tourne et publie les
scénarios nouveaux ou modifiés de la version en ligne (avec leur
prédécesseur pour A7, D7 et D8). Un scénario en échec n'est retenté que
quand son fichier change ; `~/suivi-plongee-videos/surveiller-scenarios.sh D10`
le force. Journal : `~/suivi-plongee-videos/journal.log`.

Pour faire retourner **toutes** les vidéos par la machine (après un
changement d'écran qui touche plusieurs vidéos, par exemple), changer la
date de la ligne « Tournage du … » en tête de chaque scénario : toutes les
empreintes changent, et le premier passage après le déploiement du tag les
retourne et les publie toutes (environ 30 minutes), y compris celles qui
étaient en échec.

## La voix off

Chaque phrase des scénarios (geste `legende`) est lue à voix haute par [Piper](https://github.com/OHF-Voice/piper1-gpl),
une synthèse vocale libre qui tourne sur la machine, sans internet (sauf
pour l'installer). `tourner.sh` l'installe la première fois dans
`outils/videos/.piper/` (hors dépôt, environ 300 Mo avec la voix
`fr_FR-siwis-medium`) : il faut `python3` et `pip`
(`sudo apt install python3-pip`). Autre voix : `VOIX_MODELE=fr_FR-upmc-medium`
(liste sur le site de Piper).

La voix remplace les sous-titres incrustés : ils ne s'affichent plus que
sans voix (`VOIX=0`, Piper pas installé), ou avec `SOUS_TITRES=1`. Le texte
reste la transcription de la page `/videos` et de `SCENARIOS.md`.

Pendant le tournage (`commun.mjs`), la phrase est synthétisée par
`voix.py` au moment où elle doit être dite ; la suivante attend qu'elle soit dite, et une pause trop courte pour la phrase
s'allonge d'autant. Les phrases (`sorties/voix/`) et leur instant dans la
vidéo (`sorties/<vidéo>.json`) sont posés ensuite par `monter.mjs`, qui
ajoute la piste son au WebM et en tire le MP4. La prononciation se corrige
dans `aDire` (`commun.mjs`) : la transcription ne change pas.

La page `/videos` lance une vidéo avec voix off le son ouvert, une vidéo
muette sans le son.

## Après l'enregistrement

Les vidéos sortent en WebM : 412 × 839 au format téléphone,
1280 × 800 au format ordinateur (Playwright filme la page à sa taille, sans
l'agrandir). Le montage (voix off et MP4) se relance seul :

```bash
cd outils/videos && node monter.mjs && node enregistrer.mjs --catalogue
```

Pour une voix enregistrée par un humain plutôt que la synthèse, tourner
avec `VOIX=0` et enregistrer la voix dans n'importe quel éditeur vidéo
(Shotcut, Kdenlive, iMovie…), en suivant le texte de `SCENARIOS.md`.

## Ajouter une vidéo

Un fichier `scenarios/Xnn-titre.mjs` qui exporte `{ id, titre, public,
resume, compte, format?, jouer }` ; `public` est une des rubriques de la
page (`Découverte`, `Moniteur`, `Administrateur`, `Directeur technique`,
`Élève`), `format` vaut `telephone` (par défaut) ou `ordinateur`. `jouer`
reçoit les gestes de `commun.mjs` : `legende` (phrase dite par la voix off, ou sous-titre sans voix, qui devient
aussi le texte de la vidéo), `toucher`, `saisir`, `choisir`, `cocher`,
`dater`, `menu`, `administration`, `reseau`, `vignette` (image d'aperçu)…
et `grille.mjs` a des repères pour la grille de compétences. La vidéo
apparaît dans `SCENARIOS.md` et sur la page au prochain enregistrement.
