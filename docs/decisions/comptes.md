# Comptes et e-mail : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/comptes.md`
et `.claude/rules/donnees-personnelles.md`.

## Relances automatiques des CACI

- **Date** : 2026-10, demande du club (spec et plan : `docs/specs/2026-10-21-relances-caci/`).
- **Contexte** : l'état « bientôt échu » d'un CACI n'existait qu'à l'écran ; personne n'était prévenu sans ouvrir l'appli.
- **Décision** : chaque jour à 7 h, heure de Paris (`DeclencheurRelancesCaci`, `@Scheduled` avec `zone`), `RelancesCaciService.executer(D)` écrit aux moniteurs actifs 30 jours avant la fin de validité puis le dernier jour, et envoie aux administrateurs actifs un récapitulatif les jours où une échéance tombe (élèves de la saison ouverte compris ; les élèves ne reçoivent rien). Texte brut sans lien, par `ServiceNotification.envoyerCourriel`. Aucune route ni bouton ne déclenche le traitement.
- **Deux jeux de tables** (`V99_1__relances_caci.sql`, SQL seul, sans Envers) : `relance_caci_envoi` (+ `_personne`), la trace lue par `GET /api/admin/relances-caci`, sans fin de validité ni mention, noms recopiés sans clé étrangère, purgée après 2 ans ; `relance_caci_faite`, jamais exposée, qui garde la fin de validité pour ne relancer qu'une fois par fin de validité et par moment (une date corrigée ouvre un nouveau cycle). Une seule table qui porterait la fin de validité aurait contredit la trace voulue par le club ; des colonnes « relancé le » sur des entités auditées auraient créé une révision Envers par relance.
- **Numéro de migration** : `V99_1`, entre la dernière migration de schéma (V99) et la démo (V100 et suivantes) ; suite `V99_n` dans le skill `nouvelle-migration`.
- **Horloge** : bean `Clock` (`config/HorlogeConfig`, UTC), injecté dans le déclencheur ; la date du club vient de `Calendrier.aujourdhui(Clock)`. Les tests construisent le déclencheur avec `Clock.fixed` plutôt que de remplacer le bean (pas de contexte Spring de plus). Les tâches de 3 h 30 et 3 h 35 gardent `Calendrier.aujourdhui()`.
- **Journal** : jamais d'adresse, de nom ni de date de CACI ; `ServiceNotificationEmail` ne journalise plus que le type de l'exception, pour tous les e-mails, et une erreur inattendue du traitement est journalisée par son seul type.
- **Conséquences** : le premier passage en production rattrape toutes les personnes dans leur fenêtre de 30 jours et cite toutes celles sans CACI : premier récapitulatif long, à annoncer au club. Une seule instance du backend (pas de verrou distribué). RIFAP et plongées en milieu naturel restent à faire.
