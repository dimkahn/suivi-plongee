package fr.club.plongee.notification;

import fr.club.plongee.securite.Utilisateur;

/**
 * Port d'envoi de notifications au moniteur (e-mail, a terme SMS). Utilise
 * pour l'instant pour les liens de reinitialisation de mot de passe ; les
 * relances automatiques prevues (certificats medicaux, RIFAP, plongees en
 * milieu naturel dues) s'y brancheront de la meme facon.
 */
public interface ServiceNotification {

    /** {@code jeton} est le jeton en clair : il n'est jamais persiste tel quel. */
    void envoyerLienReinitialisation(Utilisateur destinataire, String jeton);
}
