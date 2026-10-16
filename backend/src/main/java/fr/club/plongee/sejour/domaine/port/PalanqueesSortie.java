package fr.club.plongee.sejour.domaine.port;

import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.sejour.domaine.IdentitePlongeur;

import java.time.LocalTime;
import java.util.List;

/** Les palanquées des fiches de sécurité des plongées d'une sortie. */
public interface PalanqueesSortie {

    record MembrePalanquee(Long palanqueeId, IdentitePlongeur identite, FonctionPalanquee fonction, String aptitude,
                           String qualificationPreparee) {}

    /** Prévu et réalisé tels que saisis ; {@code directeurPlongee} : « Prénom Nom » ou null. */
    record Palanquee(Long id, Long seanceId, int numero, String directeurPlongee, Integer profondeurPrevue,
                     Integer dureePrevue, Integer profondeurRealisee, Integer dureeRealisee,
                     LocalTime heureImmersion) {}

    /** Par plongée (date, ordre) puis par numéro. */
    List<Palanquee> palanquees(Long sortieId);

    /** Dans l'ordre de saisie. */
    List<MembrePalanquee> membres(Long sortieId);
}
