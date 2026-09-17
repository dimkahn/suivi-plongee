-- ============================================================
--  Calendrier réel des séances du club pour la saison 2026-2027.
--
--  Le lundi, deux séances ont lieu en même temps : une en piscine (2 m)
--  et une en fosse (10 m). Le mercredi, une seule séance en fosse (10 m).
--  Les deux sont en milieu ARTIFICIEL (piscine et fosse, pas de milieu
--  naturel dans ce calendrier).
--
--  Calendrier construit sur le rythme scolaire de la zone C (académies
--  Créteil, Montpellier, Paris, Toulouse, Versailles) pour 2026-2027 :
--  aucune séance pendant les vacances de la Toussaint (17/10 au 02/11),
--  de Noël (19/12 au 04/01), d'Hiver (06/02 au 22/02) et de Printemps
--  (03/04 au 19/04). Retirés aussi trois jours fériés isolés qui tombent
--  un lundi ou un mercredi en période scolaire (le pont de l'Ascension,
--  lui, ne tombe ni un lundi ni un mercredi) : le 11 novembre 2026
--  (mercredi), le lundi de Pâques (29 mars 2027) et le lundi de
--  Pentecôte (17 mai 2027) — a priori la piscine/fosse est aussi fermée
--  ces jours-là, à corriger via l'écran Séances si ce n'est pas le cas.
--  Saison bornée à la rentrée scolaire (01/09/2026) et à la fin d'année
--  scolaire (30/06/2027) ; à ajuster si le club a un calendrier propre.
--
--  Créée fermée (ouverte = FALSE) : l'ouverture d'une saison est un geste
--  ADMIN explicite (PUT /api/saisons/{id}/ouverture, écran /admin/saisons),
--  jamais une décision prise par une migration. Ne pas mettre TRUE ici :
--  en développement, la saison de démonstration (V100, 2025-2026) doit
--  rester la saison "courante" par défaut pour les tests.
-- ============================================================

INSERT INTO saison (libelle, date_debut, date_fin, ouverte)
VALUES ('2026-2027', DATE '2026-09-01', DATE '2027-06-30', FALSE);

INSERT INTO seance (saison_id, date_seance, milieu, lieu, profondeur_max)
SELECT s.id, v.date_seance, v.milieu, v.lieu, v.profondeur_max
  FROM saison s
  CROSS JOIN (VALUES
  (DATE '2026-09-02', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-07', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-09-07', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-09', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-14', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-09-14', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-16', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-21', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-09-21', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-23', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-28', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-09-28', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-09-30', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-10-05', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-10-05', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-10-07', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-10-12', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-10-12', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-10-14', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-02', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-11-02', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-04', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-09', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-11-09', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-16', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-11-16', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-18', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-23', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-11-23', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-25', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-11-30', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-11-30', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-12-02', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-12-07', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-12-07', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-12-09', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-12-14', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2026-12-14', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2026-12-16', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-04', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-01-04', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-06', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-11', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-01-11', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-13', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-18', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-01-18', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-20', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-25', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-01-25', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-01-27', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-02-01', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-02-01', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-02-03', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-02-22', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-02-22', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-02-24', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-01', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-03-01', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-03', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-08', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-03-08', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-10', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-15', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-03-15', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-17', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-22', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-03-22', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-24', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-03-31', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-04-19', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-04-19', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-04-21', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-04-26', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-04-26', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-04-28', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-03', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-05-03', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-05', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-10', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-05-10', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-12', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-19', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-24', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-05-24', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-26', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-05-31', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-05-31', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-02', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-07', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-06-07', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-09', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-14', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-06-14', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-16', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-21', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-06-21', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-23', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-28', 'ARTIFICIEL', 'Piscine', 2),
  (DATE '2027-06-28', 'ARTIFICIEL', 'Fosse', 10),
  (DATE '2027-06-30', 'ARTIFICIEL', 'Fosse', 10)
  ) AS v(date_seance, milieu, lieu, profondeur_max)
 WHERE s.libelle = '2026-2027';
