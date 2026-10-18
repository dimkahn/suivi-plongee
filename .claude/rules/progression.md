---
paths:
  - "backend/src/main/java/fr/club/plongee/progression/**"
  - "backend/src/main/resources/modeles/**"
  - "frontend/src/app/core/progression.ts"
  - "frontend/src/app/features/admin/progressions-admin.component.ts"
  - "frontend/src/app/features/exercices/parcours.component.ts"
---

# Progressions types

- `ProgressionType` (paquet `fr.club.plongee.progression`, écran `/admin/progressions`) est rattachée à une version du référentiel, pas au niveau ; elle porte des `PeriodeProgression`. V22 : une proposition par niveau (N1 PE20, N2 PA20|PE40, N3 PA40|PE60), à adapter depuis l'écran.
- Découpage par défaut en mois : période = plage de mois (1-12, peut enjamber le changement d'année), milieu facultatif, blocs travaillés. *Pourquoi :* mois et non dates pour resservir d'une saison à l'autre ; séance par séance écarté, trop lourd (choix du club, 2026).
- Un bloc peut figurer dans plusieurs périodes.
- Une saison suit au plus une progression par référentiel : `progression_saison`, choix dans `/admin/saisons`, règle tenue par `ProgressionService`. Aucune migration ne rattache une progression à une saison réelle (démos V102, V107 seulement).
- Chaque séance affiche la période de son mois : `core/progression.ts`, `ProgrammeSeanceComponent`, liste des séances, feuille de présence ; embarqué hors ligne.
- Grille : blocs de la période du mois marqués « Au programme » (mois de la séance choisie, sinon d'aujourd'hui).
- Retard calculé par le serveur : `EcheancesProgression`, appelé par `GrilleService`. Échéance d'un bloc = dernier jour de la dernière période qui le contient, dans l'année de la saison. En retard si date passée, bloc non validé et critères pas tous acquis, cursus `EN_COURS` seulement.
- Période de fin de saison reprenant tous les blocs = toutes les échéances en juin : voulu pour N2/N3 (validations en milieu naturel), retiré de la proposition N1 par V24.
- Découpage par plongées possible, fixé à la création : `ProgressionType.decoupage` (V73), `MOIS` (toutes les progressions du club) ou `PLONGEES`. *Pourquoi :* vendre l'appli à un centre de plongée en mer, une installation par structure.
- En `PLONGEES`, une étape porte `plongee_debut`/`plongee_fin` : numéros de plongée **en milieu naturel** de l'élève, dans l'ordre où il y est noté présent (`ParticipationRepository.plongeesEnMilieuNaturel`, par cursus).
- La grille livre `decoupage`, `numerosPlongee` (séance → numéro) et `plongeesFaites` ; étape « Au programme » = celle de la plongée de la séance choisie, sinon de la prochaine (`core/progression.ts`, `periodeDeLaPlongee`).
- Retard en plongées : échéance = dernière plongée de la dernière étape du bloc (`BlocVue.echeancePlongee`) ; en retard quand l'élève a fait cette plongée un jour précédent (`EcheancesProgression.enRetardEnPlongees`).
- Progression par plongées : pas de période par date ; programme des séances, liste des séances et parcours (« En ce moment ») l'ignorent.
- Modèle « centre de plongée en mer » : pas une migration, ne pas l'installer chez le club. `modeles/centre-mer.sql`, exécuté une fois sur demande d'un ADMIN (`ModeleCentreMerService`, bouton de `/admin/progressions`). Installe 44 exercices N1 écrits pour la mer (`M1.1`…`M10.6`, chaque critère technique a une maîtrise) et des progressions N1 (6 plongées), N2 (8), N3 (10) ; N2/N3 reprennent V59/V61. Option : désactiver les 90 exercices N1 « piscine » de V51.
- Contenu installé (migrations ou modèle) corrigé par les écrans d'admin.

Historique des choix : `docs/decisions/progression.md`.
