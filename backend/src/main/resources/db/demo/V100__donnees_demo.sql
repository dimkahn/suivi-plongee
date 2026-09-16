-- ============================================================
--  Jeu de demonstration (profil dev uniquement).
--  Mot de passe de tous les comptes : plongee2026
--  Ne jamais charger ce fichier en production.
-- ============================================================

INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, actif, niveau_encadrement, numero_licence) VALUES
 ('presidente@club.fr', '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Ferrand',  'Claire',     TRUE, 'E4', 'A-01-000001'),
 ('e3@club.fr',         '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Marchand', 'Gwendoline', TRUE, 'E3', 'A-01-000002'),
 ('e2@club.fr',         '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Vasseur',  'Flora',      TRUE, 'E2', 'A-01-000003'),
 ('e1@club.fr',         '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Nogueira', 'Tiago',      TRUE, 'E1', 'A-01-000004'),
 ('eleve@club.fr',      '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Berthier', 'Camille',    TRUE, NULL, 'A-01-000010');

INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'ADMIN'    FROM utilisateur WHERE email = 'presidente@club.fr';
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'MONITEUR' FROM utilisateur WHERE email IN ('presidente@club.fr','e3@club.fr','e2@club.fr','e1@club.fr');
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'ELEVE'    FROM utilisateur WHERE email = 'eleve@club.fr';

INSERT INTO saison (libelle, date_debut, date_fin, ouverte)
VALUES ('2025-2026', DATE '2025-09-01', DATE '2026-06-30', TRUE);

-- Eleves : prenoms fictifs, aucune donnee reelle.
INSERT INTO eleve (nom, prenom, date_naissance, numero_licence, certificat_valide_jusqu_au, autorisation_legale) VALUES
 ('Berthier', 'Camille', DATE '2008-04-12', 'A-01-000010', DATE '2026-10-01', TRUE),
 ('Dulac',    'Anis',    DATE '2001-02-03', 'A-01-000011', DATE '2026-09-15', FALSE),
 ('Perrot',   'Sonia',   DATE '1994-11-27', 'A-01-000012', DATE '2026-12-20', FALSE),
 ('Vasquez',  'Mateo',   DATE '1989-06-08', 'A-01-000013', DATE '2026-07-01', FALSE);

UPDATE eleve SET utilisateur_id = (SELECT id FROM utilisateur WHERE email = 'eleve@club.fr')
 WHERE numero_licence = 'A-01-000010';

-- Mateo prepare le N2 : il detient deja le N1.
INSERT INTO qualification (eleve_id, type, date_obtention)
SELECT id, 'N1', DATE '2024-06-15' FROM eleve WHERE numero_licence = 'A-01-000013';
-- Sonia prepare le N3 : N1, N2 et RIFAP.
INSERT INTO qualification (eleve_id, type, date_obtention)
SELECT id, 'N1', DATE '2021-06-10' FROM eleve WHERE numero_licence = 'A-01-000012';
INSERT INTO qualification (eleve_id, type, date_obtention)
SELECT id, 'N2', DATE '2023-06-18' FROM eleve WHERE numero_licence = 'A-01-000012';
INSERT INTO qualification (eleve_id, type, date_obtention, expire_le)
SELECT id, 'RIFAP', DATE '2024-03-02', DATE '2027-03-02' FROM eleve WHERE numero_licence = 'A-01-000012';

-- Cursus, chacun fige sur le referentiel de son niveau.
INSERT INTO cursus (eleve_id, saison_id, referentiel_id, moniteur_referent_id, statut, ouvert_le)
SELECT e.id, s.id, r.id, m.id, 'EN_COURS', DATE '2025-09-22'
  FROM eleve e, saison s, referentiel r, utilisateur m
 WHERE e.numero_licence = 'A-01-000010' AND s.libelle = '2025-2026'
   AND r.niveau = 'N1' AND r.actif = TRUE AND m.email = 'e2@club.fr';

INSERT INTO cursus (eleve_id, saison_id, referentiel_id, moniteur_referent_id, statut, ouvert_le)
SELECT e.id, s.id, r.id, m.id, 'EN_COURS', DATE '2025-09-22'
  FROM eleve e, saison s, referentiel r, utilisateur m
 WHERE e.numero_licence = 'A-01-000011' AND s.libelle = '2025-2026'
   AND r.niveau = 'N1' AND r.actif = TRUE AND m.email = 'e1@club.fr';

INSERT INTO cursus (eleve_id, saison_id, referentiel_id, moniteur_referent_id, statut, ouvert_le)
SELECT e.id, s.id, r.id, m.id, 'EN_COURS', DATE '2025-09-22'
  FROM eleve e, saison s, referentiel r, utilisateur m
 WHERE e.numero_licence = 'A-01-000013' AND s.libelle = '2025-2026'
   AND r.niveau = 'N2' AND r.actif = TRUE AND m.email = 'e3@club.fr';

INSERT INTO cursus (eleve_id, saison_id, referentiel_id, moniteur_referent_id, statut, ouvert_le)
SELECT e.id, s.id, r.id, m.id, 'EN_COURS', DATE '2025-10-05'
  FROM eleve e, saison s, referentiel r, utilisateur m
 WHERE e.numero_licence = 'A-01-000012' AND s.libelle = '2025-2026'
   AND r.niveau = 'N3' AND r.actif = TRUE AND m.email = 'presidente@club.fr';

-- Seances : bassin le lundi, sorties en milieu naturel le week-end.
INSERT INTO seance (saison_id, date_seance, milieu, lieu, profondeur_max)
SELECT id, DATE '2025-09-22', 'ARTIFICIEL', 'Piscine municipale', 4 FROM saison WHERE libelle = '2025-2026';
INSERT INTO seance (saison_id, date_seance, milieu, lieu, profondeur_max)
SELECT id, DATE '2025-09-29', 'ARTIFICIEL', 'Piscine municipale', 4 FROM saison WHERE libelle = '2025-2026';
INSERT INTO seance (saison_id, date_seance, milieu, lieu, profondeur_max)
SELECT id, DATE '2025-10-11', 'NATUREL', 'Carriere de Blaisy', 20 FROM saison WHERE libelle = '2025-2026';
INSERT INTO seance (saison_id, date_seance, milieu, lieu, profondeur_max)
SELECT id, DATE '2025-10-12', 'NATUREL', 'Carriere de Blaisy', 35 FROM saison WHERE libelle = '2025-2026';

-- Presences sur la premiere seance de bassin.
INSERT INTO participation (cursus_id, seance_id, statut, atelier)
SELECT c.id, s.id, 'PRESENT', 'NAGE'
  FROM cursus c, seance s, eleve e
 WHERE c.eleve_id = e.id AND e.numero_licence IN ('A-01-000010','A-01-000011')
   AND s.date_seance = DATE '2025-09-22';

INSERT INTO participation (cursus_id, seance_id, statut, atelier)
SELECT c.id, s.id, 'PRESENT', 'BLOC'
  FROM cursus c, seance s, eleve e
 WHERE c.eleve_id = e.id AND e.numero_licence IN ('A-01-000010','A-01-000011')
   AND s.date_seance = DATE '2025-09-29';

-- Quelques evaluations deja saisies sur le N1 de Camille.
INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation, commentaire)
SELECT c.id, cr.id, s.id, u.id, 'ACQUIS', DATE '2025-09-22', NULL
  FROM cursus c
  JOIN eleve e   ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000010'
  JOIN referentiel r ON r.id = c.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id AND b.ordre = 1
  JOIN critere cr ON cr.bloc_id = b.id AND cr.ordre <= 3
  JOIN seance s  ON s.date_seance = DATE '2025-09-22'
  JOIN utilisateur u ON u.email = 'e2@club.fr';

INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation, commentaire)
SELECT c.id, cr.id, s.id, u.id, 'EN_COURS', DATE '2025-09-29', 'Vidage de masque a retravailler.'
  FROM cursus c
  JOIN eleve e   ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000010'
  JOIN referentiel r ON r.id = c.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id AND b.ordre = 5
  JOIN critere cr ON cr.bloc_id = b.id AND cr.ordre = 3
  JOIN seance s  ON s.date_seance = DATE '2025-09-29'
  JOIN utilisateur u ON u.email = 'e2@club.fr';
