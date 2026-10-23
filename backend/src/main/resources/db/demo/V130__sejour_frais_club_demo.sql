-- Demonstration (profil dev) : le club avance le bateau du samedi au sejour a
-- Port-Cros (V117, V99_3), 240 EUR pour les plongeurs, qui lui remboursent
-- leur part (payeur_id null : le club).
INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour)
SELECT s.id, 'Bateau de plongée du samedi', 'PLONGEE', 24000, NULL, DATE '2027-06-05'
  FROM sortie s WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_depense_part (depense_id, participant_id, parts)
SELECT d.id, p.id, 1 FROM sejour_depense d JOIN sejour_participant p ON p.sortie_id = d.sortie_id
 WHERE d.libelle = 'Bateau de plongée du samedi' AND p.plongeur = TRUE;
