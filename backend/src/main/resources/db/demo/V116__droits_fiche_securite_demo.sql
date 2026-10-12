-- Démonstration des droits sur la fiche de sécurité (V71).
-- Le moniteur E2 reçoit le droit d'établir les fiches (il n'est pas E3) ;
-- l'E1 ne l'a pas : il ne fait que les compléter au retour de plongée.
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'FICHE_SECURITE' FROM utilisateur WHERE email = 'e2@club.fr';

-- Une sécurité surface qui n'est pas moniteur du club (nom fictif).
INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, actif, niveau_encadrement, numero_licence) VALUES
 ('surface@club.fr', '$2b$12$FGDfdvlN7Zp7s8NgnbHZJu1lSXeSgRq9hUKJJi/L9.wGBumRTK.Xa', 'Lemaire', 'Yann', TRUE, NULL, NULL);
INSERT INTO utilisateur_role (utilisateur_id, role)
SELECT id, 'SECURITE_SURFACE' FROM utilisateur WHERE email = 'surface@club.fr';
