-- L'attestation d'assurance de chaque participant au séjour (demande du
-- club, 2026) : un PDF ou une photo, une par participant, remplacée par la
-- suivante. Ajoutée par le participant (appli ou lien) ou par un
-- organisateur ; comme la carte d'embarquement (V98), seuls le participant
-- et les organisateurs la lisent (AttestationsAssuranceService). Effacée
-- après le séjour ; elle part aussi avec le participant, donc avec le séjour.
CREATE TABLE sejour_attestation_assurance (
    participant_id  BIGINT       NOT NULL PRIMARY KEY REFERENCES sejour_participant(id) ON DELETE CASCADE,
    contenu         BYTEA        NOT NULL,
    type_contenu    VARCHAR(30)  NOT NULL CHECK (type_contenu IN ('application/pdf', 'image/jpeg', 'image/png')),
    ajoutee_le      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Le conseil d'assurance du séjour : un texte écrit par l'organisateur
-- (par exemple : souscrire une assurance complémentaire chez Lafont avec
-- son numéro de licencié), montré dans « Mon séjour » à chaque
-- participant qui n'a pas encore joint son attestation. Vide : pas d'encart.
ALTER TABLE sejour ADD COLUMN conseil_assurance TEXT;
