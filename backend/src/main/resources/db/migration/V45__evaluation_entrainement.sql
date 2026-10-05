-- ============================================================
--  N2 et N3 : suivi des exercices en piscine et en fosse, distinct
--  de l'evaluation en milieu naturel (choix du club, 2026).
--
--  Les competences d'un referentiel « milieu naturel exclusif »
--  s'obtiennent toujours en milieu naturel ; une note prise sur une
--  seance en piscine ou en fosse est desormais acceptee, mais marquee
--  « entrainement » : elle a son propre etat courant et ne compte ni
--  pour l'acquisition d'un critere, ni pour la validation d'un bloc.
--  Fixe a la saisie (la table reste en ajout seul) : changer plus tard
--  le milieu d'une seance ne reclasse pas les notes deja prises.
--  Aucune ligne existante n'est concernee : jusqu'ici le serveur
--  refusait ces notes.
-- ============================================================

ALTER TABLE evaluation ADD COLUMN entrainement BOOLEAN NOT NULL DEFAULT FALSE;
