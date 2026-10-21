package fr.club.plongee.notification.relance;

import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Eleve;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Moment;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Moniteur;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Qualite;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Relance;
import fr.club.plongee.notification.relance.CalculRelancesCaci.RelanceFaite;
import fr.club.plongee.notification.relance.TextesRelancesCaci.Courriel;
import fr.club.plongee.notification.service.ServiceNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static fr.club.plongee.commun.Calendrier.DATE_FR;

/**
 * Traitement quotidien des relances CACI (spec 2026-10-21-relances-caci) pour
 * un jour D donné : purge d'abord la trace de plus de deux ans (R20) et les
 * relances faites qui ne servent plus, puis lit le périmètre en quelques requêtes (moniteurs et
 * administrateurs actifs, élèves de la saison ouverte, relances déjà faites),
 * laisse {@link CalculRelancesCaci} décider de ce qui est dû, envoie par
 * {@link ServiceNotification#envoyerCourriel} (console en profil dev), trace.
 * D'abord les e-mails des moniteurs, puis, si une relance est due, le
 * récapitulatif à chaque administrateur, qui cite aussi les moniteurs dont
 * l'e-mail a été refusé. Les élèves ne reçoivent rien : leurs relances et les
 * citations « Sans CACI renseigné » ne comptent comme faites que si le
 * récapitulatif est parti vers au moins un administrateur (R17).
 *
 * <p>Pas de transaction d'un bloc : un e-mail parti ne s'annule pas. Chaque
 * envoi accepté est suivi de sa propre courte transaction (trace, relance
 * faite) ; si elle échoue, l'échec est journalisé sans donnée personnelle et
 * le traitement continue ; la contrainte d'unicité de
 * {@code relance_caci_faite} interdit toute double inscription.
 * Un e-mail refusé n'arrête pas les autres (R16).
 *
 * <p>{@link #lireTrace()} sert la consultation ADMIN de la trace (R21).
 */
@Service
public class RelancesCaciService {

    private static final Logger log = LoggerFactory.getLogger(RelancesCaciService.class);

    private record Compte(long id, String email, String nom, String prenom, LocalDate finValidite) {}

    /** Ligne de trace (R19) : date, destinataire, personnes concernées ; rien d'autre. */
    public record EnvoiTrace(long id, LocalDate envoyeLe, String destinataireNom, String destinatairePrenom,
                             String destinataireEmail, List<PersonneTracee> personnes) {}

    /** Personne concernée par un envoi, par son nom et son prénom seulement (R19). */
    public record PersonneTracee(String nom, String prenom) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final ServiceNotification notification;
    private final TransactionTemplate transaction;
    private final SaisonRepository saisons;

    public RelancesCaciService(NamedParameterJdbcTemplate jdbc, ServiceNotification notification,
                               PlatformTransactionManager transactions, SaisonRepository saisons) {
        this.jdbc = jdbc;
        this.notification = notification;
        this.saisons = saisons;
        this.transaction = new TransactionTemplate(transactions);
    }

    public void executer(LocalDate jour) {
        purger(jour);
        Map<Long, Compte> moniteurs = comptesActifs("MONITEUR", jour).stream()
                .collect(Collectors.toMap(Compte::id, Function.identity()));
        var resultat = CalculRelancesCaci.calculer(jour,
                moniteurs.values().stream()
                        .map(c -> new Moniteur(c.id(), c.nom(), c.prenom(), c.finValidite())).toList(),
                elevesDeLaSaison(), relancesFaites());
        List<Relance> injoignables = resultat.dues().stream()
                .filter(r -> r.qualite() == Qualite.MONITEUR)
                .filter(r -> !relancerMoniteur(jour, moniteurs.get(r.personneId()), r))
                .toList();
        if (resultat.recapitulatifDu()) envoyerRecapitulatif(jour, resultat, injoignables);
    }

    /**
     * Avant tout envoi. R20 : traces de plus de deux ans (personnes concernées
     * supprimées en cascade). Relances faites qui ne servent plus : « bientôt »
     * et « jour J » dès que F &lt; D (plus rien n'est dû, R7) ; citations
     * « Sans CACI renseigné » antérieures à D − 6, hors de la fenêtre de R12.
     * Chaque purge dans sa transaction : un échec est journalisé sans donnée
     * personnelle et n'arrête pas les relances du jour.
     */
    private void purger(LocalDate jour) {
        ecrire(jour, "la purge de la trace n'a pas pu être faite", () -> jdbc.update(
                "DELETE FROM relance_caci_envoi WHERE envoye_le < :seuil",
                new MapSqlParameterSource("seuil", premierEnvoiConserve(jour))));
        ecrire(jour, "la purge des relances faites n'a pas pu être faite", () -> jdbc.update("""
                DELETE FROM relance_caci_faite
                 WHERE (moment <> 'SANS_CACI' AND fin_validite < :jour)
                    OR (moment = 'SANS_CACI' AND faite_le < :debutSemaine)""",
                new MapSqlParameterSource("jour", jour).addValue("debutSemaine", jour.minusDays(6))));
    }

    /**
     * R20 : un envoi est supprimé le jour D si envoi + 2 ans &lt; D, calculé avec
     * {@code plusYears(2)} comme {@code Caci.finValidite} (un 29 février donne le
     * 28 février), en Java : l'arithmétique d'intervalles diffère entre H2 et
     * PostgreSQL. Renvoie le premier envoi conservé, donc la purge supprime les
     * envois antérieurs. {@code minusYears(2)} seul ne suffit pas : le
     * 29/02/2032, il donnerait le 28/02/2030, qui doit pourtant être supprimé.
     */
    static LocalDate premierEnvoiConserve(LocalDate jour) {
        LocalDate envoi = jour.minusYears(2);
        return envoi.plusYears(2).isBefore(jour) ? envoi.plusDays(1) : envoi;
    }

    /** R10, R11, R15 : un récapitulatif par administrateur actif ; parti vers au moins un, les élèves comptent comme relancés (R17). */
    private void envoyerRecapitulatif(LocalDate jour, CalculRelancesCaci.Resultat resultat, List<Relance> injoignables) {
        List<Compte> admins = comptesActifs("ADMIN", jour);
        if (admins.isEmpty()) {
            // R17 : ni nom, ni adresse, ni date de CACI dans le journal ; les élèves restent dus.
            log.error("Relances CACI du {} : aucun administrateur actif, récapitulatif non envoyé.", DATE_FR.format(jour));
            return;
        }
        boolean parti = false;
        for (Compte admin : admins) {
            Courriel courriel = TextesRelancesCaci.recapitulatif(admin.prenom(), jour, resultat.dues(),
                    resultat.sansCaci(), injoignables);
            if (notification.envoyerCourriel(admin.email(), courriel.sujet(), courriel.corps())) {
                parti = true;
                ecrire(jour, "la trace d'un récapitulatif parti n'a pas pu être écrite", () -> tracer(jour, admin,
                        Stream.concat(resultat.dues().stream(), resultat.sansCaci().stream()).toList()));
            }
        }
        if (!parti) {
            log.error("Relances CACI du {} : récapitulatif refusé pour tous les administrateurs.", DATE_FR.format(jour));
            return;
        }
        // Une transaction par relance : un conflit n'empêche pas de noter les autres (R8, R12).
        Stream.concat(resultat.dues().stream().filter(r -> r.qualite() == Qualite.ELEVE), resultat.sansCaci().stream())
                .forEach(r -> ecrire(jour, "une relance du récapitulatif n'a pas pu être notée", () -> noterFaite(jour, r)));
    }

    /**
     * Écriture en base après un envoi accepté, dans sa courte transaction. Un
     * échec n'arrête pas le traitement (R16) ; le journal ne garde que le type
     * de l'exception : son message (violation d'unicité) cite la clé, donc un
     * identifiant et une date de CACI (R17).
     */
    private void ecrire(LocalDate jour, String quoi, Runnable ecriture) {
        try {
            transaction.executeWithoutResult(t -> ecriture.run());
        } catch (RuntimeException e) {
            log.error("Relances CACI du {} : {} ({}).", DATE_FR.format(jour), quoi, e.getClass().getSimpleName());
        }
    }

    /** R9, R13, R14 : e-mail à l'adresse du compte ; refusé ({@code false}), la relance reste due (R16). */
    private boolean relancerMoniteur(LocalDate jour, Compte compte, Relance relance) {
        Courriel courriel = relance.moment() == Moment.JOUR_J
                ? TextesRelancesCaci.jourJ(compte.prenom(), relance.finValidite())
                : TextesRelancesCaci.bientot(compte.prenom(), relance.finValidite());
        if (notification.envoyerCourriel(compte.email(), courriel.sujet(), courriel.corps())) {
            ecrire(jour, "la trace d'un e-mail de relance parti n'a pas pu être écrite",
                    () -> noterRelanceMoniteur(jour, compte, relance));
            return true;
        }
        // R17 : ni nom, ni adresse, ni date de CACI dans le journal.
        log.error("Relances CACI du {} : un e-mail de relance à un moniteur n'a pas pu partir.",
                DATE_FR.format(jour));
        return false;
    }

    /**
     * Comptes ayant ce rôle et actifs le jour D, comme {@code Utilisateur.estActifLe}
     * (R3, R10). Moniteurs : le rôle MONITEUR, pas {@code estMoniteur()}, qui
     * exige aussi un niveau d'encadrement ; seuls eux vont au calcul, R5
     * (dossier élève ignoré) en dépend.
     */
    private List<Compte> comptesActifs(String role, LocalDate jour) {
        return jdbc.query("""
                SELECT u.id, u.email, u.nom, u.prenom, u.certificat_valide_jusqu_au FROM utilisateur u
                 WHERE EXISTS (SELECT 1 FROM utilisateur_role r WHERE r.utilisateur_id = u.id AND r.role = :role)
                   AND u.actif = TRUE AND (u.acces_jusqu_au IS NULL OR u.acces_jusqu_au >= :jour)""",
                new MapSqlParameterSource("jour", jour).addValue("role", role),
                (rs, i) -> new Compte(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getObject(5, LocalDate.class)));
    }

    /**
     * R4 : dossiers non archivés rattachés à la saison ouverte (la plus récente
     * par date de début, comme les écrans) par une formation, quel que soit son
     * statut, ou par une adhésion. R5 (dossier d'un moniteur) est fait par le calcul.
     */
    private List<Eleve> elevesDeLaSaison() {
        return saisons.findFirstByOuverteTrueOrderByDateDebutDesc()
                .map(saison -> jdbc.query("""
                        SELECT e.id, e.utilisateur_id, e.nom, e.prenom, e.certificat_valide_jusqu_au FROM eleve e
                         WHERE e.archive_le IS NULL
                           AND (EXISTS (SELECT 1 FROM cursus c WHERE c.eleve_id = e.id AND c.saison_id = :saison)
                             OR EXISTS (SELECT 1 FROM adhesion_saison a WHERE a.eleve_id = e.id AND a.saison_id = :saison))""",
                        new MapSqlParameterSource("saison", saison.getId()),
                        (rs, i) -> new Eleve(rs.getLong(1), rs.getObject(2, Long.class), rs.getString(3),
                                rs.getString(4), rs.getObject(5, LocalDate.class))))
                .orElse(List.of());
    }

    private List<RelanceFaite> relancesFaites() {
        return jdbc.query("""
                SELECT utilisateur_id, eleve_id, moment, fin_validite, faite_le FROM relance_caci_faite""",
                new MapSqlParameterSource(),
                (rs, i) -> {
                    Long utilisateur = rs.getObject(1, Long.class);
                    return new RelanceFaite(utilisateur != null ? Qualite.MONITEUR : Qualite.ELEVE,
                            utilisateur != null ? utilisateur : rs.getLong(2), Moment.valueOf(rs.getString(3)),
                            rs.getObject(4, LocalDate.class), rs.getObject(5, LocalDate.class));
                });
    }

    /**
     * R21 : la trace, du plus récent au plus ancien ; les personnes de tous les
     * envois sont lues en une requête. Rien de {@code relance_caci_faite}.
     */
    public List<EnvoiTrace> lireTrace() {
        List<EnvoiTrace> envois = jdbc.query("""
                SELECT id, envoye_le, destinataire_nom, destinataire_prenom, destinataire_email
                  FROM relance_caci_envoi ORDER BY envoye_le DESC, id DESC""",
                (rs, i) -> new EnvoiTrace(rs.getLong(1), rs.getObject(2, LocalDate.class), rs.getString(3),
                        rs.getString(4), rs.getString(5), new ArrayList<>()));
        if (envois.isEmpty()) return envois;
        Map<Long, EnvoiTrace> parId = envois.stream()
                .collect(Collectors.toMap(EnvoiTrace::id, Function.identity()));
        jdbc.query("""
                SELECT envoi_id, nom, prenom FROM relance_caci_envoi_personne
                 WHERE envoi_id IN (:ids) ORDER BY envoi_id, ordre""",
                new MapSqlParameterSource("ids", parId.keySet()),
                (RowCallbackHandler) rs -> parId.get(rs.getLong(1)).personnes()
                        .add(new PersonneTracee(rs.getString(2), rs.getString(3))));
        return envois;
    }

    /**
     * R19 : une ligne par e-mail parti, avec le destinataire et les personnes
     * concernées par leur nom et prénom seulement (ni F, ni mention, ni texte).
     */
    private void tracer(LocalDate jour, Compte destinataire, List<Relance> personnes) {
        var cle = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO relance_caci_envoi (envoye_le, destinataire_nom, destinataire_prenom, destinataire_email)
                VALUES (:jour, :nom, :prenom, :email)""",
                new MapSqlParameterSource("jour", jour).addValue("nom", destinataire.nom())
                        .addValue("prenom", destinataire.prenom()).addValue("email", destinataire.email()),
                cle, new String[]{"id"});
        long envoi = cle.getKey().longValue();
        for (int ordre = 0; ordre < personnes.size(); ordre++) {
            jdbc.update("""
                    INSERT INTO relance_caci_envoi_personne (envoi_id, ordre, nom, prenom)
                    VALUES (:envoi, :ordre, :nom, :prenom)""",
                    new MapSqlParameterSource("envoi", envoi).addValue("ordre", ordre)
                            .addValue("nom", personnes.get(ordre).nom()).addValue("prenom", personnes.get(ordre).prenom()));
        }
    }

    /**
     * R8, R12 : relance faite, ou citation « Sans CACI renseigné ». Celles du
     * récapitulatif ne sont notées que s'il est parti (R17).
     */
    private void noterFaite(LocalDate jour, Relance relance) {
        boolean moniteur = relance.qualite() == Qualite.MONITEUR;
        jdbc.update("""
                INSERT INTO relance_caci_faite (utilisateur_id, eleve_id, moment, fin_validite, faite_le)
                VALUES (:utilisateur, :eleve, :moment, :fin, :jour)""",
                new MapSqlParameterSource("utilisateur", moniteur ? relance.personneId() : null)
                        .addValue("eleve", moniteur ? null : relance.personneId())
                        .addValue("moment", relance.moment().name())
                        .addValue("fin", relance.finValidite()).addValue("jour", jour));
    }

    /** Trace de l'e-mail parti (R19 : le moniteur est destinataire et seule personne concernée) et relance faite (R8). */
    private void noterRelanceMoniteur(LocalDate jour, Compte compte, Relance relance) {
        tracer(jour, compte, List.of(relance));
        noterFaite(jour, relance);
    }
}
