-- ============================================================
--  Séjour (V75), suite : un participant peut être un plongeur d'un
--  groupe de plongeurs (V13).
--
--  Les deux fiches restent séparées (le participant porte son voyage,
--  ses repas, la personne à prévenir ; le membre du groupe son aptitude
--  et sa qualification préparée), mais elles sont liées : nom, prénom et
--  e-mail modifiés d'un côté sont reportés de l'autre (SejourService,
--  GroupePlongeursService). Un accompagnant qui ne plonge pas n'a pas de
--  lien.
--
--  Le membre retiré de son groupe (ou le groupe supprimé) laisse le
--  participant tel quel, sans lien. Un même plongeur n'est lié qu'à un
--  participant par séjour.
-- ============================================================

ALTER TABLE sejour_participant ADD COLUMN membre_groupe_id BIGINT
    REFERENCES membre_groupe_plongeurs(id) ON DELETE SET NULL;
ALTER TABLE sejour_participant ADD CONSTRAINT uk_sejour_participant_membre_groupe
    UNIQUE (sortie_id, membre_groupe_id);
CREATE INDEX idx_sejour_participant_membre_groupe ON sejour_participant (membre_groupe_id);
