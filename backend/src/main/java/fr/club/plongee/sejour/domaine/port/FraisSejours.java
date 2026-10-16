package fr.club.plongee.sejour.domaine.port;

import fr.club.plongee.sejour.domaine.FraisSejour.CategorieDepense;
import fr.club.plongee.sejour.domaine.FraisSejour.Depense;
import fr.club.plongee.sejour.domaine.FraisSejour.Part;
import fr.club.plongee.sejour.domaine.FraisSejour.Versement;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Les frais d'un séjour (V76, V77) : dépenses et leurs parts, remboursements, photos des notes. */
public interface FraisSejours {

    /** Qui a saisi une ligne : un compte ou un participant entré par le lien. */
    record Saisie(Long parUtilisateurId, Long parParticipantId) {}

    record ContenuPhoto(byte[] contenu, String type) {}

    /** Les participants du séjour, dans l'ordre des noms. */
    List<Long> participants(Long sortieId);

    /** Avec leurs parts et leurs photos, par jour. */
    List<Depense> depenses(Long sortieId);

    List<Versement> versements(Long sortieId);

    /** Qui a saisi cette dépense de ce séjour ; vide si elle n'en est pas. */
    Optional<Saisie> saisieDepense(Long sortieId, Long depenseId);

    Optional<Saisie> saisieVersement(Long sortieId, Long versementId);

    long creerDepense(Long sortieId, String libelle, CategorieDepense categorie, long montantCentimes, Long payeurId,
                      LocalDate jour, List<Part> parts, Saisie saisie);

    /** Les parts sont remplacées. */
    void modifierDepense(Long depenseId, String libelle, CategorieDepense categorie, long montantCentimes,
                         Long payeurId, LocalDate jour, List<Part> parts);

    void supprimerDepense(Long depenseId);

    void creerVersement(Long sortieId, Long deId, Long aId, long montantCentimes, LocalDate jour, Saisie saisie);

    void supprimerVersement(Long versementId);

    int photos(Long depenseId);

    void ajouterPhoto(Long depenseId, byte[] contenu, String type);

    /** Faux si la photo n'est pas de cette dépense. */
    boolean supprimerPhoto(Long depenseId, Long photoId);

    Optional<ContenuPhoto> photo(Long sortieId, Long depenseId, Long photoId);
}
