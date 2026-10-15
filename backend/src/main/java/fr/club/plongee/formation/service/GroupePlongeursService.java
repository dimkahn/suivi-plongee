package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.*;
import fr.club.plongee.formation.repository.*;
import fr.club.plongee.securite.repository.UtilisateurRepository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * {@code email} : celui saisi dans le groupe ; {@code emailDossier} : celui
     * du dossier de l'élève ou de l'encadrant, utilisé quand le premier est vide.
     */
    public record MembreVue(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                            String aptitude, String qualificationPreparee, String email, String emailDossier) {}

    public record GroupePlongeursVue(Long id, String nom, Long saisonId, List<MembreVue> membres) {}

    /** {@code id} : le plongeur déjà dans le groupe (gardé, avec son lien aux séjours), null pour un nouveau. */
    public record Membre(Long id, Long eleveId, Long utilisateurId, String nom, String prenom,
                         String aptitude, String qualificationPreparee, String email) {}

    public record Saisie(String nom, Long saisonId, List<Membre> membres) {}

    private final GroupePlongeursRepository groupes;
    private final SaisonRepository saisons;
    private final EleveRepository eleves;
    private final UtilisateurRepository utilisateurs;
    private final NamedParameterJdbcTemplate jdbc;

    public GroupePlongeursService(GroupePlongeursRepository groupes, SaisonRepository saisons,
                                  EleveRepository eleves, UtilisateurRepository utilisateurs,
                                  NamedParameterJdbcTemplate jdbc) {
        this.groupes = groupes;
        this.saisons = saisons;
        this.eleves = eleves;
        this.utilisateurs = utilisateurs;
        this.jdbc = jdbc;
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

    /**
     * Les plongeurs déjà dans le groupe gardent leur ligne (et donc leur lien
     * aux participants d'un séjour, V79) ; les autres sont retirés ou ajoutés.
     * Nom, prénom et e-mail saisis sont reportés sur les participants liés.
     */
    private void appliquerMembres(GroupePlongeurs groupe, List<Membre> membres) {
        Map<Long, MembreGroupePlongeurs> existants = new HashMap<>();
        groupe.getMembres().forEach(m -> existants.put(m.getId(), m));
        List<MembreGroupePlongeurs> gardes = new ArrayList<>();
        for (Membre m : membres) {
            if (m.eleveId() != null && m.utilisateurId() != null) {
                throw new RegleMetierException(
                        "Un plongeur ne peut pas être à la fois un élève et un encadrant du club.");
            }
            MembreGroupePlongeurs membre = m.id() == null ? null : existants.remove(m.id());
            if (membre == null) {
                membre = new MembreGroupePlongeurs();
            } else {
                reporterSurLesParticipants(m);
            }
            membre.setGroupe(groupe);
            membre.setEleve(null);
            membre.setUtilisateur(null);
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
            membre.setEmail(m.email() == null || m.email().isBlank() ? null : m.email().trim());
            gardes.add(membre);
        }
        groupe.getMembres().clear();
        groupe.getMembres().addAll(gardes);
    }

    /**
     * Le même plongeur inscrit à un séjour : nom, prénom et e-mail suivent.
     * Un e-mail vide dans le groupe (celui du dossier sert) laisse celui du
     * participant.
     */
    private void reporterSurLesParticipants(Membre m) {
        String email = m.email() == null || m.email().isBlank() ? null : m.email().trim();
        jdbc.update("""
                UPDATE sejour_participant SET nom = :nom, prenom = :prenom,
                       email = COALESCE(:email, email), plongeur = TRUE
                 WHERE membre_groupe_id = :id""",
                new MapSqlParameterSource("id", m.id()).addValue("nom", m.nom().trim())
                        .addValue("prenom", m.prenom().trim()).addValue("email", email, Types.VARCHAR));
    }

    private GroupePlongeursVue vue(GroupePlongeurs g) {
        List<MembreVue> membres = g.getMembres().stream()
                .map(m -> new MembreVue(m.getId(),
                        m.getEleve() == null ? null : m.getEleve().getId(),
                        m.getUtilisateur() == null ? null : m.getUtilisateur().getId(),
                        m.getNom(), m.getPrenom(), m.getAptitude(), m.getQualificationPreparee(), m.getEmail(),
                        m.getEleve() != null ? m.getEleve().getEmail()
                                : m.getUtilisateur() != null ? m.getUtilisateur().getEmail() : null))
                .toList();
        return new GroupePlongeursVue(g.getId(), g.getNom(), g.getSaison().getId(), membres);
    }
}
