---
paths:
  - "backend/src/main/java/fr/club/plongee/progression/**"
  - "backend/src/main/resources/modeles/**"
  - "frontend/src/app/core/progression.ts"
  - "frontend/src/app/features/admin/progressions-admin.component.ts"
  - "frontend/src/app/features/exercices/parcours.component.ts"
---

# Progressions types

## Règles
- **Une progression type est rattachée à une version du référentiel, pas au niveau** : `ProgressionType` (paquet `fr.club.plongee.progression`, écran `/admin/progressions`) porte des `PeriodeProgression`.
- **Découpage par défaut en périodes de mois, pas par séance** : une période = une plage de mois (1-12, qui peut enjamber le changement d'année), un milieu facultatif et les blocs travaillés. *Pourquoi :* en mois et non en dates pour resservir d'une saison à l'autre ; le séance par séance a été écarté comme trop lourd à tenir (choix du club, 2026).
- **Un bloc peut figurer dans plusieurs périodes.**
- **Une saison suit au plus une progression par référentiel** : table `progression_saison`, choix dans `/admin/saisons`, règle tenue par `ProgressionService`. Aucune migration ne rattache une progression à une saison réelle (seules les démos V102 et V107 le font).
- **Chaque séance affiche la période qui couvre son mois** : `core/progression.ts`, `ProgrammeSeanceComponent`, liste des séances et feuille de présence ; embarqué hors ligne.
- **Dans la grille, les blocs de la période du mois sont marqués « Au programme »** : mois de la séance choisie, sinon d'aujourd'hui.
- **Le retard est calculé par le serveur** : `EcheancesProgression`, appelé par `GrilleService`. Échéance d'un bloc = dernier jour de la dernière période qui le contient, située dans l'année de la saison. En retard si cette date est passée, que le bloc n'est pas validé et que ses critères ne sont pas tous acquis, pour un cursus `EN_COURS` seulement.
- **Une période de fin de saison qui reprend tous les blocs repousse toutes les échéances en juin** : voulu pour N2/N3 (validations en milieu naturel), retiré de la proposition N1 par V24.
- **Découpage par plongées possible, fixé à la création** : `ProgressionType.decoupage` (V73) vaut `MOIS` (toutes les progressions du club) ou `PLONGEES`. *Pourquoi :* vendre l'appli à un centre de plongée en mer, une installation par structure.
- **En `PLONGEES`, une étape porte `plongee_debut`/`plongee_fin`** au lieu des mois : numéros de plongée **en milieu naturel** de l'élève, dans l'ordre où il y est noté présent (`ParticipationRepository.plongeesEnMilieuNaturel`, par cursus).
- **La grille livre `decoupage`, `numerosPlongee` (séance → numéro) et `plongeesFaites`** ; l'étape « Au programme » est celle de la plongée de la séance choisie, sinon de la prochaine (`core/progression.ts`, `periodeDeLaPlongee`).
- **Retard en plongées** : échéance d'un bloc = dernière plongée de sa dernière étape (`BlocVue.echeancePlongee`) ; en retard quand l'élève a fait cette plongée un jour précédent (`EcheancesProgression.enRetardEnPlongees`).
- **Une progression par plongées n'a pas de période par date** : le programme des séances, la liste des séances et le parcours (« En ce moment ») l'ignorent.
- **Le modèle « centre de plongée en mer » n'est pas une migration** : `modeles/centre-mer.sql`, exécuté une fois sur demande d'un ADMIN (`ModeleCentreMerService`, bouton de `/admin/progressions`). Il installe 44 exercices N1 écrits pour la mer (numéros `M1.1`…`M10.6`, chaque critère technique a une maîtrise) et des progressions N1 (6 plongées), N2 (8), N3 (10) ; N2/N3 reprennent V59/V61. Option : désactiver les 90 exercices N1 « piscine » de V51.
- **Le contenu installé (migrations ou modèle) se corrige par les écrans d'admin.**

## À ne pas faire
- Rattacher une progression à un niveau plutôt qu'à une version du référentiel.
- Découper séance par séance ou en dates.
- Calculer le retard côté écran.
- Changer le découpage d'une progression existante.
- Transformer `modeles/centre-mer.sql` en migration ou l'installer chez le club.
- Rattacher par migration une progression à une saison réelle.

## Repères
- `ProgressionType`, `PeriodeProgression` : progression et ses périodes (ou étapes).
- `ProgressionService` : règle « une progression par référentiel et par saison ».
- `progression_saison` : choix de la saison, depuis `/admin/saisons`.
- `EcheancesProgression`, `GrilleService` : échéances et retard.
- `core/progression.ts` : période du mois ou de la plongée côté écran.
- `ProgrammeSeanceComponent` : affiche la période d'une séance.
- `ParticipationRepository.plongeesEnMilieuNaturel` : numérotation des plongées.
- `ModeleCentreMerService`, `modeles/centre-mer.sql` : modèle mer.
- V22 : une proposition par niveau (N1 PE20, N2 PA20|PE40, N3 PA40|PE60), à adapter depuis l'écran.
- V24 : retire la période fin de saison « tous les blocs » de la proposition N1.
- V73 : colonne `decoupage`.
- V51, V59, V61 : exercices N1, N2, N3 repris ou désactivables par le modèle.
- V102, V107 : démos qui rattachent une progression à une saison.

Historique des choix : `docs/decisions/progression.md`.
