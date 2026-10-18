-- « Avez-vous emprunté du matériel ? » : la carte « Mon séjour » pose la
-- question à chaque participant (demande du club, 2026). Il déclare ce qu'il
-- a emprunté (sejour_pret, V84), ou répond qu'il n'a rien emprunté : cette
-- réponse est gardée ici, pour ne plus lui poser la question. Déclarer un
-- emprunt la retire.

ALTER TABLE sejour_participant ADD COLUMN rien_emprunte BOOLEAN DEFAULT FALSE NOT NULL;
