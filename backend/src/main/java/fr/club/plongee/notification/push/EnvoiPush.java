package fr.club.plongee.notification.push;

/**
 * Envoie une notification à un téléphone abonné, par son service de
 * notification ({@link EnvoiPushHttp}) ; remplacé par une boîte en test.
 */
public interface EnvoiPush {

    /** EXPIRE : le service ne connaît plus l'abonnement (désinstallé, refusé) ; il est à oublier. */
    enum Resultat { ENVOYE, EXPIRE, ECHEC }

    /** {@code json} : le message, déjà mis en forme pour le service worker d'Angular. */
    Resultat envoyer(AbonnementPush abonnement, String json);
}
