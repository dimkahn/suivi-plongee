-- Demonstration (profil dev) : niveaux de plongeur des encadrants fictifs.
-- Tiago (E1) n'est que N2, pour illustrer l'ecart possible avec l'encadrement.
UPDATE utilisateur SET niveau_plongeur = 'N5' WHERE email = 'presidente@club.fr';
UPDATE utilisateur SET niveau_plongeur = 'N4' WHERE email IN ('e3@club.fr', 'e2@club.fr');
UPDATE utilisateur SET niveau_plongeur = 'N2' WHERE email = 'e1@club.fr';
