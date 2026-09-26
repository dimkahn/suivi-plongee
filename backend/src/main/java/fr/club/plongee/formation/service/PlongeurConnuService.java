package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;

import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Roster des plongeurs connus du club, pour pré-remplir aptitude et
 * qualification préparée d'un membre de palanquée (voir MembrePalanquee) :
 * élèves (aptitude = dernier brevet délivré dans l'app, ou à défaut
 * Eleve.dernierNiveau — déclaratif, pour un brevet obtenu ailleurs ou avant
 * l'outil ; qualification préparée = niveau du cursus en cours s'il y en a
 * un) et encadrants actifs (aptitude = niveau d'encadrement, pas de
 * qualification préparée — hors périmètre ici ; niveau de plongeur saisi
 * par un ADMIN, distinct de l'encadrement).
 */
@Service
public class PlongeurConnuService {

    /**
     * {@code aptitude} et {@code qualificationPreparee} pré-remplissent un
     * membre de palanquée ou de groupe ; {@code niveau}, {@code niveauPreparation}
     * et {@code niveauEncadrement} sont les mêmes informations séparées, pour
     * l'affichage dans la liste de choix (un élève peut aussi être encadrant
     * s'il a un compte moniteur).
     */
    public record PlongeurConnuVue(Long eleveId, Long utilisateurId, String nom, String prenom,
                                   String aptitude, String qualificationPreparee,
                                   String niveau, String niveauPreparation, String niveauEncadrement) {}

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
        Set<Long> comptesDejaListes = new HashSet<>();

        for (Eleve e : eleves.findByArchiveLeIsNullOrderByNomAscPrenomAsc()) {
            List<Cursus> historique = cursus.parEleve(e.getId());
            String aptitude = historique.stream()
                    .filter(c -> c.getStatut() == Cursus.Statut.DELIVRE)
                    .findFirst()
                    .map(c -> c.getReferentiel().getNiveau().name())
                    .orElse(e.getDernierNiveau());
            String qualificationPreparee = historique.stream()
                    .filter(c -> c.getStatut() == Cursus.Statut.EN_COURS)
                    .findFirst()
                    .map(c -> c.getReferentiel().getNiveau().name())
                    .orElse(null);
            // Élève qui a aussi un compte d'encadrant actif : son niveau d'encadrement
            // figure sur sa ligne, et il n'apparaît pas une seconde fois parmi les encadrants.
            Utilisateur compte = e.getUtilisateur();
            String encadrement = compte != null && compte.isActif() && compte.estMoniteur()
                    ? compte.getNiveauEncadrement().name() : null;
            if (encadrement != null) comptesDejaListes.add(compte.getId());
            // Sans brevet connu côté élève, le niveau saisi sur son compte d'encadrant.
            String niveau = aptitude != null || compte == null ? aptitude : compte.getNiveauPlongeur();
            resultat.add(new PlongeurConnuVue(e.getId(), null, e.getNom(), e.getPrenom(),
                    aptitude, qualificationPreparee, niveau, qualificationPreparee, encadrement));
        }

        for (Utilisateur u : utilisateurs.parRole(RoleNom.MONITEUR)) {
            if (!u.isActif() || comptesDejaListes.contains(u.getId())) continue;
            String aptitude = u.getNiveauEncadrement() == null ? null : u.getNiveauEncadrement().name();
            resultat.add(new PlongeurConnuVue(null, u.getId(), u.getNom(), u.getPrenom(), aptitude, null,
                    u.getNiveauPlongeur(), null, aptitude));
        }

        return resultat;
    }
}
