package fr.club.plongee.sejour.domaine.port;

import java.util.List;

/**
 * Les prêts de matériel déclarés depuis le séjour (V84) : quel participant a
 * emprunté, et qui l'a déclaré (un compte, ou un participant entré par le
 * lien). Le prêt lui-même est celui du matériel.
 */
public interface PretsDeclares {

    record PretDeclare(Long pretId, Long participantId, Long parUtilisateurId, Long parParticipantId) {}

    /** Ceux des prêts de la sortie qui ont été déclarés depuis son séjour. */
    List<PretDeclare> duSejour(Long sortieId);

    void noter(PretDeclare declaration);
}
