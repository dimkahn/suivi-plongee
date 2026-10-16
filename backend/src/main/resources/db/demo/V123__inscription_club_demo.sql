-- Demonstration (profil dev) : inscriptions au club (V86) de la saison
-- en cours. Camille et Sonia sont a jour (OK, vert), Anis et Mateo non
-- (KO, rouge), pour montrer les deux pastilles de l'administration des eleves.
INSERT INTO inscription_club (eleve_id, saison_id, saisi_par_id)
SELECT e.id, s.id, u.id
  FROM eleve e, saison s, utilisateur u
 WHERE e.numero_licence IN ('A-01-000010', 'A-01-000012')
   AND s.ouverte = TRUE
   AND u.email = 'presidente@club.fr';
