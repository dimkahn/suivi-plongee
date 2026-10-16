package fr.club.plongee.sejour.domaine;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Qui est une personne, pour la retrouver d'une liste à l'autre (participant
 * du séjour, membre d'une palanquée) : son dossier élève, son compte, ses
 * nom et prénom.
 */
public record IdentitePlongeur(Long eleveId, Long compte, String nom, String prenom) {

    /** Même dossier élève, sinon même compte, sinon mêmes nom et prénom (sans accents ni casse). */
    public boolean correspond(IdentitePlongeur autre) {
        if (eleveId != null && autre.eleveId() != null) return eleveId.equals(autre.eleveId());
        if (compte != null && autre.compte() != null) return compte.equals(autre.compte());
        return normaliser(nom).equals(normaliser(autre.nom())) && normaliser(prenom).equals(normaliser(autre.prenom()));
    }

    public static IdentitePlongeur de(Participant p) {
        return new IdentitePlongeur(p.eleveId(), p.utilisateurId() != null ? p.utilisateurId() : p.compteEleve(),
                p.nom(), p.prenom());
    }

    private static String normaliser(String texte) {
        if (texte == null) return "";
        return Normalizer.normalize(texte, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).trim();
    }
}
