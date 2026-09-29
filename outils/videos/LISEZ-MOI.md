# Vidéos explicatives

Enregistre automatiquement les vidéos de prise en main de l'appli, au
format téléphone, avec les sous-titres incrustés et un rond orange à chaque
toucher. Les scénarios, et le texte de voix off pour qui veut les tourner
ou les commenter soi-même, sont dans `SCENARIOS.md`.

Tout tourne sur les **données de démonstration** (profil `dev`) : aucun
nom réel, aucune photo de personne (les portraits sont des dessins générés
par `portraits.mjs`). Ne jamais lancer la préparation contre la production.

## Tourner

Trois terminaux, depuis la racine du dépôt :

```bash
cd backend && mvn spring-boot:run          # 1. backend neuf (H2 en mémoire)
cd frontend && npm start                   # 2. frontend sur :4200

cd outils/videos
npm install && npx playwright install chromium   # la première fois
node preparer-donnees.mjs                  # 3. portraits du trombinoscope
node enregistrer.mjs                       #    les dix vidéos → sorties/
```

- `node enregistrer.mjs M03 M04` : seulement ces vidéos.
- `RYTHME=1.5 node enregistrer.mjs` : pauses 50 % plus longues (voix off
  plus lente).
- En cas d'échec, une capture `sorties/…-ECHEC.png` montre l'écran au
  moment du problème.

**Pour retourner une vidéo, repartir de zéro** : arrêter le backend, le
relancer, puis `node preparer-donnees.mjs`. Plusieurs scénarios écrivent
(présences, notes, validation, réponse au planning, photo) : rejoués sur
les mêmes données, ils ne montreraient plus la même chose.

## Les données filmées

La saison 2026-2027 vient des données de démonstration du backend
(`db/demo/V107__saison_2026_2027_demo.sql`) : élèves fictifs, groupes
d'entraînement, présences et notes de la rentrée, un week-end en milieu
naturel, la prochaine soirée du planning (calculée au démarrage du
backend). `preparer-donnees.mjs` n'ajoute que les portraits dessinés du
trombinoscope, qu'une migration SQL porte mal. Tourner pendant la saison
(de fin septembre 2026 à juin 2027).

## Après l'enregistrement

Les vidéos sortent en WebM, sans son, 824 × 1830. Pour un MP4 (WhatsApp,
PowerPoint…) :

```bash
ffmpeg -i sorties/M04-noter-un-eleve.webm -c:v libx264 -pix_fmt yuv420p -crf 20 M04.mp4
```

La voix off s'enregistre ensuite dans n'importe quel éditeur vidéo
(Shotcut, Kdenlive, iMovie…), en suivant le texte de `SCENARIOS.md`.

## Ajouter une vidéo

Un fichier `scenarios/Xnn-titre.mjs` qui exporte `{ id, titre, compte,
jouer }`. `jouer` reçoit les gestes de `commun.mjs` : `legende` (sous-titre),
`toucher`, `saisir`, `defiler`, `menu`, `choisirDerniereSeance`… et
`grille.mjs` a des repères pour la grille de compétences. Ajouter sa
ligne dans `SCENARIOS.md`.
