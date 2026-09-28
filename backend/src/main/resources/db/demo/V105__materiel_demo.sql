-- Demonstration (profil dev) : un directeur technique, un petit parc de
-- materiel dans tous les etats (disponible, echeance proche, a
-- regulariser, hors service) et deux prets, l'un en cours, l'autre rendu.
-- Dates relatives au jour de lancement, pour que les etats restent parlants.

INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'DIRECTEUR_TECHNIQUE' FROM utilisateur WHERE email = 'e3@club.fr';

INSERT INTO equipement (type, reference, marque, modele, numero_serie, date_achat, date_mise_en_service,
                        volume_litres, pression_service_bar, pression_epreuve_bar, matiere, robinetterie,
                        date_premiere_epreuve, nitrox, regime_tiv) VALUES
 ('BLOC', 'B-01', 'Roth', NULL, 'RO-458812', DATE '2021-03-10', DATE '2021-03-15',
  12, 232, 348, 'ACIER', 'Mono-sortie DIN/étrier', DATE '2021-02-01', FALSE, TRUE),
 ('BLOC', 'B-02', 'Roth', NULL, 'RO-459907', DATE '2021-03-10', DATE '2021-03-15',
  15, 232, 348, 'ACIER', 'Double sortie DIN', DATE '2021-02-01', FALSE, TRUE),
 ('BLOC', 'B-03', 'Luxfer', 'S80', 'LX-77120', DATE '2019-05-02', DATE '2019-05-10',
  11.1, 207, 310, 'ALUMINIUM', 'Mono-sortie DIN', DATE '2019-04-01', TRUE, TRUE);

INSERT INTO equipement (type, reference, marque, modele, numero_serie, date_achat, date_mise_en_service,
                        periodicite_revision_mois, composition, notice, consignes_entretien) VALUES
 ('DETENDEUR', 'D-01', 'Aqualung', 'Legend', 'AQ-100245', DATE '2022-09-01', DATE '2022-09-15', 24,
  '1er étage Legend, 2e étage Legend, octopus Legend, manomètre Aqualung',
  'Classeur matériel, onglet Détendeurs',
  'Rinçage à l''eau douce après chaque sortie, désinfection à chaque changement d''utilisateur, révision tous les deux ans chez le revendeur.'),
 ('DETENDEUR', 'D-02', 'Scubapro', 'MK25 / S600', 'SP-883410', DATE '2020-04-01', DATE '2020-04-20', 24,
  '1er étage MK25, 2e étage S600, octopus R195, manomètre Scubapro',
  'Classeur matériel, onglet Détendeurs', NULL);

INSERT INTO equipement (type, reference, marque, modele, numero_serie, taille, date_achat, date_mise_en_service,
                        periodicite_revision_mois, hors_service, remarques) VALUES
 ('GILET', 'G-01', 'Mares', 'Prestige', 'MA-22019', 'M', DATE '2022-09-01', DATE '2022-09-15', 24, FALSE, NULL),
 ('GILET', 'G-02', 'Mares', 'Prestige', 'MA-22020', 'L', DATE '2022-09-01', DATE '2022-09-15', 24, TRUE,
  'Inflateur qui fuit : en attente de pièce.');

INSERT INTO equipement (type, reference, marque, modele, taille, epaisseur_mm, date_achat, date_rebut_prevue) VALUES
 ('COMBINAISON', 'C-01', 'Beuchat', 'Focea', 'M', 7, DATE '2023-10-01', DATE '2031-10-01'),
 ('COMBINAISON', 'C-02', 'Beuchat', 'Focea', 'S', 5, DATE '2023-10-01', DATE '2031-10-01');

-- Journal : inspections TIV et requalifications des blocs, revisions.
INSERT INTO intervention_equipement (equipement_id, type, date_intervention, intervenant, resultat, description, saisi_par_id)
SELECT e.id, j.type, DATEADD('DAY', j.il_y_a_jours * -1, CURRENT_DATE), j.intervenant, j.resultat, j.description, u.id
  FROM (VALUES
        ('B-01', 'REQUALIFICATION',     700, 'Centre de requalification agréé', 'CONFORME', NULL),
        ('B-01', 'INSPECTION_VISUELLE',  90, 'TIV Gwendoline Marchand n° 12345', 'CONFORME', NULL),
        ('B-02', 'REQUALIFICATION',     700, 'Centre de requalification agréé', 'CONFORME', NULL),
        ('B-02', 'INSPECTION_VISUELLE', 350, 'TIV Gwendoline Marchand n° 12345', 'CONFORME', NULL),
        ('B-03', 'INSPECTION_VISUELLE', 430, 'TIV Gwendoline Marchand n° 12345', 'CONFORME', NULL),
        ('D-01', 'REVISION',            180, 'Plongée Services', 'CONFORME', 'Kit de révision constructeur, filtre changé.'),
        ('D-02', 'REVISION',            900, 'Plongée Services', 'CONFORME', NULL),
        ('G-01', 'REVISION',            365, 'Plongée Services', 'CONFORME', NULL),
        ('G-02', 'INCIDENT',             20, NULL, NULL, 'Inflateur qui fuit en surface.')
       ) AS j(reference, type, il_y_a_jours, intervenant, resultat, description)
  JOIN equipement e ON e.reference = j.reference
  JOIN utilisateur u ON u.email = 'e3@club.fr';

-- Pret en cours a Camille Berthier : bloc, detendeur (desinfecte a la remise), gilet.
INSERT INTO pret (eleve_id, emprunteur_nom, motif, date_pret, date_retour_prevue, prete_par_id)
SELECT e.id, 'Camille Berthier', 'Week-end en carrière', DATEADD('DAY', -2, CURRENT_DATE),
       DATEADD('DAY', 3, CURRENT_DATE), u.id
  FROM eleve e, utilisateur u
 WHERE e.numero_licence = 'A-01-000010' AND u.email = 'e3@club.fr';

INSERT INTO pret_equipement (pret_id, equipement_id)
SELECT p.id, e.id FROM pret p, equipement e
 WHERE p.emprunteur_nom = 'Camille Berthier' AND e.reference IN ('B-01', 'D-01', 'G-01');

INSERT INTO intervention_equipement (equipement_id, type, date_intervention, description, pret_id, saisi_par_id)
SELECT e.id, 'DESINFECTION', p.date_pret, 'Avant remise à Camille Berthier.', p.id, p.prete_par_id
  FROM pret p, equipement e
 WHERE p.emprunteur_nom = 'Camille Berthier' AND e.reference = 'D-01';

-- Pret rendu : une combinaison pretee a un encadrant.
INSERT INTO pret (utilisateur_id, emprunteur_nom, motif, date_pret, date_retour_prevue, date_retour,
                  prete_par_id, recu_par_id)
SELECT u.id, 'Tiago Nogueira', 'Sortie mer', DATEADD('DAY', -40, CURRENT_DATE), DATEADD('DAY', -35, CURRENT_DATE),
       DATEADD('DAY', -35, CURRENT_DATE), dt.id, dt.id
  FROM utilisateur u, utilisateur dt
 WHERE u.email = 'e1@club.fr' AND dt.email = 'e3@club.fr';

INSERT INTO pret_equipement (pret_id, equipement_id)
SELECT p.id, e.id FROM pret p, equipement e
 WHERE p.emprunteur_nom = 'Tiago Nogueira' AND e.reference = 'C-02';
