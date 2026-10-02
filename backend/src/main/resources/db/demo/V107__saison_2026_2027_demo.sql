-- ============================================================
--  Demonstration (profil dev uniquement) : la saison 2026-2027
--  devient la saison courante.
--
--  V100 a V106 decrivent la saison 2025-2026, desormais passee : elles
--  restent telles quelles (on n'edite pas une migration deja appliquee)
--  et servent d'historique. Cette migration :
--   - clot 2025-2026 avec des issues plausibles (Mateo obtient son N2,
--     Anis et Sonia poursuivent leur formation sur la saison suivante) ;
--   - ouvre 2026-2027 (seances reelles du club, V11), y inscrit les
--     eleves de V100 et quatre nouveaux, compose les groupes
--     d'entrainement, saisit les presences et quelques notes de la
--     rentree, un week-end en milieu naturel et le planning des
--     prochaines soirees.
--
--  Dates fixes pour la rentree (septembre 2026), comme un vrai debut de
--  saison ; le planning (prochaine soiree, reponses des encadrants) est
--  calcule par rapport au jour du lancement, pour toujours montrer une
--  soiree a venir. Noms fictifs, aucune donnee reelle.
-- ============================================================

-- ------------------------------------------------------------
--  Fin de la saison 2025-2026
-- ------------------------------------------------------------

-- Mateo obtient son N2 en juin, a l'issue des validations en milieu naturel.
UPDATE cursus SET statut = 'DELIVRE'
 WHERE id = (SELECT c.id FROM cursus c
               JOIN eleve e ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000013'
               JOIN saison s ON s.id = c.saison_id AND s.libelle = '2025-2026');

INSERT INTO delivrance (cursus_id, delivre_par_id, date_delivrance, numero_brevet)
SELECT c.id, u.id, DATE '2026-06-14', 'FFESSM-2026-0387'
  FROM cursus c
  JOIN eleve e ON e.id = c.eleve_id AND e.numero_licence = 'A-01-000013'
  JOIN saison s ON s.id = c.saison_id AND s.libelle = '2025-2026'
  JOIN utilisateur u ON u.email = 'presidente@club.fr';

INSERT INTO qualification (eleve_id, type, date_obtention)
SELECT id, 'N2', DATE '2026-06-14' FROM eleve WHERE numero_licence = 'A-01-000013';

-- Anis (N1) et Sonia (N3) n'ont pas termine : formation suspendue sur
-- 2025-2026, reprise sur 2026-2027 (suggestion d'inscription du serveur).
UPDATE cursus SET statut = 'SUSPENDU'
 WHERE statut = 'EN_COURS'
   AND saison_id = (SELECT id FROM saison WHERE libelle = '2025-2026');

UPDATE saison SET ouverte = FALSE WHERE libelle = '2025-2026';
UPDATE saison SET ouverte = TRUE  WHERE libelle = '2026-2027';

INSERT INTO progression_saison (saison_id, progression_id)
SELECT s.id, p.id
  FROM saison s, progression_type p
 WHERE s.libelle = '2026-2027';

-- ------------------------------------------------------------
--  Eleves : certificats renouveles, quatre nouveaux debutants
-- ------------------------------------------------------------

UPDATE eleve SET certificat_valide_jusqu_au = DATE '2027-09-15' WHERE numero_licence = 'A-01-000010';
UPDATE eleve SET certificat_valide_jusqu_au = DATE '2027-09-02' WHERE numero_licence = 'A-01-000011';
UPDATE eleve SET certificat_valide_jusqu_au = DATE '2027-10-05' WHERE numero_licence = 'A-01-000012';
UPDATE eleve SET certificat_valide_jusqu_au = DATE '2027-08-28' WHERE numero_licence = 'A-01-000013';

-- Lea est mineure : l'autorisation legale couvre la pratique, pas l'image.
INSERT INTO eleve (nom, prenom, date_naissance, numero_licence, certificat_valide_jusqu_au, autorisation_legale,
                   telephone, contact_urgence_nom, contact_urgence_telephone, taille_gilet, taille_combinaison) VALUES
 ('Morel',   'Léa',   DATE '2010-05-14', 'A-01-000014', DATE '2027-09-10', TRUE,
  '06 00 00 00 11', 'Julie Morel (mère)', '06 00 00 00 12', 'S', '12 ans'),
 ('Roux',    'Yanis', DATE '1998-01-22', 'A-01-000015', DATE '2027-09-05', FALSE,
  '06 00 00 00 21', 'Inès Roux', '06 00 00 00 22', 'L', '4'),
 ('Garnier', 'Chloé', DATE '1985-09-03', 'A-01-000016', DATE '2027-09-01', FALSE,
  '06 00 00 00 31', NULL, NULL, 'M', '2'),
 ('Lemaire', 'Hugo',  DATE '2003-12-30', 'A-01-000017', NULL, FALSE,
  '06 00 00 00 41', 'Paul Lemaire', '06 00 00 00 42', 'M', '3');

-- Le CACI de Hugo arrive a echeance dans douze jours : alerte dans Infos eleves.
UPDATE eleve SET certificat_valide_jusqu_au = DATEADD('DAY', 12, CURRENT_DATE) WHERE numero_licence = 'A-01-000017';

-- ------------------------------------------------------------
--  Groupes d'entrainement 2026-2027 : ceux de 2025-2026, sans « Perfect N1 »
--  (aucun eleve concerne cette saison)
-- ------------------------------------------------------------

INSERT INTO groupe_entrainement (saison_id, nom, ordre, niveau_prepare, espace_attitre_id)
SELECT s.id, g.nom, g.ordre, g.niveau, e.id
  FROM saison s
  JOIN (VALUES ('Débutants', 1, 'N1', 'Ligne 6'),
               ('Prépa N2',  2, 'N2', 'Ligne 3'),
               ('N2+',       3, NULL, 'Ligne 2'),
               ('Prépa N3',  4, 'N3', 'Ligne 4')) AS g(nom, ordre, niveau, ligne) ON TRUE
  JOIN espace_bassin e ON e.nom = g.ligne
 WHERE s.libelle = '2026-2027';

INSERT INTO groupe_entrainement_encadrant (groupe_id, utilisateur_id)
SELECT g.id, u.id
  FROM groupe_entrainement g
  JOIN saison s ON s.id = g.saison_id AND s.libelle = '2026-2027'
  JOIN (VALUES ('Débutants', 'e1@club.fr'), ('Débutants', 'e2@club.fr'),
               ('Prépa N2', 'e3@club.fr'), ('N2+', 'e3@club.fr'),
               ('Prépa N3', 'presidente@club.fr')) AS a(groupe, email)
    ON a.groupe = g.nom
  JOIN utilisateur u ON u.email = a.email;

-- ------------------------------------------------------------
--  Inscriptions 2026-2027, figees sur le referentiel actif
-- ------------------------------------------------------------

INSERT INTO cursus (eleve_id, saison_id, referentiel_id, statut, ouvert_le)
SELECT e.id, s.id, r.id, 'EN_COURS', DATE '2026-09-07'
  FROM (VALUES ('A-01-000011', 'N1'),          -- Anis reprend son N1
               ('A-01-000014', 'N1'),          -- Lea
               ('A-01-000015', 'N1'),          -- Yanis
               ('A-01-000016', 'N1'),          -- Chloe
               ('A-01-000017', 'N1'),          -- Hugo
               ('A-01-000010', 'N2'),          -- Camille, N1 l'an dernier
               ('A-01-000012', 'N3')           -- Sonia poursuit son N3
       ) AS i(licence, niveau)
  JOIN eleve e ON e.numero_licence = i.licence
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN referentiel r ON r.niveau = i.niveau AND r.actif = TRUE;

-- Mateo, N2 tout neuf, continue de plonger avec le club sans viser de
-- nouveau niveau cette saison : adhesion seule, sans cursus.
INSERT INTO adhesion_saison (eleve_id, saison_id, adhere_le)
SELECT e.id, s.id, DATE '2026-09-07'
  FROM eleve e, saison s
 WHERE e.numero_licence = 'A-01-000013' AND s.libelle = '2026-2027';

INSERT INTO groupe_entrainement_eleve (groupe_id, eleve_id)
SELECT g.id, e.id
  FROM (VALUES ('A-01-000011', 'Débutants'), ('A-01-000014', 'Débutants'), ('A-01-000015', 'Débutants'),
               ('A-01-000016', 'Débutants'), ('A-01-000017', 'Débutants'),
               ('A-01-000010', 'Prépa N2'), ('A-01-000013', 'N2+'), ('A-01-000012', 'Prépa N3')
       ) AS r(licence, groupe)
  JOIN eleve e ON e.numero_licence = r.licence
  JOIN groupe_entrainement g ON g.nom = r.groupe
  JOIN saison s ON s.id = g.saison_id AND s.libelle = '2026-2027';

-- ------------------------------------------------------------
--  Presences de la rentree : les lundis 7, 14 et 21 septembre.
--  Celles du lundi 28 restent a faire (feuille de presence vide).
-- ------------------------------------------------------------

-- Debutants en piscine, preparations N2/N3 en fosse ; un absent de temps en temps.
INSERT INTO participation (cursus_id, seance_id, statut, atelier)
SELECT c.id, se.id, 'PRESENT', p.atelier
  FROM (VALUES
        ('A-01-000011', DATE '2026-09-07', 'Piscine', 'NAGE'),
        ('A-01-000014', DATE '2026-09-07', 'Piscine', 'NAGE'),
        ('A-01-000015', DATE '2026-09-07', 'Piscine', 'NAGE'),
        ('A-01-000016', DATE '2026-09-07', 'Piscine', 'NAGE'),
        ('A-01-000011', DATE '2026-09-14', 'Piscine', 'BLOC'),
        ('A-01-000014', DATE '2026-09-14', 'Piscine', 'BLOC'),
        ('A-01-000015', DATE '2026-09-14', 'Piscine', 'BLOC'),
        ('A-01-000017', DATE '2026-09-14', 'Piscine', 'NAGE'),
        ('A-01-000011', DATE '2026-09-21', 'Piscine', 'BLOC'),
        ('A-01-000015', DATE '2026-09-21', 'Piscine', 'BLOC'),
        ('A-01-000016', DATE '2026-09-21', 'Piscine', 'BLOC'),
        ('A-01-000017', DATE '2026-09-21', 'Piscine', 'THEORIE'),
        ('A-01-000010', DATE '2026-09-07', 'Fosse',   'BLOC'),
        ('A-01-000012', DATE '2026-09-07', 'Fosse',   'BLOC'),
        ('A-01-000010', DATE '2026-09-14', 'Fosse',   'BLOC'),
        ('A-01-000010', DATE '2026-09-21', 'Fosse',   'NAGE'),
        ('A-01-000012', DATE '2026-09-21', 'Fosse',   'BLOC')
       ) AS p(licence, jour, lieu, atelier)
  JOIN eleve e ON e.numero_licence = p.licence
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN seance se ON se.saison_id = s.id AND se.date_seance = p.jour AND se.lieu = p.lieu;

-- ------------------------------------------------------------
--  Premieres notes N1, par Tiago (E1) et Flora (E2) au bord du bassin.
--  Ordre d'insertion = ordre de saisie : l'etat courant d'un critere est
--  sa derniere ligne.
-- ------------------------------------------------------------

INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation, commentaire)
SELECT c.id, cr.id, se.id, u.id, n.statut, n.jour, n.commentaire
  FROM (VALUES
        -- Anis : deux criteres sur trois du bloc « S'equiper », le vidage de masque a reprendre.
        ('A-01-000011', 'Gréage et dégréage',          DATE '2026-09-14', 'e1@club.fr', 'EN_COURS', CAST(NULL AS VARCHAR(200))),
        ('A-01-000011', 'Gréage et dégréage',          DATE '2026-09-21', 'e1@club.fr', 'ACQUIS',   NULL),
        ('A-01-000011', 'Capelage et décapelage',      DATE '2026-09-21', 'e1@club.fr', 'ACQUIS',   NULL),
        ('A-01-000011', 'Palmage ventral en surface',  DATE '2026-09-21', 'e1@club.fr', 'ACQUIS',   NULL),
        ('A-01-000011', 'Palmage dorsal',              DATE '2026-09-21', 'e1@club.fr', 'EN_COURS', NULL),
        ('A-01-000011', 'Vidage du masque',            DATE '2026-09-21', 'e1@club.fr', 'EN_COURS',
         'Vide son masque mais remonte la tête : à reprendre à genoux au fond.'),
        -- Lea, Yanis, Chloe : les premiers gestes.
        ('A-01-000014', 'Gréage et dégréage',          DATE '2026-09-14', 'e2@club.fr', 'ACQUIS',   NULL),
        ('A-01-000014', 'Palmage ventral en surface',  DATE '2026-09-14', 'e2@club.fr', 'EN_COURS', NULL),
        ('A-01-000014', 'Ventilation sur tuba et vidage du tuba', DATE '2026-09-14', 'e2@club.fr', 'ACQUIS', NULL),
        ('A-01-000015', 'Gréage et dégréage',          DATE '2026-09-21', 'e1@club.fr', 'ACQUIS',   NULL),
        ('A-01-000015', 'Palmage ventral en surface',  DATE '2026-09-21', 'e1@club.fr', 'EN_COURS', NULL),
        ('A-01-000016', 'Gréage et dégréage',          DATE '2026-09-21', 'e1@club.fr', 'ACQUIS',   NULL),
        ('A-01-000016', 'Palmage ventral en surface',  DATE '2026-09-21', 'e1@club.fr', 'EN_COURS',
         'Bonne aisance, garde la tête trop haute.')
       ) AS n(licence, savoir_faire, jour, moniteur, statut, commentaire)
  JOIN eleve e ON e.numero_licence = n.licence
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN bloc_competence b ON b.referentiel_id = c.referentiel_id
  JOIN critere cr ON cr.bloc_id = b.id AND cr.savoir_faire = n.savoir_faire
  JOIN seance se ON se.saison_id = s.id AND se.date_seance = n.jour AND se.lieu = 'Piscine'
  JOIN utilisateur u ON u.email = n.moniteur;

-- ------------------------------------------------------------
--  Week-end de rentree en milieu naturel : Gravière du Fort, 26-27/09.
--  Les competences N2 et N3 ne s'obtiennent qu'en milieu naturel.
-- ------------------------------------------------------------

INSERT INTO seance (saison_id, date_seance, milieu, lieu, site, profondeur_max)
SELECT s.id, v.jour, 'NATUREL', 'Gravière du Fort', v.site, v.profondeur
  FROM saison s
  JOIN (VALUES (DATE '2026-09-26', 'La Barge', 20),
               (DATE '2026-09-27', 'Le Tombant', 30)) AS v(jour, site, profondeur) ON TRUE
 WHERE s.libelle = '2026-2027';

INSERT INTO sortie (nom, lieu, date_debut, date_fin, remarques)
VALUES ('Week-end de rentrée', 'Gravière du Fort', DATE '2026-09-26', DATE '2026-09-27',
        'Rendez-vous au club le samedi à 7 h 30, covoiturage.');

INSERT INTO sortie_seance (sortie_id, seance_id)
SELECT so.id, se.id
  FROM sortie so
  JOIN seance se ON se.lieu = 'Gravière du Fort'
 WHERE so.nom = 'Week-end de rentrée';

INSERT INTO participation (cursus_id, seance_id, statut, atelier)
SELECT c.id, se.id, 'PRESENT', 'PLONGEE'
  FROM (VALUES ('A-01-000010', DATE '2026-09-26'), ('A-01-000010', DATE '2026-09-27'),
               ('A-01-000012', DATE '2026-09-26'), ('A-01-000012', DATE '2026-09-27')) AS p(licence, jour)
  JOIN eleve e ON e.numero_licence = p.licence
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN seance se ON se.date_seance = p.jour AND se.lieu = 'Gravière du Fort';

-- Camille (N2) notee par Gwendoline (E3), Sonia (N3) par Claire (E4) :
-- les deux premiers criteres du premier bloc de chacun.
INSERT INTO evaluation (cursus_id, critere_id, seance_id, moniteur_id, statut, date_evaluation)
SELECT c.id, cr.id, se.id, u.id, n.statut, n.jour
  FROM (VALUES ('A-01-000010', 1, DATE '2026-09-26', 'e3@club.fr', 'ACQUIS'),
               ('A-01-000010', 2, DATE '2026-09-26', 'e3@club.fr', 'EN_COURS'),
               ('A-01-000012', 1, DATE '2026-09-27', 'presidente@club.fr', 'ACQUIS'),
               ('A-01-000012', 2, DATE '2026-09-27', 'presidente@club.fr', 'ACQUIS')
       ) AS n(licence, critere_ordre, jour, moniteur, statut)
  JOIN eleve e ON e.numero_licence = n.licence
  JOIN saison s ON s.libelle = '2026-2027'
  JOIN cursus c ON c.eleve_id = e.id AND c.saison_id = s.id
  JOIN bloc_competence b ON b.referentiel_id = c.referentiel_id
       AND b.ordre = (SELECT MIN(b2.ordre) FROM bloc_competence b2 WHERE b2.referentiel_id = c.referentiel_id)
  JOIN critere cr ON cr.bloc_id = b.id AND cr.ordre = n.critere_ordre
  JOIN seance se ON se.date_seance = n.jour AND se.lieu = 'Gravière du Fort'
  JOIN utilisateur u ON u.email = n.moniteur;

-- Fiche de securite du samedi, completee apres la plongee.
INSERT INTO fiche_securite (seance_id, dp_id, meteo, etat_mer, visibilite, courant, maree, temperature_eau,
                             securite_surface, plan_secours)
SELECT se.id, u.id, 'Ensoleillé, vent faible', 'Plan d''eau calme', '5 m', 'Nul', NULL, '17 degrés',
       'Un surveillant de sécurité surface avec bouée torpille, VHF canal 16 en secours',
       'Numéro du SAMU (15) affiché au point de rassemblement ; DAE dans le véhicule du club'
  FROM seance se, utilisateur u
 WHERE se.date_seance = DATE '2026-09-26' AND se.lieu = 'Gravière du Fort' AND u.email = 'e3@club.fr';

INSERT INTO palanquee (fiche_securite_id, numero, profondeur_prevue, duree_prevue,
                        profondeur_realisee, duree_realisee, paliers, heure_immersion, heure_sortie)
SELECT f.id, 1, 20, 35, 19, 34, '3 min à 3 m', TIME '10:15', TIME '10:49'
  FROM fiche_securite f JOIN seance se ON se.id = f.seance_id
 WHERE se.date_seance = DATE '2026-09-26' AND se.lieu = 'Gravière du Fort';

INSERT INTO membre_palanquee (palanquee_id, eleve_id, nom, prenom, aptitude, qualification_preparee, fonction)
SELECT p.id, e.id, e.nom, e.prenom, m.aptitude, m.preparee, 'PLONGEUR'
  FROM (VALUES ('A-01-000010', 'N1', 'N2'), ('A-01-000012', 'N2', 'N3')) AS m(licence, aptitude, preparee)
  JOIN eleve e ON e.numero_licence = m.licence
  JOIN palanquee p ON p.numero = 1
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2026-09-26' AND se.lieu = 'Gravière du Fort';

INSERT INTO membre_palanquee (palanquee_id, utilisateur_id, nom, prenom, aptitude, fonction)
SELECT p.id, u.id, u.nom, u.prenom, 'E3', 'ENCADRANT'
  FROM palanquee p
  JOIN fiche_securite f ON f.id = p.fiche_securite_id
  JOIN seance se ON se.id = f.seance_id AND se.date_seance = DATE '2026-09-26' AND se.lieu = 'Gravière du Fort'
  JOIN utilisateur u ON u.email = 'e3@club.fr'
 WHERE p.numero = 1;

-- ------------------------------------------------------------
--  Planning du bassin
-- ------------------------------------------------------------

-- Responsables des soirees de la rentree deja passees.
INSERT INTO soiree_planning (saison_id, date_soiree, responsable_id, note)
SELECT s.id, v.jour, u.id, v.note
  FROM saison s
  JOIN (VALUES (DATE '2026-09-07', 'e3@club.fr', 'Soirée de rentrée : accueil des nouveaux à 20 h.'),
               (DATE '2026-09-14', 'presidente@club.fr', CAST(NULL AS VARCHAR(200))),
               (DATE '2026-09-21', 'e3@club.fr', NULL)) AS v(jour, email, note) ON TRUE
  JOIN utilisateur u ON u.email = v.email
 WHERE s.libelle = '2026-2027';

-- Prochaine soiree (calculee au lancement) : responsable, note, les
-- debutants en fosse limitee a 6 m (le « F6 » du tableur) et les reponses
-- de trois encadrants sur quatre. Flora (e2) n'a pas encore repondu.
INSERT INTO soiree_planning (saison_id, date_soiree, responsable_id, note)
SELECT s.id, MIN(se.date_seance), u.id, 'Baptêmes à 20 h 30 dans la fosse.'
  FROM saison s
  JOIN seance se ON se.saison_id = s.id AND se.date_seance >= CURRENT_DATE AND se.milieu = 'ARTIFICIEL'
  JOIN utilisateur u ON u.email = 'e3@club.fr'
 WHERE s.libelle = '2026-2027'
 GROUP BY s.id, u.id;

INSERT INTO affectation_groupe (groupe_id, date_soiree, type, espace_id, profondeur_limitee)
SELECT g.id, sp.date_soiree, 'ESPACE', eb.id, 6
  FROM soiree_planning sp
  JOIN saison s ON s.id = sp.saison_id AND s.libelle = '2026-2027'
  JOIN groupe_entrainement g ON g.saison_id = s.id AND g.nom = 'Débutants'
  JOIN espace_bassin eb ON eb.type = 'FOSSE'
 WHERE sp.date_soiree >= CURRENT_DATE;

INSERT INTO disponibilite_encadrant (saison_id, date_soiree, utilisateur_id, reponse, saisi_par_id)
SELECT sp.saison_id, sp.date_soiree, u.id, r.reponse, CASE WHEN r.par_admin THEN a.id ELSE u.id END
  FROM soiree_planning sp
  JOIN saison s ON s.id = sp.saison_id AND s.libelle = '2026-2027'
  JOIN (VALUES ('e1@club.fr', 'PRESENT', FALSE),
               ('e3@club.fr', 'PRESENT', FALSE),
               ('presidente@club.fr', 'ABSENT', TRUE)) AS r(email, reponse, par_admin) ON TRUE
  JOIN utilisateur u ON u.email = r.email
  JOIN utilisateur a ON a.email = 'presidente@club.fr'
 WHERE sp.date_soiree >= CURRENT_DATE;
