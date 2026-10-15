-- Demonstration (profil dev) : le sejour a Port-Cros (V117, saisi en SQL,
-- donc sans historique) a ete cree par Gwendoline, directrice technique
-- (e3@club.fr) : elle seule le modifie (V80). Pas d'organisateur designe :
-- Flora (e2@club.fr) y reste une simple participante (video M25), la
-- presidente un administrateur qui le lit.
UPDATE sejour SET createur_id = (SELECT id FROM utilisateur WHERE email = 'e3@club.fr')
 WHERE sortie_id = (SELECT id FROM sortie WHERE nom = 'Séjour à Port-Cros');
