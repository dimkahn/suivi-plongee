-- Démonstration (profil dev) : un directeur technique qui n'est pas moniteur
-- du club (choix du club, 2026-11-10), nom fictif. Rôle DIRECTEUR_TECHNIQUE
-- seul : il ne gère que le matériel, les prêts et les sorties. Mot de passe
-- de démonstration habituel.
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, actif, niveau_encadrement, numero_licence) VALUES
 ('materiel@club.fr', '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Morvan', 'Bastien', TRUE, NULL, NULL);
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'DIRECTEUR_TECHNIQUE' FROM utilisateur WHERE email = 'materiel@club.fr';
