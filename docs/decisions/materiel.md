# Matériel, prêts, sorties : historique des décisions

Historique des choix. Les règles en vigueur sont dans `.claude/rules/materiel.md`.

## Le matériel confié au directeur technique

- **Date** : 2026, V29.
- **Contexte** : le club gérait son matériel hors de l'appli.
- **Décision** : rôle `DIRECTEUR_TECHNIQUE`, cumulé avec MONITEUR ; `/api/materiel/**` ouvert au DT et à l'ADMIN. Cadre retenu : détendeurs, gilets et combinaisons prêtés traités comme des EPI d'occasion (position FFESSM 2018) ; fiche de gestion selon A322-177 et l'annexe III-27.
- **Conséquences** : un seul `Equipement` pour les quatre types ; journal `intervention_equipement` en ajout seul ; échéances calculées par le serveur ; pas de mode hors ligne.

## Photos avant/après prêt

- **Date** : 2026, V30.
- **Décision** : table `photo_pret` séparée, comme `photo_eleve`. Suppression seulement tant que le prêt est en cours, ensuite elles font foi.
- **Conséquences** : pas de consentement à l'image, puisqu'on photographie le matériel et non les personnes.

## Les prêts rattachés à une sortie, plus à une séance

- **Date** : 2026, V31.
- **Contexte** : un prêt se rattachait d'abord à une séance (`pret.seance_id`).
- **Décision** : création des sorties (`Sortie`) ; V31 a retiré `pret.seance_id` au profit de `pret.sortie_id`. Retour prévu par défaut = dernier jour de la sortie.
- **Conséquences** : une sortie qui porte des prêts ne se supprime plus.

## Reprise du classeur Excel « Historique Blocs »

- **Date** : 2026, V33.
- **Contexte** : le club tenait l'historique des blocs dans un classeur Excel.
- **Décision** : import par titres de colonnes ; V33 a ajouté `proprietaire`, `constructeur`, `ancienne_reference`, `numero_robinet` pour ne rien perdre du classeur.
- **Conséquences** : réimport sans doublon ; le fichier du club n'est pas dans le dépôt, le test fabrique le sien. Un export au même format a suivi, réimportable sans perte.

## L'ancien numéro suit le matériel partout

- **Date** : 2026-10.
- **Contexte** : demande du club : un matériel renuméroté doit toujours montrer son nom et son ancien nom, à l'affichage comme à la recherche ; les vieilles étiquettes et les habitudes restent.
- **Décision** : « B-12 (ancien n° 12) » partout (`core/nom-equipement.ts` côté écran, `Equipement.designation()` dans les messages du serveur) ; les vues de prêt, de photo de prêt et de séjour portent `ancienneReference`. Chaque recherche (inventaire, prêts, séjour, scanner) trouve aussi l'ancien numéro. Au scanner, la référence actuelle prime ; un ancien numéro porté par plusieurs équipements est refusé en les citant, plutôt que d'en choisir un.

## Fiche d'inspection TIV

- **Date** : 2026, V34.
- **Décision** : questions portées par un enum (`PointInspectionTiv`) plutôt qu'une table ; n° de TIV repris de la dernière fiche du compte plutôt qu'une colonne sur `utilisateur`.
- **Écarté** : l'envoi au dispositif fédéral en ligne.
- **Conséquences** : la saisie rapide « Inspection visuelle » du journal est gardée pour la reprise d'historique.

## Rôle TIV

- **Date** : 2026, V35.
- **Décision** : rôle cumulé avec MONITEUR, limité aux inspections et à la consultation de l'inventaire. Il ne voit pas les emprunteurs, qui peuvent être mineurs.

## Étiquettes QR code

- **Date** : 2026.
- **Décision** : le QR code porte l'id et non la référence, pour corriger une référence sans réimprimer. Lecture par `BarcodeDetector` sur Chrome Android, par le serveur sur photo ailleurs (iPhone).

## Suites envisagées, non faites

- Masques et tubas (A322-81 cite les tubas).
- Rappel des échéances par e-mail.
- Export PDF de la fiche de gestion.
