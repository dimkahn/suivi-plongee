-- Séjour hors ligne : le téléphone garde chaque modification faite sans
-- réseau et la rejoue au retour du réseau. Une création (participant,
-- voiture, logement, rendez-vous, dépense, remboursement) porte une
-- référence tirée par le téléphone (en-tête X-Reference-Client) ; rejouée
-- après une réponse perdue, elle n'est pas faite deux fois (RejeuSejour).
-- objet_id : l'id créé, rendu au rejeu quand l'écran en a besoin (dépense,
-- pour y joindre la photo de la note). Supprimée avec la sortie.
CREATE TABLE sejour_reference_client (
    sortie_id  BIGINT      NOT NULL REFERENCES sortie(id) ON DELETE CASCADE,
    reference  VARCHAR(64) NOT NULL,
    objet_id   BIGINT,
    cree_le    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sortie_id, reference)
);
