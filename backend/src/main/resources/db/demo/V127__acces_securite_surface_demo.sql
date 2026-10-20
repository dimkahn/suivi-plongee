-- Démonstration des comptes de sécurité surface limités (V97), noms fictifs.
-- surface@club.fr : les plongées du séjour à Port-Cros, jusqu'au 14/06/2027.
UPDATE utilisateur SET acces_jusqu_au = DATE '2027-06-14' WHERE email = 'surface@club.fr';
INSERT INTO securite_surface_seance (utilisateur_id, seance_id)
SELECT u.id, ss.seance_id
  FROM utilisateur u, sortie so
  JOIN sortie_seance ss ON ss.sortie_id = so.id
 WHERE u.email = 'surface@club.fr' AND so.nom = 'Séjour à Port-Cros';

-- Un second compte, venu pour le week-end de rentrée : son accès est terminé, à réactiver.
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, actif, niveau_encadrement, numero_licence, acces_jusqu_au) VALUES
 ('surface-rentree@club.fr', '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Perrin', 'Maëlle', TRUE, NULL, NULL,
  DATE '2026-09-28');
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'SECURITE_SURFACE' FROM utilisateur WHERE email = 'surface-rentree@club.fr';
INSERT INTO securite_surface_seance (utilisateur_id, seance_id)
SELECT u.id, ss.seance_id
  FROM utilisateur u, sortie so
  JOIN sortie_seance ss ON ss.sortie_id = so.id
 WHERE u.email = 'surface-rentree@club.fr' AND so.nom = 'Week-end de rentrée';
