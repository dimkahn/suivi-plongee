package fr.club.plongee.sejour;

import java.time.LocalDate;

/**
 * Lit sur la photo d'une note (ticket de caisse, facture) le montant total
 * payé et la date de l'achat, pour pré-remplir la dépense. Ce n'est qu'une
 * proposition : celui qui saisit vérifie avant d'enregistrer.
 * <p>
 * Facultatif, réglé par installation : sans clé d'accès au service de
 * lecture ({@code app.lecture-notes.cle-api}), {@link #actif()} est faux et
 * l'écran ne propose rien.
 */
public interface LecteurNote {

    /** Ce qui a pu être lu ; un champ illisible reste null. */
    record NoteLue(Long montantCentimes, LocalDate jour) {}

    boolean actif();

    /** Lève une {@code RegleMetierException} si le service ne répond pas. */
    NoteLue lire(byte[] image, String type);
}
