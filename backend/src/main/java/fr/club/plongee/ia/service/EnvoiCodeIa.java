package fr.club.plongee.ia.service;

/**
 * Envoi du code d'accès à l'assistant IA. Une seule implémentation réelle
 * ({@link EnvoiCodeIaSmtp}) ; les tests la remplacent pour lire le code.
 */
public interface EnvoiCodeIa {

    /** Un échec lève une RegleMetierException : sans code reçu, pas d'accès, jamais de repli silencieux. */
    void envoyer(String destinataire, String code, String demandeur, int minutesDeValidite);
}
