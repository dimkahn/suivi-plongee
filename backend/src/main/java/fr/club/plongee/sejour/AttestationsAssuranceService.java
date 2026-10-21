package fr.club.plongee.sejour;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.sejour.CartesEmbarquementService.ContenuCarte;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * L'attestation d'assurance de chaque participant au séjour (V99, demande
 * du club, 2026) : un PDF ou une photo, une par participant, remplacée par
 * la suivante. Comme la carte d'embarquement, elle n'est lue et modifiée
 * que par le participant (compte connecté ou lien) et les organisateurs du
 * séjour : elle porte son nom, son adresse et son numéro de contrat.
 */
@Service
public class AttestationsAssuranceService {

    private static final String DOCUMENT = "L'attestation d'assurance";

    private final NamedParameterJdbcTemplate jdbc;
    private final DroitsSejour droits;
    private final FraisService frais;

    public AttestationsAssuranceService(NamedParameterJdbcTemplate jdbc, DroitsSejour droits, FraisService frais) {
        this.jdbc = jdbc;
        this.droits = droits;
        this.frais = frais;
    }

    /** Le participant lui-même, ou un organisateur du séjour ; sinon 403. */
    @Transactional(readOnly = true)
    public void verifierDroit(Long sortieId, Long participantId, UtilisateurPrincipal moi) {
        verifierParticipant(sortieId, participantId);
        if (SejourService.encadrant(moi) && droits.organise(sortieId, moi.id())) return;
        if (participantId.equals(frais.acteur(sortieId, moi).participantId())) return;
        throw new AccessDeniedException("Seuls le participant et les organisateurs du séjour ont son attestation d'assurance.");
    }

    @Transactional
    public void deposer(Long sortieId, Long participantId, byte[] contenu, String type) {
        verifierParticipant(sortieId, participantId);
        String verifie = CartesEmbarquementService.verifierFichier(contenu, type, DOCUMENT);
        var p = new MapSqlParameterSource("p", participantId);
        jdbc.update("DELETE FROM sejour_attestation_assurance WHERE participant_id = :p", p);
        jdbc.update("""
                INSERT INTO sejour_attestation_assurance (participant_id, contenu, type_contenu)
                VALUES (:p, :contenu, :type)""", p.addValue("contenu", contenu).addValue("type", verifie));
    }

    @Transactional
    public void retirer(Long sortieId, Long participantId) {
        verifierParticipant(sortieId, participantId);
        jdbc.update("DELETE FROM sejour_attestation_assurance WHERE participant_id = :p",
                new MapSqlParameterSource("p", participantId));
    }

    @Transactional(readOnly = true)
    public ContenuCarte lire(Long sortieId, Long participantId) {
        verifierParticipant(sortieId, participantId);
        List<ContenuCarte> attestations = jdbc.query(
                "SELECT contenu, type_contenu FROM sejour_attestation_assurance WHERE participant_id = :p",
                new MapSqlParameterSource("p", participantId),
                (rs, i) -> new ContenuCarte(rs.getBytes(1), rs.getString(2)));
        if (attestations.isEmpty()) throw new RessourceIntrouvableException("Pas d'attestation d'assurance");
        return attestations.getFirst();
    }

    /** Chaque nuit, à 3 h 35 (heure du club) : les attestations des séjours finis. */
    @Scheduled(cron = "0 35 3 * * *", zone = "Europe/Paris")
    public void effacerChaqueNuit() {
        effacerApresLeSejour(Calendrier.aujourdhui());
    }

    /**
     * Une attestation ne sert plus après le séjour : effacée le lendemain de
     * sa fin, ou du retour du participant s'il rentre plus tard, comme les
     * cartes d'embarquement. Renvoie le nombre d'attestations effacées.
     */
    @Transactional
    public int effacerApresLeSejour(LocalDate aujourdhui) {
        return jdbc.update("""
                DELETE FROM sejour_attestation_assurance WHERE participant_id IN (
                    SELECT p.id FROM sejour_participant p JOIN sortie s ON s.id = p.sortie_id
                     WHERE s.date_fin < :jour
                       AND (p.depart_date IS NULL OR p.depart_date < :jour)
                       AND (p.depart_date_arrivee IS NULL OR p.depart_date_arrivee < :jour))""",
                new MapSqlParameterSource("jour", aujourdhui));
    }

    private void verifierParticipant(Long sortieId, Long participantId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE id = :p AND sortie_id = :sortie",
                new MapSqlParameterSource("p", participantId).addValue("sortie", sortieId), Integer.class);
        if (n == null || n == 0) throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
    }
}
