package fr.club.plongee.sejour.domaine.port;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * L'entrée d'un participant par le lien du séjour (V77) : le code secret de
 * l'adresse, les codes à 6 chiffres envoyés par e-mail et les jetons, gardés
 * par leur empreinte seulement.
 */
public interface AccesParLien {

    /** De quel séjour il s'agit. */
    record Entete(String nom, String lieu, LocalDate dateDebut, LocalDate dateFin) {}

    /** {@code encadrant} : son compte (le sien ou celui de son dossier) est d'encadrant. */
    record Destinataire(Long id, String prenom, String nom, String email, boolean encadrant) {}

    record CodeEnBase(long id, String empreinte, LocalDateTime expire, int essais) {}

    record Acces(Long sortieId, Long participantId) {}

    record ParticipantCourt(Long id, String prenom, String nom) {}

    boolean sortieExiste(Long sortieId);

    /** Vide tant qu'aucun code n'a été tiré. */
    Optional<String> codeFrais(Long sortieId);

    /** Crée la ligne du séjour au besoin. */
    void poserCodeFrais(Long sortieId, String code);

    Optional<Entete> entete(String code);

    /** Ceux du séjour (ou les seuls {@code choisis}), par nom. */
    List<Destinataire> destinataires(Long sortieId, Collection<Long> choisis);

    /** Le premier participant de ce séjour avec cet e-mail qui n'est pas encadrant. */
    Optional<Long> participantPourLien(String code, String emailMinuscule);

    boolean codeEnvoyeDepuis(Long participantId, LocalDateTime depuis);

    void remplacerCode(Long participantId, String empreinte, LocalDateTime expire, LocalDateTime maintenant);

    /** Le plus récent d'abord. */
    List<CodeEnBase> codes(Long participantId);

    void compterEssai(long codeId);

    void effacerCodes(Long participantId);

    void creerJeton(Long participantId, String empreinte, LocalDateTime expire, LocalDateTime maintenant);

    void effacerJeton(String empreinte);

    Optional<Acces> acces(String code, String empreinteJeton, LocalDateTime maintenant);

    /** Par nom. */
    List<ParticipantCourt> participantsCourts(Long sortieId);

    String email(Long participantId);
}
