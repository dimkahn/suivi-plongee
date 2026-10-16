-- Le matériel emprunté au club, déclaré depuis le séjour par ceux qui l'ont
-- emprunté (demande du club, 2026), comme les frais. Chaque déclaration est un
-- vrai prêt (table pret, rattaché à la sortie) ; cette table dit seulement quel
-- participant l'a emprunté et qui l'a déclaré (un compte, ou un participant
-- entré par le lien), pour que chacun annule ce qu'il a déclaré.
-- Le prêt annulé emporte sa ligne ; un participant retiré du séjour laisse le
-- prêt, qui garde le nom de l'emprunteur (pret.emprunteur_nom).

CREATE TABLE sejour_pret (
    pret_id                     BIGINT PRIMARY KEY REFERENCES pret(id) ON DELETE CASCADE,
    participant_id              BIGINT REFERENCES sejour_participant(id) ON DELETE SET NULL,
    declare_par_utilisateur_id  BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL,
    declare_par_participant_id  BIGINT REFERENCES sejour_participant(id) ON DELETE SET NULL
);

CREATE INDEX ix_sejour_pret_participant ON sejour_pret (participant_id);
