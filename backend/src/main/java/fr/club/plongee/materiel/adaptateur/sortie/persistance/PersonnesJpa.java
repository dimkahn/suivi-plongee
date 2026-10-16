package fr.club.plongee.materiel.adaptateur.sortie.persistance;

import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.repository.EleveRepository;
import fr.club.plongee.materiel.domaine.port.Personnes;
import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/** Les élèves et les comptes, lus par les dépôts de leurs domaines. */
@Component
class PersonnesJpa implements Personnes {

    private final UtilisateurRepository utilisateurs;
    private final EleveRepository eleves;

    PersonnesJpa(UtilisateurRepository utilisateurs, EleveRepository eleves) {
        this.utilisateurs = utilisateurs;
        this.eleves = eleves;
    }

    @Override
    public Optional<Utilisateur> utilisateur(Long id) {
        return utilisateurs.findById(id);
    }

    @Override
    public Utilisateur referenceUtilisateur(Long id) {
        return utilisateurs.getReferenceById(id);
    }

    @Override
    public List<Utilisateur> moniteurs() {
        return utilisateurs.parRole(RoleNom.MONITEUR);
    }

    @Override
    public Optional<Eleve> eleve(Long id) {
        return eleves.findById(id);
    }

    @Override
    public List<Eleve> elevesNonArchives() {
        return eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc();
    }
}
