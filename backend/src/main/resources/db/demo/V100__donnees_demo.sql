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

-- Camille obtient son N1 : premier brevet delivre via le vrai circuit (cursus
-- DELIVRE + ligne delivrance), pas juste une qualification pre-existante comme
-- Mateo/Sonia ci-dessus. Ses presences sont toutes en piscine, donc il lui
-- reste les 4 plongees en milieu naturel dues dans l'annee (voir chantier n.3).
UPDATE cursus SET statut = 'DELIVRE'
 WHERE id = (SELECT c.id FROM cursus c
              JOIN eleve e ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000010');

INSERT INTO delivrance (cursus_id, delivre_par_id, date_delivrance, numero_brevet,
                         plongees_milieu_naturel_a_faire, echeance_plongees)
SELECT c.id, u.id, DATE '2025-10-01', 'FFESSM-2025-0142', 4, DATE '2026-10-01'
  FROM cursus c
  JOIN eleve e ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000010'
  JOIN utilisateur u ON u.email = 'e3@club.fr';

INSERT INTO qualification (eleve_id, type, date_obtention)
SELECT id, 'N1', DATE '2025-10-01' FROM eleve WHERE numero_licence = 'A-01-000010';

-- Fiches de securite des deux sorties en milieu naturel a la Carriere de Blaisy.
INSERT INTO fiche_securite (seance_id, dp_id, meteo, etat_mer, visibilite, courant, maree, temperature_eau,
                             securite_surface, plan_secours)
SELECT s.id, u.id, 'Ensoleille, vent faible', 'Plan d''eau calme', '8 m', 'Nul', NULL, '14 degres',
       'Un surveillant de securite surface avec bouee torpille, VHF canal 16 en secours',
       'Numero du SAMU (15) et du CROSS affiches au point de rassemblement ; DAE dans le local club'
  FROM seance s, utilisateur u
 WHERE s.date_seance = DATE '2025-10-11' AND u.email = 'presidente@club.fr';

INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue,
                        profondeur_realisee, duree_realisee, paliers, heure_immersion, heure_sortie)
SELECT f.id, 1, 20, 30, 18, 28, 'Aucun', TIME '10:00', TIME '10:28'
  FROM fiche_securite f JOIN seance s ON s.id = f.seance_id
 WHERE s.date_seance = DATE '2025-10-11';
INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue,
                        profondeur_realisee, duree_realisee, paliers, heure_immersion, heure_sortie)
SELECT f.id, 2, 12, 35, 11, 33, 'Aucun', TIME '10:05', TIME '10:38'
  FROM fiche_securite f JOIN seance s ON s.id = f.seance_id
 WHERE s.date_seance = DATE '2025-10-11';

-- Palanquee 1 : Mateo (N1, prepare le N2) guide par Sonia (N2, prepare le N3), sous la responsabilite d'un E3.
INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, 'N1', 'N2', 'PLONGEUR'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN eleve e ON e.numero_licence = 'A-01-000013'
 WHERE s.date_seance = DATE '2025-10-11' AND p.numero = 1;
INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, 'N2', 'N3', 'GUIDE_PALANQUEE'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN eleve e ON e.numero_licence = 'A-01-000012'
 WHERE s.date_seance = DATE '2025-10-11' AND p.numero = 1;
INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, 'E3', 'ENCADRANT'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN utilisateur u ON u.email = 'e3@club.fr'
 WHERE s.date_seance = DATE '2025-10-11' AND p.numero = 1;

-- Palanquee 2 : Camille, fraichement N1, sur sa premiere plongee en milieu naturel, encadree par un E2.
INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, fonction, observations)
SELECT p.id, e.id, e.nom, e.prenom, 'N1', 'PLONGEUR', 'Premiere plongee en milieu naturel apres delivrance du N1.'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN eleve e ON e.numero_licence = 'A-01-000010'
 WHERE s.date_seance = DATE '2025-10-11' AND p.numero = 2;
INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, 'E2', 'ENCADRANT'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN utilisateur u ON u.email = 'e2@club.fr'
 WHERE s.date_seance = DATE '2025-10-11' AND p.numero = 2;

INSERT INTO fiche_securite (seance_id, dp_id, meteo, etat_mer, visibilite, courant, maree, temperature_eau,
                             securite_surface, plan_secours)
SELECT s.id, u.id, 'Couvert, quelques averses', 'Plan d''eau calme', '6 m', 'Nul', NULL, '13 degres',
       'Un surveillant de securite surface avec bouee torpille, VHF canal 16 en secours',
       'Numero du SAMU (15) et du CROSS affiches au point de rassemblement ; DAE dans le local club'
  FROM seance s, utilisateur u
 WHERE s.date_seance = DATE '2025-10-12' AND u.email = 'e3@club.fr';

-- Sonia prepare le N3 : plongee a 35 m encadree par un E3 (prerogative PE40 du N2).
INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue,
                        profondeur_realisee, duree_realisee, paliers, heure_immersion, heure_sortie)
SELECT f.id, 1, 35, 25, 33, 24, '3 min a 3 m', TIME '14:00', TIME '14:24'
  FROM fiche_securite f JOIN seance s ON s.id = f.seance_id
 WHERE s.date_seance = DATE '2025-10-12';

INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, 'N2', 'N3', 'PLONGEUR'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN eleve e ON e.numero_licence = 'A-01-000012'
 WHERE s.date_seance = DATE '2025-10-12' AND p.numero = 1;
INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, 'E3', 'ENCADRANT'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id JOIN seance s ON s.id = f.seance_id
  JOIN utilisateur u ON u.email = 'e3@club.fr'
 WHERE s.date_seance = DATE '2025-10-12' AND p.numero = 1;
