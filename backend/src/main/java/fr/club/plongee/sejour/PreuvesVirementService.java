package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.formation.service.SortieService;
import fr.club.plongee.sejour.FraisService.ActeurFrais;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

/**
 * La preuve d'un virement (V99_15, demande du club, 2026) : celui qui
 * rembourse envoie un PDF ou une photo de son virement ; le bénéficiaire
 * (le club : un organisateur) ou un organisateur le confirme, ce qui note
 * le remboursement, ou le refuse, ce qui efface la preuve. Tant qu'elle
 * n'est pas confirmée, elle ne compte pas dans les soldes.
 * <p>
 * <b>Lue seulement par celui qui l'envoie, le bénéficiaire et les
 * organisateurs</b> : un relevé de virement montre souvent un IBAN ou un
 * solde. Pour les autres, elle n'existe pas (404). Gardée avec le séjour
 * (choix du club), jamais envoyée par e-mail.
 */
@Service
public class PreuvesVirementService {

    /** {@code versementId} : le remboursement noté à la confirmation ; null, à confirmer. {@code aId} null : le club. */
    public record PreuveVue(Long id, Long deId, Long aId, long montantCentimes, LocalDate jour,
                            LocalDateTime envoyeeLe, String typeContenu, Long versementId) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final SortieService sorties;

    public PreuvesVirementService(NamedParameterJdbcTemplate jdbc, SortieService sorties) {
        this.jdbc = jdbc;
        this.sorties = sorties;
    }

    /** Toutes pour un organisateur ; sinon celles qu'on a envoyées ou qu'on reçoit. */
    @Transactional(readOnly = true)
    public List<PreuveVue> visibles(Long sortieId, ActeurFrais acteur) {
        if (!acteur.gestionnaire() && acteur.participantId() == null) return List.of();
        return jdbc.query("""
                SELECT id, de_id, a_id, montant_centimes, jour, envoyee_le, type_contenu, versement_id
                  FROM sejour_preuve_virement WHERE sortie_id = :sortie
                   AND (:tout = TRUE OR de_id = :moi OR a_id = :moi)
                 ORDER BY envoyee_le, id""",
                new MapSqlParameterSource("sortie", sortieId).addValue("tout", acteur.gestionnaire())
                        .addValue("moi", acteur.participantId()),
                (rs, i) -> new PreuveVue(rs.getLong("id"), rs.getLong("de_id"), rs.getObject("a_id", Long.class),
                        rs.getLong("montant_centimes"), rs.getObject("jour", LocalDate.class),
                        rs.getObject("envoyee_le", LocalDateTime.class), rs.getString("type_contenu"),
                        rs.getObject("versement_id", Long.class)));
    }

    /** Confirmer ou refuser : le bénéficiaire (participant) ou un organisateur, et seulement tant qu'elle attend. */
    static boolean peutConfirmer(PreuveVue p, ActeurFrais acteur) {
        return p.versementId() == null && (acteur.gestionnaire()
                || (acteur.participantId() != null && acteur.participantId().equals(p.aId())));
    }

    /** Retirer : aussi celui qui l'a envoyée, tant qu'elle attend. */
    static boolean peutRetirer(PreuveVue p, ActeurFrais acteur) {
        return peutConfirmer(p, acteur) || (p.versementId() == null && Objects.equals(acteur.participantId(), p.deId()));
    }

    /** {@code aId} null : au club. Celui qui envoie est toujours celui qui a remboursé. */
    @Transactional
    public void envoyer(Long sortieId, Long aId, Long montantCentimes, LocalDate jour, byte[] contenu, String type,
                        ActeurFrais acteur) {
        sorties.sortie(sortieId);
        if (acteur.participantId() == null) {
            throw new RegleMetierException("Seul un participant du séjour envoie la preuve de son virement.");
        }
        if (montantCentimes == null || montantCentimes <= 0) {
            throw new RegleMetierException("Le montant doit être positif.");
        }
        if (montantCentimes > FraisService.MONTANT_MAX_CENTIMES) {
            throw new RegleMetierException("Montant trop élevé (plus de 100 000 €) : vérifiez la saisie.");
        }
        if (acteur.participantId().equals(aId)) {
            throw new RegleMetierException("Un virement va à un autre participant, ou au club.");
        }
        if (aId != null) {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM sejour_participant WHERE id = :p AND sortie_id = :sortie",
                    new MapSqlParameterSource("p", aId).addValue("sortie", sortieId), Integer.class);
            if (n == null || n == 0) throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
        }
        String verifie = CartesEmbarquementService.verifierFichier(contenu, type, "La preuve du virement");
        jdbc.update("""
                INSERT INTO sejour_preuve_virement (sortie_id, de_id, a_id, montant_centimes, jour, contenu, type_contenu)
                VALUES (:sortie, :de, :a, :montant, :jour, :contenu, :type)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("de", acteur.participantId())
                        .addValue("a", aId).addValue("montant", montantCentimes)
                        .addValue("jour", jour == null ? LocalDate.now(ZoneId.of("Europe/Paris")) : jour)
                        .addValue("contenu", contenu).addValue("type", verifie));
    }

    /** Note le remboursement, au jour du virement, au nom de celui qui confirme. */
    @Transactional
    public void confirmer(Long sortieId, Long preuveId, ActeurFrais acteur) {
        PreuveVue p = visible(sortieId, preuveId, acteur);
        if (p.versementId() != null) throw new RegleMetierException("Ce virement est déjà confirmé.");
        if (!peutConfirmer(p, acteur)) {
            throw new RegleMetierException("Seul celui qui reçoit ce virement, ou un organisateur du séjour, le confirme.");
        }
        KeyHolder cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO sejour_versement (sortie_id, de_id, a_id, montant_centimes, jour,
                       saisie_par_utilisateur_id, saisie_par_participant_id)
                VALUES (:sortie, :de, :a, :montant, :jour, :parUtilisateur, :parParticipant)""",
                new MapSqlParameterSource("sortie", sortieId).addValue("de", p.deId()).addValue("a", p.aId())
                        .addValue("montant", p.montantCentimes()).addValue("jour", p.jour())
                        .addValue("parUtilisateur", acteur.utilisateurId())
                        .addValue("parParticipant", acteur.participantId()), cle, new String[]{"id"});
        // Deux confirmations en même temps : la seconde ne trouve plus la preuve en attente, et son
        // remboursement est annulé avec la transaction.
        if (jdbc.update("UPDATE sejour_preuve_virement SET versement_id = :v WHERE id = :p AND versement_id IS NULL",
                new MapSqlParameterSource("v", cle.getKey().longValue()).addValue("p", preuveId)) == 0) {
            throw new RegleMetierException("Ce virement est déjà confirmé.");
        }
    }

    /** Refusée par le bénéficiaire ou un organisateur, retirée par celui qui l'a envoyée : effacée. */
    @Transactional
    public void retirer(Long sortieId, Long preuveId, ActeurFrais acteur) {
        PreuveVue p = visible(sortieId, preuveId, acteur);
        if (p.versementId() != null) {
            throw new RegleMetierException("Ce virement est confirmé : annulez d'abord le remboursement noté.");
        }
        if (!peutRetirer(p, acteur)) {
            throw new RegleMetierException("Seuls celui qui l'a envoyée, celui qui reçoit le virement et les "
                    + "organisateurs retirent cette preuve.");
        }
        jdbc.update("DELETE FROM sejour_preuve_virement WHERE id = :p", new MapSqlParameterSource("p", preuveId));
    }

    /** Le fichier ; pour qui ne la voit pas, elle n'existe pas. */
    @Transactional(readOnly = true)
    public CartesEmbarquementService.ContenuCarte fichier(Long sortieId, Long preuveId, ActeurFrais acteur) {
        visible(sortieId, preuveId, acteur);
        return jdbc.queryForObject("SELECT contenu, type_contenu FROM sejour_preuve_virement WHERE id = :p",
                new MapSqlParameterSource("p", preuveId),
                (rs, i) -> new CartesEmbarquementService.ContenuCarte(rs.getBytes(1), rs.getString(2)));
    }

    private PreuveVue visible(Long sortieId, Long preuveId, ActeurFrais acteur) {
        return visibles(sortieId, acteur).stream().filter(p -> p.id().equals(preuveId)).findFirst()
                .orElseThrow(() -> new RessourceIntrouvableException("Preuve de virement introuvable"));
    }
}
