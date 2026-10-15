---
paths:
  - "backend/src/main/java/fr/club/plongee/progression/**"
  - "backend/src/main/resources/modeles/**"
  - "frontend/src/app/core/progression.ts"
  - "frontend/src/app/features/admin/progressions-admin.component.ts"
  - "frontend/src/app/features/exercices/parcours.component.ts"
---

# Progressions types

**Une progression type découpe l'année par périodes de mois, pas par séance.**
`ProgressionType` (paquet `fr.club.plongee.progression`, écran
`/admin/progressions`) est rattachée à une version du référentiel, pas au
niveau, et porte des `PeriodeProgression` : une plage de mois (1-12, qui
peut enjamber le changement d'année), un milieu facultatif et les blocs
travaillés. En mois et non en dates, pour resservir d'une saison à l'autre.
Choix du club (2026) : un découpage séance par séance a été écarté comme trop
lourd à tenir. Un bloc peut figurer dans plusieurs périodes. V22 installe
une proposition par niveau (N1 PE20, N2 PA20|PE40, N3 PA40|PE60), à adapter
depuis l'écran. Une saison suit au plus une progression par référentiel
(table `progression_saison`, choix dans `/admin/saisons`, règle tenue par
`ProgressionService`) ; aucune migration ne rattache une progression à une
saison réelle (seules les démos V102 et V107 le font). Chaque séance affiche la période
qui couvre son mois (`core/progression.ts`, `ProgrammeSeanceComponent`,
liste des séances et feuille de présence ; embarqué hors ligne). Dans la
grille, les blocs de la période du mois (séance choisie, sinon aujourd'hui)
sont marqués « Au programme ». Le **retard est calculé par le serveur**
(`EcheancesProgression`, appelé par `GrilleService`) : l'échéance d'un bloc
est le dernier jour de la dernière période qui le contient, située dans
l'année de la saison ; un bloc est en retard si cette date est passée, qu'il
n'est pas validé et que ses critères ne sont pas tous acquis, pour un cursus
`EN_COURS` seulement. Conséquence : une période de fin de saison qui reprend
tous les blocs (validations en milieu naturel du N2/N3) repousse toutes les
échéances au mois de juin ; c'est voulu pour N2/N3, et V24 a retiré ce
travers de la proposition N1.
**Découpage par plongées (2026, pour vendre l'appli à un centre de plongée
en mer, une installation par structure).** `ProgressionType.decoupage`
(V73) : `MOIS` (toutes les progressions du club, rien ne change pour
elles) ou `PLONGEES`, fixé à la création. Une étape porte alors
`plongee_debut`/`plongee_fin` au lieu des mois : les numéros de plongée
**en milieu naturel** de l'élève, dans l'ordre où il y est noté présent
(`ParticipationRepository.plongeesEnMilieuNaturel`, par cursus). La grille
livre `decoupage`, `numerosPlongee` (séance → numéro) et `plongeesFaites` ;
l'étape « Au programme » est celle de la plongée de la séance choisie,
sinon de la prochaine (`core/progression.ts`, `periodeDeLaPlongee`).
Échéance d'un bloc = dernière plongée de sa dernière étape
(`BlocVue.echeancePlongee`) ; en retard quand l'élève a fait cette plongée
un jour précédent (`EcheancesProgression.enRetardEnPlongees`). Une
progression par plongées n'a pas de période par date : le programme des
séances, la liste des séances et le parcours (« En ce moment ») l'ignorent.
**Modèle « centre de plongée en mer »** : `modeles/centre-mer.sql`, **pas
une migration**, exécuté une fois sur demande d'un ADMIN
(`ModeleCentreMerService`, bouton de `/admin/progressions`) : 44 exercices
N1 écrits pour la mer (numéros `M1.1`…`M10.6`, chaque critère technique a
une maîtrise), progressions N1 (6 plongées), N2 (8), N3 (10) — le N2/N3
reprennent V59/V61. Option : désactiver les 90 exercices N1 « piscine »
de V51. Le club ne l'installe pas ; corriger le contenu installé passe par
les écrans d'admin, comme pour les migrations.
