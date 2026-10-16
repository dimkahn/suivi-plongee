package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.securite.domain.Utilisateur;

import java.util.List;
import java.util.Optional;

/** Les élèves et les comptes, qui empruntent le matériel et signent les saisies. */
public interface Personnes {

    Optional<Utilisateur> utilisateur(Long id);

    /** Le compte, sans le lire : pour signer une saisie. */
    Utilisateur referenceUtilisateur(Long id);

    List<Utilisateur> moniteurs();

    Optional<Eleve> eleve(Long id);

    /** Par nom puis prénom. */
    List<Eleve> elevesNonArchives();
}
