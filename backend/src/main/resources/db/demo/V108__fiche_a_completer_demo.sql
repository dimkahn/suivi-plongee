-- ============================================================
--  Demonstration (profil dev uniquement) : une fiche de securite
--  etablie avant la plongee mais pas encore completee au retour.
--
--  Dimanche 27/09/2026, Gravière du Fort, site du Tombant (V107) : le
--  DP a prepare deux palanquees ; profondeurs, durees et heures
--  realisees restent a saisir (ecran « Compléter au retour de plongée »).
--  Noms fictifs.
-- ============================================================

INSERT INTO fiche_securite (seance_id, dp_id, meteo, etat_mer, visibilite, courant, maree, temperature_eau,
                             securite_surface, plan_secours)
SELECT se.id, u.id, 'Voilé, vent faible', 'Plan d''eau calme', '4 m', 'Nul', NULL, '16 degrés',
       'Un surveillant de sécurité surface avec bouée torpille, VHF canal 16 en secours',
       'Numéro du SAMU (15) affiché au point de rassemblement ; DAE dans le véhicule du club'
  FROM seance se, utilisateur u
 WHERE se.date_seance = DATE '2026-09-27' AND se.lieu = 'Gravière du Fort' AND u.email = 'presidente@club.fr';

INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue)
SELECT f.id, v.numero, v.profondeur, v.duree
  FROM fiche_securite f
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2026-09-27' AND se.lieu = 'Gravière du Fort'
  JOIN (VALUES (1, 30, 30), (2, 20, 35)) AS v(numero, profondeur, duree) ON TRUE;

-- Palanquee 1 : Sonia (N2, prepare le N3) avec Gwendoline (E3).
-- Palanquee 2 : Camille (N1, prepare le N2) avec Flora (E2).
INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, m.aptitude, m.preparee, 'PLONGEUR'
  FROM (VALUES (1, 'A-01-000012', 'N2', 'N3'), (2, 'A-01-000010', 'N1', 'N2')) AS m(numero, licence, aptitude, preparee)
  JOIN eleve e ON e.numero_licence = m.licence
  JOIN palanquee p ON p.numero = m.numero
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2026-09-27' AND se.lieu = 'Gravière du Fort';

INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, m.aptitude, 'ENCADRANT'
  FROM (VALUES (1, 'e3@club.fr', 'E3'), (2, 'e2@club.fr', 'E2')) AS m(numero, email, aptitude)
  JOIN utilisateur u ON u.email = m.email
  JOIN palanquee p ON p.numero = m.numero
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2026-09-27' AND se.lieu = 'Gravière du Fort';
