# Vidéos explicatives

Enregistre automatiquement les vidéos de prise en main de l'appli, avec les
sous-titres incrustés et un rond orange à chaque toucher : une vidéo par
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
FFMPEG=/chemin/ffmpeg outils/videos/tourner.sh   # ffmpeg hors du PATH
```

Il installe Playwright la première fois, dépose les portraits, enregistre,
puis convertit en MP4 si `ffmpeg` est trouvé (l'iPhone lit mal le WebM).
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

## Après l'enregistrement

Les vidéos sortent en WebM, sans son : 412 × 839 au format téléphone,
1280 × 800 au format ordinateur (Playwright filme la page à sa taille, sans
l'agrandir). Pour un MP4 à la main (WhatsApp, PowerPoint…) :

```bash
ffmpeg -i sorties/M04-noter-un-eleve.webm -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' \
  -c:v libx264 -pix_fmt yuv420p -crf 20 M04.mp4
```

La voix off s'enregistre ensuite dans n'importe quel éditeur vidéo
(Shotcut, Kdenlive, iMovie…), en suivant le texte de `SCENARIOS.md`.

## Ajouter une vidéo

Un fichier `scenarios/Xnn-titre.mjs` qui exporte `{ id, titre, public,
resume, compte, format?, jouer }` ; `public` est une des rubriques de la
page (`Découverte`, `Moniteur`, `Administrateur`, `Directeur technique`,
`Élève`), `format` vaut `telephone` (par défaut) ou `ordinateur`. `jouer`
reçoit les gestes de `commun.mjs` : `legende` (sous-titre, qui devient
aussi le texte de la vidéo), `toucher`, `saisir`, `choisir`, `cocher`,
`dater`, `menu`, `administration`, `reseau`, `vignette` (image d'aperçu)…
et `grille.mjs` a des repères pour la grille de compétences. La vidéo
apparaît dans `SCENARIOS.md` et sur la page au prochain enregistrement.
