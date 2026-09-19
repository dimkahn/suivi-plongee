package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.securite.repository.UtilisateurRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Groupes nommés et réutilisables de plongeurs (voir {@link GroupePlongeurs}) :
 * composés une fois pour un séjour, puis glissés-déposés dans les palanquées
 * de plusieurs fiches de sécurité successives (voir {@code
 * FicheSecuriteService}), sans ressaisir le roster à chaque plongée. Un
 * groupe reste indépendant des fiches qui en reprennent les membres : les
 * modifier après coup ne change rien aux fiches déjà établies.
 */
@Service
public class GroupePlongeursService {

    public record MembreVue(Long eleveId, Long utilisateurId, String nom, String prenom,
                            String aptitude, String qualificationPreparee) {}

    public record GroupePlongeursVue(Long id, String nom, Long saisonId, List<MembreVue> membres) {}

    public record Membre(Long eleveId, Long utilisateurId, String nom, String prenom,
                         String aptitude, String qualificationPreparee) {}

    public record Saisie(String nom, Long saisonId, List<Membre> membres) {}

    private final GroupePlongeursRepository groupes;
    private final SaisonRepository saisons;
    private final EleveRepository eleves;
    private final UtilisateurRepository utilisateurs;

    public GroupePlongeursService(GroupePlongeursRepository groupes, SaisonRepository saisons,
                                  EleveRepository eleves, UtilisateurRepository utilisateurs) {
        this.groupes = groupes;
        this.saisons = saisons;
        this.eleves = eleves;
        this.utilisateurs = utilisateurs;
    }

    @Transactional(readOnly = true)
    public List<GroupePlongeursVue> lister(Long saisonId) {
        return groupes.findBySaisonIdOrderByNomAsc(saisonId).stream().map(this::vue).toList();
    }

    @Transactional
    public GroupePlongeursVue creer(Saisie saisie) {
        Saison saison = saisons.findById(saisie.saisonId())
                .orElseThrow(() -> new RessourceIntrouvableException("Saison introuvable"));
        if (saisie.nom() == null || saisie.nom().isBlank()) {
            throw new RegleMetierException("Le nom du groupe est obligatoire.");
        }

        GroupePlongeurs groupe = new GroupePlongeurs();
        groupe.setSaison(saison);
        groupe.setNom(saisie.nom());
        appliquerMembres(groupe, saisie.membres());
        return vue(groupes.save(groupe));
    }

    @Transactional
    public GroupePlongeursVue modifier(Long groupeId, Saisie saisie) {
        GroupePlongeurs groupe = groupes.findById(groupeId)
                .orElseThrow(() -> new RessourceIntrouvableException("Groupe de plongeurs introuvable"));
        if (saisie.nom() == null || saisie.nom().isBlank()) {
            throw new RegleMetierException("Le nom du groupe est obligatoire.");
        }
        groupe.setNom(saisie.nom());
        appliquerMembres(groupe, saisie.membres());
        return vue(groupes.save(groupe));
    }

    @Transactional
    public void supprimer(Long groupeId) {
        if (!groupes.existsById(groupeId)) {
            throw new RessourceIntrouvableException("Groupe de plongeurs introuvable");
        }
        groupes.deleteById(groupeId);
    }

    private void appliquerMembres(GroupePlongeurs groupe, List<Membre> membres) {
        groupe.getMembres().clear();
        for (Membre m : membres) {
            if (m.eleveId() != null && m.utilisateurId() != null) {
                throw new RegleMetierException(
                        "Un plongeur ne peut pas être à la fois un élève et un encadrant du club.");
            }
            MembreGroupePlongeurs membre = new MembreGroupePlongeurs();
            membre.setGroupe(groupe);
            if (m.eleveId() != null) {
                membre.setEleve(eleves.findById(m.eleveId())
                        .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable")));
            }
            if (m.utilisateurId() != null) {
                membre.setUtilisateur(utilisateurs.findById(m.utilisateurId())
                        .orElseThrow(() -> new RessourceIntrouvableException("Encadrant introuvable")));
            }
            membre.setNom(m.nom());
            membre.setPrenom(m.prenom());
            membre.setAptitude(m.aptitude());
            membre.setQualificationPreparee(m.qualificationPreparee());
            groupe.getMembres().add(membre);
        }
    }

    private GroupePlongeursVue vue(GroupePlongeurs g) {
        List<MembreVue> membres = g.getMembres().stream()
                .map(m -> new MembreVue(
                        m.getEleve() == null ? null : m.getEleve().getId(),
                        m.getUtilisateur() == null ? null : m.getUtilisateur().getId(),
                        m.getNom(), m.getPrenom(), m.getAptitude(), m.getQualificationPreparee()))
                .toList();
        return new GroupePlongeursVue(g.getId(), g.getNom(), g.getSaison().getId(), membres);
    }
}
