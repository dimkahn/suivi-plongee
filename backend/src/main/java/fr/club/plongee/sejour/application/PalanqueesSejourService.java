package fr.club.plongee.sejour.application;

import fr.club.plongee.formation.domain.FonctionPalanquee;
import fr.club.plongee.sejour.domaine.IdentitePlongeur;
import fr.club.plongee.sejour.domaine.port.PalanqueesSortie;
import fr.club.plongee.sejour.domaine.port.PalanqueesSortie.MembrePalanquee;
import fr.club.plongee.sejour.domaine.port.ParticipantsSejour;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Les palanquées des plongées d'un séjour, lues sur les fiches de sécurité
 * des séances de la sortie (demande du club, 2026) : montrées dans le
 * programme, avec la fonction de chacun. Un encadrant voit toutes les
 * palanquées ; un participant seulement la sienne.
 * <p>
 * Le participant est retrouvé dans une palanquée par son dossier élève ou son
 * compte, sinon par ses nom et prénom (invité saisi à la main), comme pour
 * l'envoi des paramètres de fin de séjour ({@link IdentitePlongeur}).
 */
@Service
public class PalanqueesSejourService {

    /** Un plongeur d'une palanquée ; {@code moi} : c'est celui qui regarde. */
    public record MembrePalanqueeVue(String prenom, String nom, FonctionPalanquee fonction, String aptitude,
                                     String qualificationPreparee, boolean moi) {}

    /**
     * Une palanquée d'une plongée de la sortie. Profondeur et durée : le
     * réalisé s'il est saisi, sinon le prévu ({@code realise} le dit).
     */
    public record PalanqueeVue(Long seanceId, int numero, String directeurPlongee, Integer profondeur,
                               Integer duree, boolean realise, LocalTime heureImmersion,
                               List<MembrePalanqueeVue> membres) {}

    private final PalanqueesSortie palanquees;
    private final ParticipantsSejour participants;

    public PalanqueesSejourService(PalanqueesSortie palanquees, ParticipantsSejour participants) {
        this.palanquees = palanquees;
        this.participants = participants;
    }

    /**
     * Toutes les palanquées ({@code toutes}, pour un encadrant) ou seulement
     * celles où figure le participant. Rangées par plongée puis par numéro.
     */
    @Transactional(readOnly = true)
    public List<PalanqueeVue> palanquees(Long sortieId, Long participantId, boolean toutes) {
        IdentitePlongeur moi = participantId == null ? null
                : participants.participant(participantId).map(IdentitePlongeur::de).orElse(null);
        if (!toutes && moi == null) return List.of();

        Map<Long, List<MembrePalanqueeVue>> membres = palanquees.membres(sortieId).stream()
                .collect(Collectors.groupingBy(MembrePalanquee::palanqueeId, LinkedHashMap::new,
                        Collectors.mapping(m -> vue(m, moi), Collectors.toList())));
        List<PalanqueeVue> liste = palanquees.palanquees(sortieId).stream().map(pa -> {
            boolean realise = pa.profondeurRealisee() != null || pa.dureeRealisee() != null;
            List<MembrePalanqueeVue> vues = membres.getOrDefault(pa.id(), List.of()).stream()
                    .sorted(Comparator.comparingInt((MembrePalanqueeVue m) -> rangFonction(m.fonction())))
                    .toList();
            return new PalanqueeVue(pa.seanceId(), pa.numero(), pa.directeurPlongee(),
                    realise ? pa.profondeurRealisee() : pa.profondeurPrevue(),
                    realise ? pa.dureeRealisee() : pa.dureePrevue(), realise, pa.heureImmersion(), vues);
        }).toList();
        if (toutes) return liste;
        return liste.stream().filter(p -> p.membres().stream().anyMatch(MembrePalanqueeVue::moi)).toList();
    }

    private static MembrePalanqueeVue vue(MembrePalanquee m, IdentitePlongeur moi) {
        IdentitePlongeur i = m.identite();
        return new MembrePalanqueeVue(i.prenom(), i.nom(), m.fonction(), m.aptitude(), m.qualificationPreparee(),
                moi != null && moi.correspond(i));
    }

    /** L'encadrant, puis le guide de palanquée, puis les plongeurs. */
    private static int rangFonction(FonctionPalanquee f) {
        return switch (f) {
            case ENCADRANT -> 0;
            case GUIDE_PALANQUEE -> 1;
            case PLONGEUR -> 2;
        };
    }
}
