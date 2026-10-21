package fr.club.plongee.notification.relance;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.notification.relance.FausseMessagerie.Boite;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import static fr.club.plongee.commun.Calendrier.DATE_FR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Trace des relances CACI : consultation par {@code GET /api/admin/relances-caci}
 * (ADMIN seulement, R21), contenu (R19) et conservation 2 ans (R20), purge des
 * relances faites qui ne servent plus.
 *
 * <p>Même configuration que {@link RelancesCaciMoniteursTest} (un seul
 * contexte, base H2 à part). Ancres treize ans en arrière, 60 jours d'écart :
 * avant celles des autres classes des relances (huit et trois ans en arrière),
 * pour que la purge d'un test d'ici ne touche que des lignes plus anciennes, et
 * loin de la démo. Les personnes sans CACI et les administrateurs des autres
 * tests restent dans la base : les contrôles portent sur les lignes de chaque
 * test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:relances-caci;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
@Import(FausseMessagerie.class)
@ExtendWith(OutputCaptureExtension.class)
class TraceRelancesCaciTest {

    private static final String CLAIRE = "presidente@club.fr";
    private static final String TRACE = "/api/admin/relances-caci";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Boite messagerie;
    @Autowired RelancesCaciService relances;

    @BeforeEach
    void viderLaMessagerie() {
        messagerie.vider();
    }

    /** Ancre propre au test n : treize ans en arrière, puis 60 jours d'écart entre deux tests. */
    private static LocalDate ancre(int n) {
        return Calendrier.aujourdhui().minusYears(13).plusDays(60L * n);
    }

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** Compte créé par presidente@club.fr dans l'écran Moniteurs ; {@code examen} nul : pas de CACI. */
    private long creerMoniteur(String email, String nom, String prenom, LocalDate examen) throws Exception {
        String caci = examen == null ? "" : """
                "caciDateExamen":"%s","caciMedecin":"FEDERAL","caciActivites":["ENSEMBLE_ACTIVITES"],""".formatted(examen);
        String reponse = mvc.perform(post("/api/admin/moniteurs").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"%s","prenom":"%s",%s"niveauEncadrement":"E2"}"""
                                .formatted(email, nom, prenom, caci)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    /** La trace telle que la lit presidente@club.fr. */
    private JsonNode lireTrace() throws Exception {
        String reponse = mvc.perform(get(TRACE).header("Authorization", jeton(CLAIRE)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    /** Lignes de trace dont cette adresse est destinataire, dans l'ordre de la réponse. */
    private static List<JsonNode> vers(JsonNode trace, String email) {
        return trace.valueStream().filter(l -> l.get("destinataireEmail").asText().equals(email)).toList();
    }

    @Test
    @DisplayName("Un administrateur lit la trace, du plus récent au plus ancien")
    void consultationParLAdministrateur() throws Exception {
        LocalDate examen = ancre(1);
        LocalDate fin = examen.plusYears(1);
        creerMoniteur("paul.marin.ca27@exemple.fr", "Marin", "Paul", examen);
        relances.executer(fin.minusDays(30));
        relances.executer(fin);

        JsonNode trace = lireTrace();

        assertThat(vers(trace, "paul.marin.ca27@exemple.fr")).extracting(l -> l.get("envoyeLe").asText())
                .containsExactly(fin.toString(), fin.minusDays(30).toString());
        List<LocalDate> dates = trace.valueStream().map(l -> LocalDate.parse(l.get("envoyeLe").asText())).toList();
        assertThat(dates).isSortedAccordingTo(Comparator.reverseOrder());
    }

    /** Élève de la saison ouverte (formation N1), créé et inscrit par presidente@club.fr comme dans les écrans. */
    private void creerEleveDeLaSaison(String nom, String prenom, LocalDate examen) throws Exception {
        String reponse = mvc.perform(post("/api/eleves").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"%s","prenom":"%s","caciDateExamen":"%s","caciMedecin":"FEDERAL",
                                 "caciActivites":["ENSEMBLE_ACTIVITES"],"autorisationLegale":true}"""
                                .formatted(nom, prenom, examen)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long saison = jdbc.queryForObject(
                "SELECT id FROM saison WHERE ouverte = TRUE ORDER BY date_debut DESC LIMIT 1", Long.class);
        mvc.perform(post("/api/cursus").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"eleveId\":%d,\"saisonId\":%d,\"niveau\":\"N1\"}"
                                .formatted(json.readTree(reponse).get("id").asLong(), saison)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("La trace ne renvoie que date, destinataire et noms des personnes concernées")
    void contenuDeLaTrace() throws Exception {
        LocalDate jour = ancre(2);
        LocalDate finEleve = jour.plusDays(30);
        creerEleveDeLaSaison("LemaireTrace", "Hugo", finEleve.minusYears(1));
        creerMoniteur("paul.marin.ca25@exemple.fr", "MarinTrace", "Paul", jour.minusYears(1));
        creerMoniteur("tom.vidal.ca25@exemple.fr", "VidalTrace", "Tom", null);
        relances.executer(jour.minusDays(30));
        relances.executer(jour);

        String brut = mvc.perform(get(TRACE).header("Authorization", jeton(CLAIRE)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode trace = json.readTree(brut);

        trace.valueStream().forEach(ligne -> {
            assertThat(ligne.propertyNames()).containsExactlyInAnyOrder(
                    "envoyeLe", "destinataireNom", "destinatairePrenom", "destinataireEmail", "personnes");
            ligne.get("personnes").valueStream()
                    .forEach(p -> assertThat(p.propertyNames()).containsExactlyInAnyOrder("nom", "prenom"));
        });
        JsonNode recapitulatif = vers(trace, CLAIRE).stream()
                .filter(l -> l.get("envoyeLe").asText().equals(jour.toString())).findFirst().orElseThrow();
        assertThat(recapitulatif.get("destinataireNom").asText()).isNotBlank();
        assertThat(recapitulatif.get("personnes").valueStream()
                .map(p -> p.get("nom").asText() + " " + p.get("prenom").asText()).toList())
                .contains("LemaireTrace Hugo", "MarinTrace Paul", "VidalTrace Tom");
        // Ni F de l'élève, ni date d'examen, ni médecin, ni case, ni mention, ni texte de l'e-mail.
        assertThat(brut).doesNotContain(finEleve.toString(), finEleve.minusYears(1).toString(),
                jour.minusYears(1).toString(), DATE_FR.format(finEleve), "FEDERAL", "ENSEMBLE",
                "élève", "eleve\"", "moniteur\"", "CACI", "Bonjour", "fin", "valid", "sujet", "corps");
    }

    @Test
    @DisplayName("Une trace est encore lue le jour de ses deux ans, plus le lendemain")
    void effaceeApresDeuxAns() throws Exception {
        LocalDate examen = ancre(3);
        LocalDate envoi = examen.plusYears(1).minusDays(30);
        creerMoniteur("paul.marin.ca26@exemple.fr", "Marin", "Paul", examen);
        relances.executer(envoi);
        assertThat(vers(lireTrace(), "paul.marin.ca26@exemple.fr")).hasSize(1);

        relances.executer(envoi.plusYears(2));
        assertThat(vers(lireTrace(), "paul.marin.ca26@exemple.fr")).hasSize(1);

        relances.executer(envoi.plusYears(2).plusDays(1));
        assertThat(vers(lireTrace(), "paul.marin.ca26@exemple.fr")).isEmpty();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM relance_caci_envoi_personne p
                 WHERE NOT EXISTS (SELECT 1 FROM relance_caci_envoi e WHERE e.id = p.envoi_id)""", Integer.class))
                .isZero();
    }

    private int relancesFaites(long utilisateur) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM relance_caci_faite WHERE utilisateur_id = ?",
                Integer.class, utilisateur);
    }

    @Test
    @DisplayName("Les relances faites pour une fin de validité sont effacées dès le lendemain de cette fin")
    void relancesFaitesEffaceesApresF() throws Exception {
        LocalDate examen = ancre(4);
        LocalDate fin = examen.plusYears(1);
        long paul = creerMoniteur("paul.marin.purge@exemple.fr", "Marin", "Paul", examen);
        relances.executer(fin.minusDays(30));
        relances.executer(fin);
        assertThat(relancesFaites(paul)).isEqualTo(2);

        relances.executer(fin);
        assertThat(relancesFaites(paul)).isEqualTo(2);

        relances.executer(fin.plusDays(1));
        assertThat(relancesFaites(paul)).isZero();
    }

    @Test
    @DisplayName("Une citation « Sans CACI renseigné » est effacée quand elle sort des 7 jours de R12")
    void citationSansCaciEffaceeApresSeptJours() throws Exception {
        LocalDate examen = ancre(5);
        LocalDate jour = examen.plusYears(1).minusDays(30);
        creerMoniteur("paul.marin.sanscaci@exemple.fr", "Marin", "Paul", examen);
        long tom = creerMoniteur("tom.vidal.sanscaci@exemple.fr", "VidalSemaine", "Tom", null);
        relances.executer(jour);
        String citeLe = "SELECT COUNT(*) FROM relance_caci_faite WHERE utilisateur_id = ? AND faite_le = ?";
        assertThat(jdbc.queryForObject(citeLe, Integer.class, tom, jour)).isEqualTo(1);

        relances.executer(jour.plusDays(6));
        assertThat(jdbc.queryForObject(citeLe, Integer.class, tom, jour)).isEqualTo(1);

        relances.executer(jour.plusDays(7));
        assertThat(jdbc.queryForObject(citeLe, Integer.class, tom, jour)).isZero();
    }

    @Test
    @DisplayName("Purge impossible : les relances du jour partent quand même, journal sans nom, adresse ni date de CACI")
    void purgeEnEchecNArretePasLesRelances(CapturedOutput journal) throws Exception {
        LocalDate examen = ancre(6);
        LocalDate ancienEnvoi = examen.plusYears(1).minusDays(30);
        long ancien = creerMoniteur("ancien.purge@exemple.fr", "AncienPurge", "Paul", examen);
        relances.executer(ancienEnvoi);
        LocalDate examenSuivant = examen.plusYears(2).plusDays(1);
        LocalDate jour = examenSuivant.plusYears(1).minusDays(30);
        creerMoniteur("suivant.purge@exemple.fr", "SuivantPurge", "Lucie", examenSuivant);
        // Une ligne qui référence la vieille trace et la relance faite : leurs suppressions échouent.
        jdbc.execute("CREATE TABLE blocage_purge_trace (envoi_id BIGINT REFERENCES relance_caci_envoi(id))");
        jdbc.execute("CREATE TABLE blocage_purge_faite (faite_id BIGINT REFERENCES relance_caci_faite(id))");
        try {
            jdbc.update("INSERT INTO blocage_purge_trace SELECT id FROM relance_caci_envoi WHERE destinataire_email = ?",
                    "ancien.purge@exemple.fr");
            jdbc.update("INSERT INTO blocage_purge_faite SELECT id FROM relance_caci_faite WHERE utilisateur_id = ?",
                    ancien);

            relances.executer(jour);
        } finally {
            jdbc.execute("DROP TABLE blocage_purge_trace");
            jdbc.execute("DROP TABLE blocage_purge_faite");
        }

        assertThat(messagerie.vers("suivant.purge@exemple.fr")).hasSize(1);
        JsonNode trace = lireTrace();
        assertThat(vers(trace, "suivant.purge@exemple.fr")).hasSize(1);
        assertThat(vers(trace, "ancien.purge@exemple.fr")).hasSize(1);
        List<String> lignes = journal.getOut().lines().filter(l -> l.contains("Relances CACI du")).toList();
        assertThat(lignes).anyMatch(l -> l.contains("Relances CACI du " + DATE_FR.format(jour)
                + " : la purge de la trace n'a pas pu être faite"));
        assertThat(lignes).anyMatch(l -> l.contains("Relances CACI du " + DATE_FR.format(jour)
                + " : la purge des relances faites n'a pas pu être faite"));
        LocalDate ancienneFin = examen.plusYears(1);
        assertThat(journal.getAll()).doesNotContain("AncienPurge").doesNotContain("ancien.purge")
                .doesNotContain(ancienneFin.toString()).doesNotContain(DATE_FR.format(ancienneFin));
    }

    @Test
    @DisplayName("403 pour moniteur, TIV, sécurité surface et élève ; 401 sans jeton")
    void refusDeRole() throws Exception {
        for (String compte : List.of("e1@club.fr", "e2@club.fr", "surface@club.fr", "eleve@club.fr")) {
            mvc.perform(get(TRACE).header("Authorization", jeton(compte))).andExpect(status().isForbidden());
        }
        mvc.perform(get(TRACE)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Ni le niveau E3 ni le rôle de directeur technique ne donnent accès à la trace")
    void niNiveauNiDirecteurTechnique() throws Exception {
        mvc.perform(get(TRACE).header("Authorization", jeton("e3@club.fr"))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST, PUT et DELETE sur la trace ne sont jamais acceptés et ne la changent pas")
    void niEcritureNiDeclenchement() throws Exception {
        String avant = mvc.perform(get(TRACE).header("Authorization", jeton(CLAIRE)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        for (var requete : List.of(post(TRACE), put(TRACE), delete(TRACE))) {
            int statut = mvc.perform(requete.header("Authorization", jeton(CLAIRE))
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andReturn().getResponse().getStatus();
            assertThat(statut).as(requete.toString()).isIn(404, 405);
        }

        assertThat(mvc.perform(get(TRACE).header("Authorization", jeton(CLAIRE)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).isEqualTo(avant);
        assertThat(messagerie.tous()).isEmpty();
    }
}
