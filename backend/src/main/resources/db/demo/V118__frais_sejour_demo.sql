-- Demonstration (profil dev) : les frais du sejour a Port-Cros (V117, V76).
-- Gwendoline avance le gite (720 EUR, pour tout le monde), Flora la voiture de
-- location (180 EUR, pour ceux qui y montent), Sonia les courses (96 EUR).
INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour)
SELECT s.id, 'Gîte des Salins, 4 nuits', 'HEBERGEMENT', 72000, p.id, DATE '2027-06-03'
  FROM sortie s JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Gwendoline'
 WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_depense_part (depense_id, participant_id, parts)
SELECT d.id, p.id, 1 FROM sejour_depense d JOIN sejour_participant p ON p.sortie_id = d.sortie_id
 WHERE d.libelle = 'Gîte des Salins, 4 nuits';

INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour)
SELECT s.id, 'Voiture de location', 'TRANSPORT', 18000, p.id, DATE '2027-06-03'
  FROM sortie s JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Flora'
 WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_depense_part (depense_id, participant_id, parts)
SELECT d.id, p.id, 1 FROM sejour_depense d JOIN sejour_participant p ON p.sortie_id = d.sortie_id
 WHERE d.libelle = 'Voiture de location' AND p.prenom IN ('Flora', 'Camille', 'Mateo');

INSERT INTO sejour_depense (sortie_id, libelle, categorie, montant_centimes, payeur_id, jour)
SELECT s.id, 'Courses du week-end', 'REPAS', 9600, p.id, DATE '2027-06-04'
  FROM sortie s JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Sonia'
 WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_depense_part (depense_id, participant_id, parts)
SELECT d.id, p.id, 1 FROM sejour_depense d JOIN sejour_participant p ON p.sortie_id = d.sortie_id
 WHERE d.libelle = 'Courses du week-end';
