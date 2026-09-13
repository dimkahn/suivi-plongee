package fr.club.plongee.commun;

/** Violation d'une regle du MFT ou du reglement interieur du club. */
public class RegleMetierException extends RuntimeException {
    public RegleMetierException(String message) { super(message); }
}
