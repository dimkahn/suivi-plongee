package fr.club.plongee.sejour.domaine;

import java.util.Set;

/**
 * Un participant du séjour tel qu'enregistré. {@code compteEleve} : le
 * compte lié à son dossier élève, s'il en a un ; {@code membreGroupeId} :
 * le plongeur d'un groupe de plongeurs qu'il est aussi (V79), {@code groupe}
 * le nom de ce groupe.
 */
public record Participant(Long id, Long eleveId, Long utilisateurId, Long compteEleve, String nom, String prenom,
                          boolean plongeur, String telephone, String email,
                          Set<RegimeAlimentaire> regimes, String regimePrecision,
                          String urgenceNom, String urgenceTelephone,
                          Trajet arrivee, Trajet depart, String remarques,
                          Long membreGroupeId, String groupe) {

    /** Ce participant est ce compte : le sien, ou celui de son dossier élève. */
    public boolean estLeCompte(Long utilisateur) {
        return utilisateur != null && (utilisateur.equals(utilisateurId) || utilisateur.equals(compteEleve));
    }

    public String nomComplet() {
        return prenom + " " + nom;
    }
}
