-- Séjour : le club peut avancer des frais (bateau, gîte réservé par le
-- club...). Une dépense sans payeur est payée par le club ; un
-- remboursement sans « de » vient du club, sans « à » va au club. Les
-- participants lui doivent leur part comme à l'un d'eux (FraisSejour).
ALTER TABLE sejour_depense ALTER COLUMN payeur_id DROP NOT NULL;
ALTER TABLE sejour_versement ALTER COLUMN de_id DROP NOT NULL;
ALTER TABLE sejour_versement ALTER COLUMN a_id DROP NOT NULL;
ALTER TABLE sejour_versement ADD CONSTRAINT ck_sejour_versement_un_participant
    CHECK (de_id IS NOT NULL OR a_id IS NOT NULL);
