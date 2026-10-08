-- ============================================================
--  Base d'exercices : un exercice travaille un ou plusieurs
--  critères de sa compétence (« 1.7 Gréage avec anomalie cachée » →
--  « Gréage et dégréage »), pas la compétence entière. L'exercice
--  noté se choisit critère par critère, et seul un exercice de
--  maîtrise relié au critère le fait passer à acquis.
--
--  Rattachement initial du N1 PE20 (V51) d'après le contenu de
--  chaque exercice ; ensuite il se modifie depuis /admin/exercices.
--  Les critères sont désignés par (ordre du bloc, ordre du critère)
--  dans V7 ; les exercices par leur numéro du document du club.
-- ============================================================

CREATE TABLE exercice_competence_critere (
    exercice_id  BIGINT NOT NULL REFERENCES exercice_competence(id) ON DELETE CASCADE,
    critere_id   BIGINT NOT NULL REFERENCES critere(id) ON DELETE CASCADE,
    PRIMARY KEY (exercice_id, critere_id)
);

CREATE INDEX ix_exercice_competence_critere_critere ON exercice_competence_critere(critere_id);

INSERT INTO exercice_competence_critere (exercice_id, critere_id)
SELECT e.id, c.id
  FROM exercice_competence e
  JOIN bloc_competence b ON b.id = e.bloc_id
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN critere c ON c.bloc_id = b.id
  JOIN (VALUES
    -- S'équiper : 1 gréage et dégréage, 2 capelage et décapelage, 3 matériel personnel
    ('1.1', 1), ('1.2', 2), ('1.3', 1), ('1.4', 3), ('1.5', 2), ('1.6', 1), ('1.6', 2),
    ('1.7', 1), ('1.8', 2), ('1.9', 3),
    -- Mise à l'eau : 1 saut droit, 2 bascule arrière, 3 départ plage, 4 sortir de l'eau
    ('2.1', 1), ('2.1', 2), ('2.2', 1), ('2.3', 2), ('2.4', 1), ('2.4', 2), ('2.5', 3), ('2.6', 4),
    ('2.7', 1), ('2.7', 2), ('2.8', 1), ('2.8', 2), ('2.9', 4),
    -- S'immerger : 1 canard, 2 phoque
    ('3.1', 1), ('3.1', 2), ('3.2', 2), ('3.3', 1), ('3.4', 1), ('3.5', 2), ('3.6', 1), ('3.6', 2),
    ('3.7', 1), ('3.7', 2), ('3.8', 1), ('3.8', 2), ('3.9', 1), ('3.9', 2),
    -- Se propulser : 1 ventral, 2 dorsal, 3 sustentation, 4 immersion, 5 capelé
    ('4.1', 1), ('4.1', 2), ('4.2', 1), ('4.2', 2), ('4.3', 3), ('4.4', 1), ('4.4', 2), ('4.5', 5),
    ('4.6', 4), ('4.7', 1), ('4.7', 2), ('4.7', 3), ('4.8', 5), ('4.9', 4),
    -- Se ventiler : 1 en immersion, 2 tuba, 3 masque, 4 lâcher et reprise d'embout
    ('5.1', 2), ('5.2', 1), ('5.3', 3), ('5.4', 3), ('5.5', 4), ('5.6', 1),
    ('5.7', 3), ('5.7', 4), ('5.8', 1), ('5.9', 1), ('5.9', 3), ('5.9', 4),
    -- S'équilibrer : 1 gilet, 2 poumon ballast
    ('6.1', 1), ('6.1', 2), ('6.2', 2), ('6.3', 1), ('6.4', 1), ('6.5', 2), ('6.6', 1),
    ('6.7', 1), ('6.7', 2), ('6.8', 1), ('6.8', 2), ('6.9', 1),
    -- Milieu et environnement : 1 aisance aquatique
    ('7.1', 1), ('7.2', 1), ('7.3', 1), ('7.4', 1), ('7.5', 1), ('7.6', 1), ('7.7', 1), ('7.8', 1), ('7.9', 1),
    -- Communiquer : 1 signes conventionnels
    ('8.1', 1), ('8.2', 1), ('8.3', 1), ('8.4', 1), ('8.5', 1), ('8.6', 1), ('8.7', 1), ('8.8', 1), ('8.9', 1),
    -- Retourner en surface (« 9 » du document) : 1 vitesse, 2 palier, 3 tour d'horizon,
    -- 4 gonflage du gilet, 5 REC
    ('9.1', 1), ('9.1', 5), ('9.2', 1), ('9.3', 3), ('9.3', 4), ('9.4', 1), ('9.5', 2), ('9.6', 5),
    ('9.7', 5), ('9.7', 3), ('9.8', 1), ('9.8', 2), ('9.8', 3), ('9.8', 4), ('9.9', 1), ('9.9', 3), ('9.9', 4),
    -- Évoluer en sécurité (« 10 » du document) : 1 procédures du GP, 2 intervention en relais
    ('10.1', 1), ('10.2', 1), ('10.3', 1), ('10.4', 1), ('10.5', 2), ('10.6', 1),
    ('10.7', 1), ('10.8', 1), ('10.9', 2)
  ) AS v(numero, critere_ordre)
    ON v.numero = e.numero AND v.critere_ordre = c.ordre
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)';
