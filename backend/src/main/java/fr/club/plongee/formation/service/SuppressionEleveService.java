package fr.club.plongee.formation.service;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.domain.Eleve;
import fr.club.plongee.formation.repository.EleveRepository;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Suppression definitive d'un eleve archive, avec tout son historique :
 * cursus, evaluations, validations, delivrances, presences, adhesions,
 * qualifications, photo, et ses lignes d'audit Envers (qui garderaient sinon
 * nom, date de naissance et licence).
 *
 * <p><b>Derogation deliberee</b> a la regle « evaluation en ajout seul » :
 * c'est le seul endroit du code qui supprime des evaluations. On ne supprime
 * que celles de l'eleve, et seulement une fois qu'il a ete archive (deux
 * gestes distincts de l'ADMIN).
 *
 * <p>Les fiches de securite ne sont pas touchees : document du DP, elles
 * gardent le nom et le prenom tels que saisis, seul le lien vers le dossier
 * de l'eleve est retire. Idem pour les groupes de plongeurs.
 *
 * <p>SQL natif et non JPA : les suppressions en masse ne passent pas par
 * Envers, qui recreerait sinon une ligne d'audit (avec l'identite de
 * l'eleve) pour chaque entite supprimee.
 */
@Service
public class SuppressionEleveService {

    private final EleveRepository eleves;
    private final EntityManager em;

    public SuppressionEleveService(EleveRepository eleves, EntityManager em) {
        this.eleves = eleves;
        this.em = em;
    }

    @Transactional
    public void supprimer(Long eleveId) {
        Eleve eleve = eleves.findById(eleveId)
                .orElseThrow(() -> new RessourceIntrouvableException("Élève introuvable"));
        if (eleve.getArchiveLe() == null) {
            throw new RegleMetierException(
                    "Seul un élève archivé peut être supprimé : archivez-le d'abord.");
        }
        em.detach(eleve);

        // Cursus actuels et passes (un cursus deja supprime n'existe plus que dans cursus_aud).
        String cursusDeLEleve = "(SELECT id FROM cursus WHERE eleve_id = :id"
                + " UNION SELECT id FROM cursus_aud WHERE eleve_id = :id)";

        executer("DELETE FROM evaluation WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM validation_competence WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM delivrance WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM participation WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM validation_competence_aud WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM delivrance_aud WHERE cursus_id IN " + cursusDeLEleve, eleveId);
        executer("DELETE FROM cursus WHERE eleve_id = :id", eleveId);
        executer("DELETE FROM cursus_aud WHERE eleve_id = :id", eleveId);

        executer("DELETE FROM adhesion_saison WHERE eleve_id = :id", eleveId);
        executer("DELETE FROM qualification WHERE eleve_id = :id", eleveId);
        executer("DELETE FROM photo_eleve WHERE eleve_id = :id", eleveId);
        executer("UPDATE membre_palanquee SET eleve_id = NULL WHERE eleve_id = :id", eleveId);
        executer("UPDATE membre_groupe_plongeurs SET eleve_id = NULL WHERE eleve_id = :id", eleveId);

        executer("DELETE FROM eleve_aud WHERE id = :id", eleveId);
        executer("DELETE FROM eleve WHERE id = :id", eleveId);
    }

    private void executer(String sql, Long eleveId) {
        em.createNativeQuery(sql).setParameter("id", eleveId).executeUpdate();
    }
}
