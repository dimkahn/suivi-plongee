package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.commun.RessourceIntrouvableException;
import fr.club.plongee.sejour.SejourService.SensTrajet;
import fr.club.plongee.securite.UtilisateurPrincipal;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * La carte d'embarquement de chaque voyage d'un participant (V98, demande
 * du club, 2026) : un PDF ou une photo, une par voyage, remplacée par la
 * suivante. Comme le numéro de dossier, elle n'est lue et modifiée que par
 * le voyageur (compte connecté ou lien) et les organisateurs du séjour :
 * elle porte son nom et de quoi embarquer à sa place.
 */
@Service
public class CartesEmbarquementService {

    static final int TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
    private static final Set<String> TYPES = Set.of("application/pdf", "image/jpeg", "image/png");
    private static final String REFUS_TYPE = "La carte d'embarquement doit être un PDF ou une photo (JPEG, PNG).";

    public record ContenuCarte(byte[] contenu, String type) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final DroitsSejour droits;
    private final FraisService frais;

    public CartesEmbarquementService(NamedParameterJdbcTemplate jdbc, DroitsSejour droits, FraisService frais) {
        this.jdbc = jdbc;
        this.droits = droits;
        this.frais = frais;
    }

    /** Le voyageur lui-même, ou un organisateur du séjour (comme pour lire son dossier) ; sinon 403. */
    @Transactional(readOnly = true)
    public void verifierDroit(Long sortieId, Long participantId, UtilisateurPrincipal moi) {
        verifierParticipant(sortieId, participantId);
        if (SejourService.encadrant(moi) && droits.organise(sortieId, moi.id())) return;
        if (participantId.equals(frais.acteur(sortieId, moi).participantId())) return;
        throw new AccessDeniedException("Seuls le voyageur et les organisateurs du séjour ont sa carte d'embarquement.");
    }

    @Transactional
    public void deposer(Long sortieId, Long participantId, SensTrajet sens, byte[] contenu, String type) {
        verifierParticipant(sortieId, participantId);
        String verifie = verifierFichier(contenu, type);
        String colonne = sens == SensTrajet.ARRIVEE ? "arrivee" : "depart";
        Integer voyage = jdbc.queryForObject("""
                SELECT COUNT(*) FROM sejour_participant
                 WHERE id = :p AND (%1$s_date IS NOT NULL OR %1$s_heure IS NOT NULL
                       OR %1$s_transport IS NOT NULL OR %1$s_numero IS NOT NULL)""".formatted(colonne),
                new MapSqlParameterSource("p", participantId), Integer.class);
        if (voyage == null || voyage == 0) {
            throw new RegleMetierException("Renseignez d'abord ce voyage, puis ajoutez-y la carte d'embarquement.");
        }
        var p = new MapSqlParameterSource("p", participantId).addValue("sens", sens.name());
        jdbc.update("DELETE FROM sejour_carte_embarquement WHERE participant_id = :p AND sens = :sens", p);
        jdbc.update("""
                INSERT INTO sejour_carte_embarquement (participant_id, sens, contenu, type_contenu)
                VALUES (:p, :sens, :contenu, :type)""", p.addValue("contenu", contenu).addValue("type", verifie));
    }

    @Transactional
    public void retirer(Long sortieId, Long participantId, SensTrajet sens) {
        verifierParticipant(sortieId, participantId);
        jdbc.update("DELETE FROM sejour_carte_embarquement WHERE participant_id = :p AND sens = :sens",
                new MapSqlParameterSource("p", participantId).addValue("sens", sens.name()));
    }

    @Transactional(readOnly = true)
    public ContenuCarte lire(Long sortieId, Long participantId, SensTrajet sens) {
        verifierParticipant(sortieId, participantId);
        List<ContenuCarte> cartes = jdbc.query("""
                SELECT contenu, type_contenu FROM sejour_carte_embarquement
                 WHERE participant_id = :p AND sens = :sens""",
                new MapSqlParameterSource("p", participantId).addValue("sens", sens.name()),
                (rs, i) -> new ContenuCarte(rs.getBytes(1), rs.getString(2)));
        if (cartes.isEmpty()) throw new RessourceIntrouvableException("Pas de carte d'embarquement pour ce voyage");
        return cartes.getFirst();
    }

    /**
     * Le type annoncé par le navigateur ne suffit pas : la signature du
     * fichier doit le confirmer, puisqu'on le resservira tel quel. Renvoie
     * le type, en minuscules.
     */
    static String verifierFichier(byte[] contenu, String type) {
        if (contenu == null || contenu.length == 0) throw new RegleMetierException("Le fichier est vide.");
        if (contenu.length > TAILLE_MAX_OCTETS) {
            throw new RegleMetierException("La carte d'embarquement dépasse la taille maximale de 5 Mo.");
        }
        String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
        boolean pdf = contenu.length > 4 && contenu[0] == '%' && contenu[1] == 'P' && contenu[2] == 'D'
                && contenu[3] == 'F' && contenu[4] == '-';
        boolean jpeg = contenu.length > 3 && (contenu[0] & 0xFF) == 0xFF && (contenu[1] & 0xFF) == 0xD8
                && (contenu[2] & 0xFF) == 0xFF;
        boolean png = contenu.length > 8 && (contenu[0] & 0xFF) == 0x89 && contenu[1] == 'P'
                && contenu[2] == 'N' && contenu[3] == 'G';
        if (!TYPES.contains(t) || (t.equals("application/pdf") && !pdf) || (t.equals("image/jpeg") && !jpeg)
                || (t.equals("image/png") && !png)) {
            throw new RegleMetierException(REFUS_TYPE);
        }
        return t;
    }

    private void verifierParticipant(Long sortieId, Long participantId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sejour_participant WHERE id = :p AND sortie_id = :sortie",
                new MapSqlParameterSource("p", participantId).addValue("sortie", sortieId), Integer.class);
        if (n == null || n == 0) throw new RessourceIntrouvableException("Participant introuvable dans ce séjour");
    }
}
