-- ============================================================
--  Retrait du mail de réservation du loueur (V82) : la
--  fonctionnalité a été annulée. V82 reste en place, inchangée,
--  pour les bases qui l'ont déjà appliquée ; on retire ici la
--  colonne qu'elle avait ajoutée.
-- ============================================================

ALTER TABLE sejour_voiture DROP COLUMN location_html;
