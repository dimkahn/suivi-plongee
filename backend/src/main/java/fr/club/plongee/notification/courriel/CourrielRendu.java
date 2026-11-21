package fr.club.plongee.notification.courriel;

/**
 * Un e-mail prêt à partir : la version texte, la version HTML, et le logo
 * joint au message (référencé {@code cid:} {@value GabaritCourriel#CID_LOGO}
 * dans le HTML ; aucune image n'est chargée depuis un serveur).
 */
public record CourrielRendu(String texte, String html, byte[] logo) {}
