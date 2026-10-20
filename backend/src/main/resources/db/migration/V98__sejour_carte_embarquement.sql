-- La carte d'embarquement de chaque voyage d'un participant au séjour
-- (demande du club, 2026) : un PDF ou une photo, une par voyage (aller ou
-- retour), remplacée par la suivante. Ajoutée par le voyageur (appli ou
-- lien) ou par un organisateur ; comme le numéro de dossier (V96), seuls
-- le voyageur et les organisateurs la lisent (CartesEmbarquementService).
-- Elle part avec le participant, donc avec le séjour.
CREATE TABLE sejour_carte_embarquement (
    participant_id  BIGINT       NOT NULL REFERENCES sejour_participant(id) ON DELETE CASCADE,
    sens            VARCHAR(10)  NOT NULL CHECK (sens IN ('ARRIVEE', 'DEPART')),
    contenu         BYTEA        NOT NULL,
    type_contenu    VARCHAR(30)  NOT NULL CHECK (type_contenu IN ('application/pdf', 'image/jpeg', 'image/png')),
    ajoutee_le      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (participant_id, sens)
);
