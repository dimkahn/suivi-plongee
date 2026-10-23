-- La photo d'un invité du séjour, pour le trombinoscope du séjour (demande
-- du club, 2026) : seulement pour un participant sans dossier élève ni
-- compte (la photo des autres vient de leur dossier ou de leur compte, avec
-- leur droit à l'image). Déposée par un organisateur qui confirme l'accord
-- de la personne (ou de son responsable légal si elle est mineure) :
-- accord_le en garde la date, accord_par_utilisateur_id le compte qui l'a
-- confirmé ; retirer l'accord, c'est supprimer la ligne. Supprimée aussi
-- dès que le participant est lié à un dossier ou à un compte.
-- Lue par les encadrants (TrombinoscopeSejourService), effacée le lendemain
-- de la fin du séjour, et avec le participant, donc avec le séjour.
CREATE TABLE sejour_participant_photo (
    participant_id  BIGINT       NOT NULL PRIMARY KEY REFERENCES sejour_participant(id) ON DELETE CASCADE,
    contenu         BYTEA        NOT NULL,
    type_contenu    VARCHAR(30)  NOT NULL CHECK (type_contenu IN ('image/jpeg', 'image/png')),
    accord_le       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accord_par_utilisateur_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL
);
