-- Démonstration du rôle TIV (V35) : le moniteur E2 inspecte les blocs du club.
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'TIV' FROM utilisateur WHERE email = 'e2@club.fr';
