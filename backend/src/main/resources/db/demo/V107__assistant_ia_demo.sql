-- Demonstration (profil dev) : la presidente, administratrice, a le role IA.
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'IA' FROM utilisateur WHERE email = 'presidente@club.fr';
