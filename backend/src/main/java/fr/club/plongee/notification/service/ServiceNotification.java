package fr.club.plongee.notification.service;

import fr.club.plongee.securite.domain.Utilisateur;

/**
 * Port d'envoi de notifications au moniteur (e-mail, a terme SMS). Utilise
 * pour l'instant pour les liens de reinitialisation de mot de passe ; les
 * relances automatiques prevues (certificats medicaux, RIFAP, plongees en
 * milieu naturel dues) s'y brancheront de la meme facon.
 */
public interface ServiceNotification {

    /** {@code jeton} est le jeton en clair : il n'est jamais persiste tel quel. */
    void envoyerLienReinitialisation(Utilisateur destinataire, String jeton);

    /**
     * Meme jeton, meme page cote front, mais un message d'accueil different :
     * ce lien cree le mot de passe d'un compte tout juste ouvert par un ADMIN,
     * il ne remplace pas un mot de passe oublie.
     */
    void envoyerLienInvitation(Utilisateur destinataire, String jeton);

    /**
     * Courriel en texte brut à une adresse qui n'est pas forcément celle d'un
     * compte (plongeur d'un groupe de séjour, invité d'un autre club).
     * Renvoie {@code false} si l'envoi a échoué, pour que l'appelant le signale.
     */
    boolean envoyerCourriel(String adresse, String sujet, String corps);

    /**
     * Même courriel, avec une version HTML (un tableau, par exemple) que la
     * messagerie affiche à la place du texte, gardé pour celles qui n'affichent
     * pas le HTML. Par défaut, seul le texte part.
     */
    default boolean envoyerCourriel(String adresse, String sujet, String corps, String html) {
        return envoyerCourriel(adresse, sujet, corps);
    }

    /**
     * Un e-mail mis en forme par {@link fr.club.plongee.notification.courriel.GabaritCourriel} :
     * texte, HTML, et le logo de la structure joint au message. Par défaut, le logo ne part pas.
     */
    default boolean envoyerCourriel(String adresse, String sujet, fr.club.plongee.notification.courriel.CourrielRendu rendu) {
        return envoyerCourriel(adresse, sujet, rendu.texte(), rendu.html());
    }
}
