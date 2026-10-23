-- Le trombinoscope du séjour est lu par tous ses participants (demande du
-- club, 2026), mais la photo d'une personne n'y est montrée aux autres
-- participants que si un organisateur l'a rendue visible en confirmant
-- l'accord de la personne (ou de son responsable légal si elle est
-- mineure) : le droit à l'image du dossier ne couvre que les encadrants.
-- Sans cet accord, les participants voient ses initiales. On garde qui a
-- confirmé l'accord et quand ; le retirer remet la case à faux.
-- Pour un invité, l'accord donné en déposant sa photo vaut aussi pour les
-- participants (TrombinoscopeSejourService).
ALTER TABLE sejour_participant ADD COLUMN photo_visible_participants BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE sejour_participant ADD COLUMN photo_visible_accord_par BIGINT
    REFERENCES utilisateur(id) ON DELETE SET NULL;
ALTER TABLE sejour_participant ADD COLUMN photo_visible_accord_le TIMESTAMP;
