-- Demonstration (profil dev) : un sejour a Port-Cros en juin 2027, avec ses
-- participants (noms fictifs de V100), leurs vols, deux voitures, un gite et
-- ses chambres, la liste des affaires et le programme (V75).
-- Camille (eleve@club.fr) y participe : elle lit le carnet du sejour.
INSERT INTO sortie (nom, lieu, date_debut, date_fin, remarques)
VALUES ('Séjour à Port-Cros', 'Hyères — Port-Cros', DATE '2027-06-04', DATE '2027-06-07',
        'Quatre jours de plongée dans le parc national.');

INSERT INTO sejour (sortie_id, infos_pratiques)
SELECT id, 'Urgences : 112 — CROSS Med (en mer) : 196.
Centre de plongée : Port d''Hyères, ponton C, 04 00 00 00 00.
Caisson hyperbare le plus proche : hôpital Sainte-Anne, Toulon.
Rendez-vous chaque matin à 8 h au ponton.'
  FROM sortie WHERE nom = 'Séjour à Port-Cros';

INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur, telephone, email,
       regimes, regime_precision, urgence_nom, urgence_telephone,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu)
SELECT s.id, NULL, u.id, 'Marchand', 'Gwendoline', TRUE, '06 00 00 00 01', 'e3@club.fr',
       NULL, NULL, 'Paul Marchand', '06 00 00 00 11',
       DATE '2027-06-03', TIME '19:00:00', 'VOITURE', NULL, 'Gîte des Salins',
       DATE '2027-06-07', TIME '17:00:00', 'VOITURE', NULL, 'Gîte des Salins'
  FROM sortie s, utilisateur u WHERE s.nom = 'Séjour à Port-Cros' AND u.email = 'e3@club.fr';

INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur, telephone, email,
       regimes, regime_precision, urgence_nom, urgence_telephone,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu)
SELECT s.id, NULL, u.id, 'Vasseur', 'Flora', TRUE, '06 00 00 00 02', 'e2@club.fr',
       'VEGETARIEN', NULL, NULL, NULL,
       DATE '2027-06-03', TIME '18:30:00', 'AVION', 'AF7520', 'Aéroport de Toulon-Hyères',
       DATE '2027-06-07', TIME '20:10:00', 'AVION', 'AF7527', 'Aéroport de Toulon-Hyères'
  FROM sortie s, utilisateur u WHERE s.nom = 'Séjour à Port-Cros' AND u.email = 'e2@club.fr';

INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur, telephone, email,
       regimes, regime_precision, urgence_nom, urgence_telephone,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu)
SELECT s.id, e.id, NULL, e.nom, e.prenom, TRUE, NULL, 'eleve@club.fr',
       'SANS_PORC', NULL, 'Hélène Berthier', '06 00 00 00 13',
       DATE '2027-06-03', TIME '18:30:00', 'AVION', 'AF7520', 'Aéroport de Toulon-Hyères',
       DATE '2027-06-07', TIME '20:10:00', 'AVION', 'AF7527', 'Aéroport de Toulon-Hyères'
  FROM sortie s, eleve e WHERE s.nom = 'Séjour à Port-Cros' AND e.numero_licence = 'A-01-000010';

INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur, telephone, email,
       regimes, regime_precision, urgence_nom, urgence_telephone,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu)
SELECT s.id, e.id, NULL, e.nom, e.prenom, TRUE, NULL, NULL,
       'VEGETALIEN,SANS_GLUTEN', 'Pas de miel', NULL, NULL,
       DATE '2027-06-03', TIME '21:05:00', 'TRAIN', 'TGV 6171', 'Gare de Toulon',
       DATE '2027-06-07', TIME '18:40:00', 'TRAIN', 'TGV 6178', 'Gare de Toulon'
  FROM sortie s, eleve e WHERE s.nom = 'Séjour à Port-Cros' AND e.numero_licence = 'A-01-000012';

INSERT INTO sejour_participant (sortie_id, eleve_id, utilisateur_id, nom, prenom, plongeur, telephone, email,
       regimes, regime_precision, urgence_nom, urgence_telephone,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_numero, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_numero, depart_lieu)
SELECT s.id, e.id, NULL, e.nom, e.prenom, TRUE, NULL, NULL,
       NULL, NULL, NULL, NULL,
       DATE '2027-06-03', TIME '18:30:00', 'AVION', 'AF7520', 'Aéroport de Toulon-Hyères',
       DATE '2027-06-07', TIME '20:10:00', 'AVION', 'AF7527', 'Aéroport de Toulon-Hyères'
  FROM sortie s, eleve e WHERE s.nom = 'Séjour à Port-Cros' AND e.numero_licence = 'A-01-000013';

INSERT INTO sejour_participant (sortie_id, nom, prenom, plongeur, regimes,
       arrivee_date, arrivee_heure, arrivee_transport, arrivee_lieu,
       depart_date, depart_heure, depart_transport, depart_lieu)
SELECT id, 'Ferrand', 'Jules', FALSE, NULL,
       DATE '2027-06-03', TIME '19:00:00', 'VOITURE', 'Gîte des Salins',
       DATE '2027-06-07', TIME '17:00:00', 'VOITURE', 'Gîte des Salins'
  FROM sortie WHERE nom = 'Séjour à Port-Cros';

-- La voiture de Gwendoline vient du club ; la voiture de location attend
-- le vol de 18 h 30 a l'aeroport.
INSERT INTO sejour_voiture (sortie_id, nom, places, conducteur_id, trajet)
SELECT s.id, 'Voiture de Gwendoline', 5, p.id, 'Aller-retour depuis le club'
  FROM sortie s JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Gwendoline'
 WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_voiture_passager (voiture_id, participant_id)
SELECT v.id, p.id FROM sejour_voiture v JOIN sejour_participant p ON p.sortie_id = v.sortie_id
 WHERE v.nom = 'Voiture de Gwendoline' AND p.prenom = 'Jules';

INSERT INTO sejour_voiture (sortie_id, nom, places, conducteur_id, trajet, remarques)
SELECT s.id, 'Location aéroport', 5, p.id, 'Aéroport de Toulon-Hyères ↔ gîte', 'Réservée au nom de Flora.'
  FROM sortie s JOIN sejour_participant p ON p.sortie_id = s.id AND p.prenom = 'Flora'
 WHERE s.nom = 'Séjour à Port-Cros';
INSERT INTO sejour_voiture_passager (voiture_id, participant_id)
SELECT v.id, p.id FROM sejour_voiture v JOIN sejour_participant p ON p.sortie_id = v.sortie_id
 WHERE v.nom = 'Location aéroport' AND p.prenom IN ('Camille', 'Mateo');

INSERT INTO sejour_logement (sortie_id, nom, adresse, remarques)
SELECT id, 'Gîte des Salins', '12 chemin des Salins, Hyères', 'Clés dans la boîte à code (code donné la veille).'
  FROM sortie WHERE nom = 'Séjour à Port-Cros';

INSERT INTO sejour_chambre (logement_id, nom, couchages, remarques, ordre)
SELECT id, 'Chambre 1', 2, 'Lit double', 0 FROM sejour_logement WHERE nom = 'Gîte des Salins';
INSERT INTO sejour_chambre (logement_id, nom, couchages, remarques, ordre)
SELECT id, 'Chambre 2', 3, 'Trois lits simples', 1 FROM sejour_logement WHERE nom = 'Gîte des Salins';
INSERT INTO sejour_chambre (logement_id, nom, couchages, remarques, ordre)
SELECT id, 'Chambre 3', 2, NULL, 2 FROM sejour_logement WHERE nom = 'Gîte des Salins';

INSERT INTO sejour_chambre_occupant (chambre_id, participant_id)
SELECT c.id, p.id FROM sejour_chambre c
  JOIN sejour_logement l ON l.id = c.logement_id
  JOIN sejour_participant p ON p.sortie_id = l.sortie_id
 WHERE l.nom = 'Gîte des Salins' AND c.nom = 'Chambre 1' AND p.prenom IN ('Gwendoline', 'Jules');
INSERT INTO sejour_chambre_occupant (chambre_id, participant_id)
SELECT c.id, p.id FROM sejour_chambre c
  JOIN sejour_logement l ON l.id = c.logement_id
  JOIN sejour_participant p ON p.sortie_id = l.sortie_id
 WHERE l.nom = 'Gîte des Salins' AND c.nom = 'Chambre 2' AND p.prenom IN ('Flora', 'Camille', 'Sonia');

INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'DOCUMENTS', 'Carte d''identité ou passeport', TRUE, 0 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'DOCUMENTS', 'Carte de niveau et licence FFESSM', TRUE, 1 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'DOCUMENTS', 'Certificat médical (CACI) en cours de validité', TRUE, 2 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'PLONGEE', 'Masque, palmes, tuba', TRUE, 3 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'PLONGEE', 'Combinaison 5 mm', FALSE, 4 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'PLONGEE', 'Ordinateur de plongée', FALSE, 5 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'SEJOUR', 'Crème solaire respectueuse des récifs', FALSE, 6 FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_affaire (sortie_id, categorie, libelle, indispensable, ordre)
SELECT id, 'SEJOUR', 'Draps ou sac de couchage', TRUE, 7 FROM sortie WHERE nom = 'Séjour à Port-Cros';

INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
SELECT id, DATE '2027-06-03', TIME '19:30:00', NULL, 'Arrivée au gîte', 'Gîte des Salins',
       'La location récupère le vol de 18 h 30.' FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
SELECT id, DATE '2027-06-04', TIME '08:00:00', NULL, 'Rendez-vous au ponton', 'Port d''Hyères', NULL
  FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
SELECT id, DATE '2027-06-05', TIME '20:00:00', NULL, 'Repas du club', 'Restaurant du port',
       'Réservé pour six.' FROM sortie WHERE nom = 'Séjour à Port-Cros';
INSERT INTO sejour_evenement (sortie_id, jour, heure_debut, heure_fin, titre, lieu, details)
SELECT id, DATE '2027-06-07', TIME '14:00:00', TIME '16:00:00', 'Rinçage et rangement du matériel', 'Centre de plongée',
       NULL FROM sortie WHERE nom = 'Séjour à Port-Cros';
