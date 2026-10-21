package fr.club.plongee.notification.relance;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.notification.relance.FausseMessagerie.Boite;
import fr.club.plongee.notification.relance.FausseMessagerie.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

import static fr.club.plongee.commun.Calendrier.DATE_FR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Relances CACI des moniteurs, de bout en bout : comptes créés par
 * presidente@club.fr comme dans l'écran Moniteurs, traitement appelé avec un
 * jour D choisi, e-mails lus dans une fausse messagerie.
 *
 * <p>Base H2 à part (même configuration dans toutes les classes des relances,
 * pour un seul contexte en cache) : les contrôles « exactement » n'y dépendent
 * pas des autres tests. Chaque test a son ancre dans le passé, loin de la démo
 * (datée du jour du lancement), pour que les dates d'examen restent acceptées.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:relances-caci;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
@Import(FausseMessagerie.class)
@ExtendWith(OutputCaptureExtension.class)
class RelancesCaciMoniteursTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Boite messagerie;
    @Autowired RelancesCaciService relances;

    @BeforeEach
    void viderLaMessagerie() {
        messagerie.vider();
    }

    /** Ancre propre au test n : trois ans en arrière, puis 60 jours d'écart entre deux tests. */
    private static LocalDate ancre(int n) {
        return Calendrier.aujourdhui().minusYears(3).plusDays(60L * n);
    }

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** Crée le compte comme presidente@club.fr dans l'écran Moniteurs ; renvoie son id. */
    private long creerMoniteur(String email, String nom, String prenom, LocalDate examen) throws Exception {
        String reponse = mvc.perform(post("/api/admin/moniteurs").header("Authorization", jeton("presidente@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"%s","prenom":"%s","niveauEncadrement":"E2",
                                 "caciDateExamen":"%s","caciMedecin":"FEDERAL","caciActivites":["ENSEMBLE_ACTIVITES"]}"""
                                .formatted(email, nom, prenom, examen)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private static String corpsBientot(String prenom, LocalDate fin) {
        return """
                Bonjour %s,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au %s.
                Pensez à le faire renouveler et à remettre le nouveau certificat à un administrateur du club avant cette date.

                Message envoyé automatiquement par le suivi des formations du club.""".formatted(prenom, DATE_FR.format(fin));
    }

    @Test
    @DisplayName("Un moniteur reçoit un seul e-mail 30 jours avant la fin de son CACI")
    void relanceAJMoins30() throws Exception {
        LocalDate examen = ancre(1);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca1@exemple.fr", "Marin", "Paul", examen);

        relances.executer(fin.minusDays(30));

        List<Message> recus = messagerie.vers("paul.marin.ca1@exemple.fr");
        assertThat(recus).hasSize(1);
        assertThat(recus.getFirst().sujet()).isEqualTo("Votre CACI expire le " + DATE_FR.format(fin));
        assertThat(recus.getFirst().corps()).isEqualTo(corpsBientot("Paul", fin));
        // R19 : une ligne de trace, le moniteur destinataire et seule personne concernée.
        assertThat(jdbc.queryForList("""
                SELECT e.envoye_le, e.destinataire_nom, e.destinataire_prenom, p.nom, p.prenom
                  FROM relance_caci_envoi e JOIN relance_caci_envoi_personne p ON p.envoi_id = e.id
                 WHERE e.destinataire_email = ?""", "paul.marin.ca1@exemple.fr"))
                .extracting(l -> List.copyOf(l.values()))
                .containsExactly(List.of(Date.valueOf(fin.minusDays(30)), "Marin", "Paul", "Marin", "Paul"));
    }

    @Test
    @DisplayName("Rejouer le traitement chaque jour jusqu'à F − 1 n'envoie rien de plus au moniteur")
    void uneSeuleRelanceBientot() throws Exception {
        LocalDate examen = ancre(3);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca3@exemple.fr", "Marin", "Paul", examen);

        relances.executer(fin.minusDays(30));
        relances.executer(fin.minusDays(30));
        for (LocalDate d = fin.minusDays(29); d.isBefore(fin); d = d.plusDays(1)) {
            relances.executer(d);
        }

        assertThat(messagerie.vers("paul.marin.ca3@exemple.fr")).hasSize(1);
        assertThat(tracesVers("paul.marin.ca3@exemple.fr")).isEqualTo(1);
    }

    @Test
    @DisplayName("Le dernier jour de validité, le moniteur reçoit l'e-mail du jour J")
    void relanceJourJ() throws Exception {
        LocalDate examen = ancre(5);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca5@exemple.fr", "Marin", "Paul", examen);
        relances.executer(fin.minusDays(30));
        messagerie.vider();

        relances.executer(fin);

        List<Message> recus = messagerie.vers("paul.marin.ca5@exemple.fr");
        assertThat(recus).hasSize(1);
        assertThat(recus.getFirst().sujet()).isEqualTo("Votre CACI expire aujourd'hui, le " + DATE_FR.format(fin));
        assertThat(recus.getFirst().corps()).isEqualTo(corpsJourJ("Paul", fin));
    }

    @Test
    @DisplayName("Un moniteur désactivé ou dont l'accès est terminé n'est ni relancé ni cité")
    void moniteurInactif() throws Exception {
        LocalDate examen = ancre(9);
        LocalDate fin = examen.plusYears(1);
        LocalDate jour = fin.minusDays(30);
        long desactive = creerMoniteur("desactive.ca9@exemple.fr", "Desactive", "Paul", examen);
        long accesTermine = creerMoniteur("acces.termine.ca9@exemple.fr", "Termine", "Paul", examen);
        mvc.perform(put("/api/admin/moniteurs/" + desactive + "/activation")
                        .header("Authorization", jeton("presidente@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                .andExpect(status().isOk());
        // Pas de route pour une fin d'accès d'un moniteur : posée en base.
        jdbc.update("UPDATE utilisateur SET acces_jusqu_au = ? WHERE id = ?", jour.minusDays(1), accesTermine);

        relances.executer(jour);

        assertThat(messagerie.vers("desactive.ca9@exemple.fr")).isEmpty();
        assertThat(messagerie.vers("acces.termine.ca9@exemple.fr")).isEmpty();
    }

    @Test
    @DisplayName("Un compte actif sans le rôle MONITEUR n'est pas relancé, même avec un CACI à J-30")
    void compteSansRoleMoniteur() throws Exception {
        LocalDate examen = ancre(10);
        LocalDate fin = examen.plusYears(1);
        long compte = creerMoniteur("sans.role.r3@exemple.fr", "Surface", "Paul", examen);
        // Compte de sécurité surface qui garde son CACI : rôle changé en base.
        jdbc.update("DELETE FROM utilisateur_role WHERE utilisateur_id = ?", compte);
        jdbc.update("INSERT INTO utilisateur_role (utilisateur_id, role) VALUES (?, 'SECURITE_SURFACE')", compte);

        relances.executer(fin.minusDays(30));

        assertThat(messagerie.vers("sans.role.r3@exemple.fr")).isEmpty();
    }

    @Test
    @DisplayName("E-mail refusé : pas de trace, journal sans adresse, nouvel essai le lendemain")
    void echecEmailMoniteur(CapturedOutput journal) throws Exception {
        LocalDate examen = ancre(11);
        LocalDate fin = examen.plusYears(1);
        LocalDate jour = fin.minusDays(30);
        creerMoniteur("paul.marin.ca21@exemple.fr", "Marin", "Paul", examen);
        creerMoniteur("autre.ca21@exemple.fr", "Autre", "Lucie", examen);
        messagerie.refuser("paul.marin.ca21@exemple.fr");

        relances.executer(jour);

        assertThat(tracesVers("paul.marin.ca21@exemple.fr")).isZero();
        assertThat(messagerie.vers("autre.ca21@exemple.fr")).hasSize(1);
        List<String> lignes = journal.getOut().lines().filter(l -> l.contains("Relances CACI du")).toList();
        assertThat(lignes).anyMatch(l -> l.endsWith(
                "Relances CACI du " + DATE_FR.format(jour) + " : un e-mail de relance à un moniteur n'a pas pu partir."));
        assertThat(lignes).noneMatch(l -> l.contains("paul.marin") || l.contains("Marin")
                || l.contains(DATE_FR.format(fin)));

        messagerie.accepter("paul.marin.ca21@exemple.fr");
        relances.executer(jour.plusDays(1));

        List<Message> recus = messagerie.vers("paul.marin.ca21@exemple.fr");
        assertThat(recus).hasSize(1);
        assertThat(recus.getFirst().sujet()).isEqualTo("Votre CACI expire le " + DATE_FR.format(fin));
        assertThat(tracesVers("paul.marin.ca21@exemple.fr")).isEqualTo(1);
    }

    @Test
    @DisplayName("Trace impossible à écrire après un envoi : les autres moniteurs sont relancés, journal sans identifiant ni date de CACI")
    void traceEnEchecNArretePasLesAutres(CapturedOutput journal) throws Exception {
        LocalDate examen = ancre(13);
        LocalDate fin = examen.plusYears(1);
        LocalDate jour = fin.minusDays(30);
        long marin = creerMoniteur("paul.marin.trace@exemple.fr", "Marin", "Paul", examen);
        long autre = creerMoniteur("autre.trace@exemple.fr", "Autre", "Lucie", examen);
        // Un second passage simultané a déjà noté la relance : l'écriture de la trace heurte l'unicité.
        for (var compte : List.of(new Object[]{"paul.marin.trace@exemple.fr", marin}, new Object[]{"autre.trace@exemple.fr", autre})) {
            messagerie.apresEnvoi((String) compte[0], () -> jdbc.update("""
                    INSERT INTO relance_caci_faite (utilisateur_id, moment, fin_validite, faite_le)
                    VALUES (?, 'BIENTOT', ?, ?)""", compte[1], Date.valueOf(fin), Date.valueOf(jour)));
        }

        relances.executer(jour);

        assertThat(messagerie.vers("paul.marin.trace@exemple.fr")).hasSize(1);
        assertThat(messagerie.vers("autre.trace@exemple.fr")).hasSize(1);
        List<String> lignes = journal.getOut().lines().filter(l -> l.contains("Relances CACI du")).toList();
        assertThat(lignes).anyMatch(l -> l.contains("Relances CACI du " + DATE_FR.format(jour)
                + " : la trace d'un e-mail de relance parti n'a pas pu être écrite"));
        assertThat(journal.getAll()).doesNotContain(fin.toString()).doesNotContain(DATE_FR.format(fin))
                .doesNotContain("paul.marin.trace").doesNotContain("Marin");
    }

    @Test
    @DisplayName("Rien ne part ni n'est tracé la veille de J-30")
    void rienAvantJMoins30() throws Exception {
        LocalDate examen = ancre(2);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca2@exemple.fr", "Marin", "Paul", examen);

        relances.executer(fin.minusDays(31));

        assertThat(messagerie.vers("paul.marin.ca2@exemple.fr")).isEmpty();
        assertThat(tracesVers("paul.marin.ca2@exemple.fr")).isZero();
    }

    @Test
    @DisplayName("Relance bientôt à F = D + 30, pas à F = D + 31, de bout en bout")
    void delaiDe30JoursDeBoutEnBout() throws Exception {
        LocalDate examen = ancre(12);
        LocalDate jour = examen.plusYears(1).minusDays(30);
        creerMoniteur("trente.ca33@exemple.fr", "Trente", "Paul", examen);
        creerMoniteur("trente.un.ca33@exemple.fr", "TrenteUn", "Paul", examen.plusDays(1));

        relances.executer(jour);

        assertThat(messagerie.vers("trente.ca33@exemple.fr")).hasSize(1);
        assertThat(messagerie.vers("trente.un.ca33@exemple.fr")).isEmpty();
    }

    @Test
    @DisplayName("Un moniteur jamais relancé à F − 12 reçoit l'e-mail bientôt")
    void rattrapageDansLaPeriode() throws Exception {
        LocalDate examen = ancre(4);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("rattrapage.ca4@exemple.fr", "Rattrapage", "Lucie", examen);

        relances.executer(fin.minusDays(12));

        List<Message> recus = messagerie.vers("rattrapage.ca4@exemple.fr");
        assertThat(recus).hasSize(1);
        assertThat(recus.getFirst().sujet()).isEqualTo("Votre CACI expire le " + DATE_FR.format(fin));
        assertThat(recus.getFirst().corps()).isEqualTo(corpsBientot("Lucie", fin));
    }

    @Test
    @DisplayName("Après le jour J, plus rien, même si le jour J a été manqué ou le CACI déjà expiré")
    void rienApresLeJourJ() throws Exception {
        LocalDate examen = ancre(6);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca6@exemple.fr", "Marin", "Paul", examen);
        relances.executer(fin.minusDays(30));
        relances.executer(fin);
        messagerie.vider();

        relances.executer(fin);
        relances.executer(fin.plusDays(1));
        assertThat(messagerie.vers("paul.marin.ca6@exemple.fr")).isEmpty();

        // Jour J manqué (aucune exécution le jour F) : pas de rattrapage le lendemain.
        LocalDate finManquee = examen.plusDays(3).plusYears(1);
        creerMoniteur("jour.manque2.ca6@exemple.fr", "Manque", "Hugo", examen.plusDays(3));
        relances.executer(finManquee.minusDays(30));
        messagerie.vider();
        relances.executer(finManquee.plusDays(1));
        assertThat(messagerie.vers("jour.manque2.ca6@exemple.fr")).isEmpty();

        // CACI expiré depuis 20 jours (comme Flora en démo) : rien.
        creerMoniteur("expire.ca6@exemple.fr", "Expire", "Flora", examen.plusDays(5));
        relances.executer(examen.plusDays(5).plusYears(1).plusDays(20));
        assertThat(messagerie.vers("expire.ca6@exemple.fr")).isEmpty();
    }

    @Test
    @DisplayName("Renouvelé entre J-30 et J : pas de jour J, relances de la nouvelle F")
    void renouveleEntreDeux() throws Exception {
        LocalDate examen = ancre(7);
        LocalDate fin = examen.plusYears(1);
        long paul = creerMoniteur("paul.marin.ca7@exemple.fr", "Marin", "Paul", examen);
        relances.executer(fin.minusDays(30));
        LocalDate nouvelExamen = fin.minusDays(21);
        LocalDate nouvelleFin = nouvelExamen.plusYears(1);
        modifierExamen(paul, "paul.marin.ca7@exemple.fr", "Marin", "Paul", nouvelExamen);
        messagerie.vider();

        relances.executer(fin);
        assertThat(messagerie.vers("paul.marin.ca7@exemple.fr")).isEmpty();

        relances.executer(nouvelleFin.minusDays(30));
        relances.executer(nouvelleFin);
        assertThat(messagerie.vers("paul.marin.ca7@exemple.fr")).extracting(Message::sujet).containsExactly(
                "Votre CACI expire le " + DATE_FR.format(nouvelleFin),
                "Votre CACI expire aujourd'hui, le " + DATE_FR.format(nouvelleFin));
    }

    @Test
    @DisplayName("Date d'examen corrigée dans la période : nouvelle relance bientôt, puis jour J de la nouvelle F, rien pour l'ancienne")
    void dateExamenCorrigee() throws Exception {
        LocalDate examen = ancre(8);
        LocalDate fin = examen.plusYears(1);
        long paul = creerMoniteur("paul.marin.ca8@exemple.fr", "Marin", "Paul", examen);
        LocalDate jour = fin.minusDays(30);
        relances.executer(jour);
        LocalDate examenCorrige = examen.minusDays(10);
        LocalDate finCorrigee = examenCorrige.plusYears(1);
        modifierExamen(paul, "paul.marin.ca8@exemple.fr", "Marin", "Paul", examenCorrige);
        messagerie.vider();

        relances.executer(jour.plusDays(1));
        relances.executer(finCorrigee);
        relances.executer(fin);

        assertThat(messagerie.vers("paul.marin.ca8@exemple.fr")).extracting(Message::sujet).containsExactly(
                "Votre CACI expire le " + DATE_FR.format(finCorrigee),
                "Votre CACI expire aujourd'hui, le " + DATE_FR.format(finCorrigee));
    }

    /** Nouvelle date d'examen saisie par presidente@club.fr dans l'écran Moniteurs. */
    private void modifierExamen(long id, String email, String nom, String prenom, LocalDate examen) throws Exception {
        mvc.perform(put("/api/admin/moniteurs/" + id).header("Authorization", jeton("presidente@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"%s","prenom":"%s","niveauEncadrement":"E2",
                                 "caciDateExamen":"%s","caciMedecin":"FEDERAL","caciActivites":["ENSEMBLE_ACTIVITES"]}"""
                                .formatted(email, nom, prenom, examen)))
                .andExpect(status().isOk());
    }

    private static String corpsJourJ(String prenom, LocalDate fin) {
        return """
                Bonjour %s,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au %s, c'est-à-dire aujourd'hui. À partir de demain, il sera expiré.
                Remettez le nouveau certificat à un administrateur du club.

                Message envoyé automatiquement par le suivi des formations du club.""".formatted(prenom, DATE_FR.format(fin));
    }

    private int tracesVers(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM relance_caci_envoi WHERE destinataire_email = ?",
                Integer.class, email);
    }
}
