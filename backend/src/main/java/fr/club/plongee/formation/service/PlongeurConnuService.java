package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;

import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Roster des plongeurs connus du club, pour pré-remplir aptitude et
 * qualification préparée d'un membre de palanquée (voir MembrePalanquee) :
 * élèves (aptitude = dernier brevet délivré, qualification préparée = niveau
 * du cursus en cours s'il y en a un) et encadrants actifs (aptitude = niveau
 * d'encadrement, pas de qualification préparée — hors périmètre ici).
 */
@Service
public class PlongeurConnuService {

    public record PlongeurConnuVue(Long eleveId, Long utilisateurId, String nom, String prenom,
                                   String aptitude, String qualificationPreparee) {}

    private final EleveRepository eleves;
    private final CursusRepository cursus;
    private final UtilisateurRepository utilisateurs;

    public PlongeurConnuService(EleveRepository eleves, CursusRepository cursus,
                                UtilisateurRepository utilisateurs) {
        this.eleves = eleves;
        this.cursus = cursus;
        this.utilisateurs = utilisateurs;
    }

    @Transactional(readOnly = true)
    public List<PlongeurConnuVue> lister() {
        List<PlongeurConnuVue> resultat = new ArrayList<>();

        for (Eleve e : eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc()) {
            List<Cursus> historique = cursus.parEleve(e.getId());
            String aptitude = historique.stream()
                    .filter(c -> c.getStatut() == Cursus.Statut.DELIVRE)
                    .findFirst()
                    .map(c -> c.getReferentiel().getNiveau().name())
                    .orElse(null);
            String qualificationPreparee = historique.stream()
                    .filter(c -> c.getStatut() == Cursus.Statut.EN_COURS)
                    .findFirst()
                    .map(c -> c.getReferentiel().getNiveau().name())
                    .orElse(null);
            resultat.add(new PlongeurConnuVue(e.getId(), null, e.getNom(), e.getPrenom(),
                    aptitude, qualificationPreparee));
        }

        for (Utilisateur u : utilisateurs.parRole(RoleNom.MONITEUR)) {
            if (!u.isActif()) continue;
            String aptitude = u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name();
            resultat.add(new PlongeurConnuVue(null, u.getId(), u.getNom(), u.getPrenom(), aptitude, null));
        }

        return resultat;
    }
}
