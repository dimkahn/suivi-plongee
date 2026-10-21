package fr.club.plongee.notification.relance;

import fr.club.plongee.notification.relance.CalculRelancesCaci.Moment;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Moniteur;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Qualite;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Relance;
import fr.club.plongee.notification.relance.CalculRelancesCaci.RelanceFaite;
import fr.club.plongee.notification.relance.TextesRelancesCaci.Courriel;
import fr.club.plongee.notification.service.ServiceNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static fr.club.plongee.commun.Calendrier.DATE_FR;

/**
 * Traitement quotidien des relances CACI (spec 2026-10-21-relances-caci) pour
 * un jour D donné : lit le périmètre en quelques requêtes, laisse
 * {@link CalculRelancesCaci} décider de ce qui est dû, envoie par
 * {@link ServiceNotification#envoyerCourriel} (console en profil dev), trace.
 *
 * <p>Pas de transaction d'un bloc : un e-mail parti ne s'annule pas. Chaque
 * envoi accepté est suivi de sa propre courte transaction (trace et relance
 * faite) ; si elle échoue, l'échec est journalisé sans donnée personnelle,
 * le traitement passe au suivant et l'e-mail repartira le lendemain ; la
 * contrainte d'unicité de {@code relance_caci_faite} interdit toute double
 * inscription.
 * Un e-mail refusé n'arrête pas les autres (R16).
 */
@Service
public class RelancesCaciService {

    private static final Logger log = LoggerFactory.getLogger(RelancesCaciService.class);

    private record Compte(long id, String email, String nom, String prenom, LocalDate finValidite) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final ServiceNotification notification;
    private final TransactionTemplate transaction;

    public RelancesCaciService(NamedParameterJdbcTemplate jdbc, ServiceNotification notification,
                               PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        this.notification = notification;
        this.transaction = new TransactionTemplate(transactions);
    }

    public void executer(LocalDate jour) {
        Map<Long, Compte> moniteurs = moniteursActifs(jour).stream()
                .collect(Collectors.toMap(Compte::id, Function.identity()));
        var resultat = CalculRelancesCaci.calculer(jour,
                moniteurs.values().stream()
                        .map(c -> new Moniteur(c.id(), c.nom(), c.prenom(), c.finValidite())).toList(),
                List.of(), relancesFaitesDesMoniteurs()); // élèves et récapitulatif : pas encore traités
        resultat.dues().stream()
                .filter(r -> r.qualite() == Qualite.MONITEUR)
                .forEach(r -> relancerMoniteur(jour, moniteurs.get(r.personneId()), r));
    }

    /** R9, R13, R14 : e-mail à l'adresse du compte ; refusé, la relance reste due (R16). */
    private void relancerMoniteur(LocalDate jour, Compte compte, Relance relance) {
        Courriel courriel = relance.moment() == Moment.JOUR_J
                ? TextesRelancesCaci.jourJ(compte.prenom(), relance.finValidite())
                : TextesRelancesCaci.bientot(compte.prenom(), relance.finValidite());
        if (notification.envoyerCourriel(compte.email(), courriel.sujet(), courriel.corps())) {
            try {
                transaction.executeWithoutResult(t -> noterRelanceMoniteur(jour, compte, relance));
            } catch (RuntimeException e) {
                // R16, R17 : on passe au suivant ; seulement le type, le message d'une violation d'unicité cite la clé.
                log.error("Relances CACI du {} : la trace d'un e-mail de relance parti n'a pas pu être écrite ({}).",
                        DATE_FR.format(jour), e.getClass().getSimpleName());
            }
        } else {
            // R17 : ni nom, ni adresse, ni date de CACI dans le journal.
            log.error("Relances CACI du {} : un e-mail de relance à un moniteur n'a pas pu partir.",
                    DATE_FR.format(jour));
        }
    }

    /**
     * R3 : rôle MONITEUR (pas {@code estMoniteur()}, qui exige aussi un niveau
     * d'encadrement), compte actif le jour D comme {@code Utilisateur.estActifLe}.
     * Seuls eux vont au calcul : R5 (dossier élève ignoré) en dépend.
     */
    private List<Compte> moniteursActifs(LocalDate jour) {
        return jdbc.query("""
                SELECT u.id, u.email, u.nom, u.prenom, u.certificat_valide_jusqu_au FROM utilisateur u
                 WHERE EXISTS (SELECT 1 FROM utilisateur_role r WHERE r.utilisateur_id = u.id AND r.role = 'MONITEUR')
                   AND u.actif = TRUE AND (u.acces_jusqu_au IS NULL OR u.acces_jusqu_au >= :jour)""",
                new MapSqlParameterSource("jour", jour),
                (rs, i) -> new Compte(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getObject(5, LocalDate.class)));
    }

    private List<RelanceFaite> relancesFaitesDesMoniteurs() {
        return jdbc.query("""
                SELECT utilisateur_id, moment, fin_validite, faite_le FROM relance_caci_faite
                 WHERE utilisateur_id IS NOT NULL""",
                new MapSqlParameterSource(),
                (rs, i) -> new RelanceFaite(Qualite.MONITEUR, rs.getLong(1), Moment.valueOf(rs.getString(2)),
                        rs.getObject(3, LocalDate.class), rs.getObject(4, LocalDate.class)));
    }

    /** Trace de l'e-mail parti (R19 : le moniteur est destinataire et seule personne concernée) et relance faite (R8). */
    private void noterRelanceMoniteur(LocalDate jour, Compte compte, Relance relance) {
        var cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO relance_caci_envoi (envoye_le, destinataire_nom, destinataire_prenom, destinataire_email)
                VALUES (:jour, :nom, :prenom, :email)""",
                new MapSqlParameterSource("jour", jour).addValue("nom", compte.nom())
                        .addValue("prenom", compte.prenom()).addValue("email", compte.email()),
                cle, new String[]{"id"});
        jdbc.update("""
                INSERT INTO relance_caci_envoi_personne (envoi_id, ordre, nom, prenom)
                VALUES (:envoi, 0, :nom, :prenom)""",
                new MapSqlParameterSource("envoi", cle.getKey().longValue())
                        .addValue("nom", compte.nom()).addValue("prenom", compte.prenom()));
        jdbc.update("""
                INSERT INTO relance_caci_faite (utilisateur_id, moment, fin_validite, faite_le)
                VALUES (:utilisateur, :moment, :fin, :jour)""",
                new MapSqlParameterSource("utilisateur", compte.id()).addValue("moment", relance.moment().name())
                        .addValue("fin", relance.finValidite()).addValue("jour", jour));
    }
}
