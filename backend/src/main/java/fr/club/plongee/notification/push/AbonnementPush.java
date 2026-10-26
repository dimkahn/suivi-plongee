package fr.club.plongee.notification.push;

/**
 * Un téléphone abonné, tel que le donne son navigateur
 * ({@code PushSubscription}) : l'adresse du service de notification, et
 * de quoi chiffrer pour lui seul (clé publique p256dh, secret auth, en
 * base64url).
 */
public record AbonnementPush(String endpoint, String p256dh, String auth) {}
