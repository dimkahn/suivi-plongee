-- Demonstration (profil dev) : les plongees du sejour a Port-Cros (V117) et
-- la fiche de securite de la premiere, pour que le programme du sejour
-- montre la palanquee de chacun et sa fonction (video E2).
-- Vendredi 4 juin 2027 au matin, la Gabinière : Gwendoline (e3@club.fr) est
-- DP. Palanquee 1 : Flora (E2, encadrante) avec Camille et le 3e eleve du
-- sejour (N1, preparent le N2). Palanquee 2 : Sonia (N2, prepare le N3)
-- avec un guide de palanquee du centre, invite (noms fictifs).
INSERT INTO seance (saison_id, date_seance, milieu, lieu, site, profondeur_max, ordre, commentaire)
SELECT sa.id, v.jour, 'NATUREL', 'Port-Cros', v.site, 20, 1, NULL
  FROM saison sa
  JOIN (VALUES (DATE '2027-06-04', 'La Gabinière'), (DATE '2027-06-05', 'Le Rascas')) AS v(jour, site) ON TRUE
 WHERE sa.libelle = '2026-2027';

INSERT INTO sortie_seance (sortie_id, seance_id)
SELECT so.id, se.id
  FROM sortie so, seance se
 WHERE so.nom = 'Séjour à Port-Cros' AND se.lieu = 'Port-Cros'
   AND se.date_seance BETWEEN DATE '2027-06-04' AND DATE '2027-06-05';

INSERT INTO fiche_securite (seance_id, dp_id, meteo, etat_mer, securite_surface, plan_secours)
SELECT se.id, u.id, 'Ensoleillé', 'Belle', 'Le pilote du bateau, VHF canal 16',
       'Oxygène et DAE à bord ; CROSS Med (196), caisson de Sainte-Anne à Toulon'
  FROM seance se, utilisateur u
 WHERE se.date_seance = DATE '2027-06-04' AND se.lieu = 'Port-Cros' AND u.email = 'e3@club.fr';

INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue)
SELECT f.id, v.numero, v.profondeur, v.duree
  FROM fiche_securite f
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2027-06-04' AND se.lieu = 'Port-Cros'
  JOIN (VALUES (1, 20, 40), (2, 20, 45)) AS v(numero, profondeur, duree) ON TRUE;

INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, m.aptitude, m.preparee, 'PLONGEUR'
  FROM (VALUES (1, 'A-01-000010', 'N1', 'N2'), (1, 'A-01-000013', 'N1', 'N2'), (2, 'A-01-000012', 'N2', 'N3'))
       AS m(numero, licence, aptitude, preparee)
  JOIN eleve e ON e.numero_licence = m.licence
  JOIN palanquee p ON p.numero = m.numero
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2027-06-04' AND se.lieu = 'Port-Cros';

INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, 'E2', 'ENCADRANT'
  FROM utilisateur u
  JOIN palanquee p ON p.numero = 1
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2027-06-04' AND se.lieu = 'Port-Cros'
 WHERE u.email = 'e2@club.fr';

INSERT INTO membre_palanquee (palanquee_id, nom, prenom, aptitude, fonction)
SELECT p.id, 'Lemoine', 'Marc', 'N4', 'GUIDE_PALANQUEE'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2027-06-04' AND se.lieu = 'Port-Cros'
 WHERE p.numero = 2;
