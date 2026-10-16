package fr.club.plongee.sejour.domaine.port;

import fr.club.plongee.sejour.domaine.FicheLogement;
import fr.club.plongee.sejour.domaine.FicheVoiture;
import fr.club.plongee.sejour.domaine.Logement;
import fr.club.plongee.sejour.domaine.Voiture;

import java.util.Collection;
import java.util.List;

/** Les voitures et les logements (chambres, occupants) d'un séjour. */
public interface VoituresEtChambres {

    /** {@code role} : « conducteur » ou « passager ». */
    record PlaceEnVoiture(String qui, String voiture, String role) {}

    record Couchage(String prenom, String nom, String chambre, String logement) {}

    List<Voiture> voitures(Long sortieId);

    boolean voitureDuSejour(Long sortieId, Long voitureId);

    void creerVoiture(Long sortieId, FicheVoiture voiture, List<Long> passagers);

    /** Les passagers sont remplacés. */
    void modifierVoiture(Long voitureId, FicheVoiture voiture, List<Long> passagers);

    void supprimerVoiture(Long voitureId);

    /** Où ces participants sont déjà, dans une autre voiture du séjour que {@code exclue}. */
    List<PlaceEnVoiture> placesEnVoiture(Long sortieId, Long exclue, Collection<Long> participantIds);

    List<Logement> logements(Long sortieId);

    boolean logementDuSejour(Long sortieId, Long logementId);

    void creerLogement(Long sortieId, FicheLogement logement);

    /** Les chambres sont remplacées d'un bloc, avec leurs occupants. */
    void modifierLogement(Long logementId, FicheLogement logement);

    void supprimerLogement(Long logementId);

    /** Où ces participants dorment déjà, dans un autre logement du séjour que {@code exclu}. */
    List<Couchage> couchages(Long sortieId, Long exclu, Collection<Long> participantIds);
}
