package fr.club.plongee.sejour.domaine.port;

import fr.club.plongee.sejour.domaine.FicheParticipant;
import fr.club.plongee.sejour.domaine.Participant;
import fr.club.plongee.sejour.domaine.SensTrajet;
import fr.club.plongee.sejour.domaine.Trajet;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Les participants d'un séjour, et ce qu'il faut lire ailleurs pour les inscrire (dossier, groupe). */
public interface ParticipantsSejour {

    /** Déjà inscrit : son id et « Prénom Nom ». */
    record Inscrit(Long id, String nom) {}

    /** Coordonnées du dossier élève, pour pré-remplir un participant. */
    record DossierEleve(String email, String telephone, String urgenceNom, String urgenceTelephone) {}

    /** L'e-mail propre au plongeur d'un groupe, et celui de son dossier (élève ou compte). */
    record EmailsMembre(String email, String emailDossier) {}

    /** Sans ordre. */
    List<Participant> participants(Long sortieId);

    Optional<Participant> participant(Long participantId);

    /** Sa ligne dans ce séjour, pour ce compte (le sien ou celui de son dossier élève) : la première. */
    Optional<Participant> participantDuCompte(Long sortieId, Long utilisateurId);

    /** Combien de ces ids sont des participants de ce séjour. */
    int compterDuSejour(Long sortieId, Collection<Long> participantIds);

    void ajouter(Long sortieId, FicheParticipant participant);

    void modifier(Long participantId, FicheParticipant participant);

    /** Ce que le participant renseigne lui-même : téléphone, repas, personne à prévenir, voyages, remarques. */
    void modifierInformations(Long participantId, FicheParticipant participant);

    void poserTrajet(Long sortieId, Collection<Long> participantIds, SensTrajet sens, Trajet trajet);

    void supprimer(Long participantId);

    /** Ses lignes dans les frais : dépenses payées, parts, remboursements. */
    int lignesDeFrais(Long participantId);

    /** Même dossier, même compte, ou mêmes nom et prénom (sans casse) ; hors {@code exclu}. */
    Optional<Inscrit> doublon(Long sortieId, Long exclu, Long eleveId, Long utilisateurId, String nom, String prenom);

    // Dossiers

    boolean eleveExiste(Long eleveId);

    boolean compteExiste(Long utilisateurId);

    Optional<DossierEleve> dossierEleve(Long eleveId);

    String emailDuCompte(Long utilisateurId);

    // Groupes de plongeurs

    boolean groupeExiste(Long groupeId);

    /** Les plongeurs du groupe, en fiches de participant liées à leur plongeur. */
    List<FicheParticipant> membresDuGroupe(Long groupeId);

    boolean membreInscrit(Long sortieId, Long membreId);

    /** Lie le participant au plongeur, s'il n'est lié à personne. */
    void lierAuMembre(Long participantId, Long membreId);

    boolean membreDeLaSaison(Long membreId, LocalDate jour);

    /** « Prénom Nom » des autres participants du séjour liés à ce plongeur. */
    List<String> autresLiesAuMembre(Long sortieId, Long membreId, Long exclu);

    Optional<EmailsMembre> emailsDuMembre(Long membreId);

    void reporterSurLeMembre(Long membreId, String nom, String prenom, String email);
}
