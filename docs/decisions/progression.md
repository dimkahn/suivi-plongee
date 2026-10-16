# Progressions types : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/progression.md`.

## Découpage par périodes de mois
- **Date :** 2026, choix du club ; V22.
- **Contexte :** découper l'année de formation pour situer chaque séance et mesurer le retard.
- **Décision :** des périodes de mois rattachées à une version du référentiel. Écarté : le découpage séance par séance, trop lourd à tenir ; les dates, qui ne resservent pas d'une saison à l'autre.
- **Conséquences :** V22 installe une proposition par niveau (N1 PE20, N2 PA20|PE40, N3 PA40|PE60), à adapter depuis l'écran.

## Échéances repoussées par une période de fin de saison
- **Date :** V24.
- **Contexte :** une période de fin de saison qui reprend tous les blocs (validations en milieu naturel du N2/N3) repousse toutes les échéances au mois de juin.
- **Décision :** gardé pour N2/N3, où c'est voulu ; V24 a retiré ce travers de la proposition N1.
- **Conséquences :** le retard N1 se lit sur des échéances étalées dans l'année.

## Découpage par plongées
- **Date :** 2026, V73.
- **Contexte :** vendre l'appli à un centre de plongée en mer, une installation par structure.
- **Décision :** `ProgressionType.decoupage` : `MOIS` ou `PLONGEES`, fixé à la création ; étapes en numéros de plongée en milieu naturel.
- **Conséquences :** rien ne change pour les progressions du club (toutes en `MOIS`). Une progression par plongées est ignorée par le programme des séances, la liste des séances et le parcours.

## Modèle « centre de plongée en mer » hors migration
- **Date :** 2026.
- **Contexte :** fournir un contenu prêt pour un centre en mer sans l'imposer au club.
- **Décision :** `modeles/centre-mer.sql`, exécuté une fois sur demande d'un ADMIN, pas une migration.
- **Conséquences :** le club ne l'installe pas. Corriger le contenu installé passe par les écrans d'admin, comme pour les migrations.
