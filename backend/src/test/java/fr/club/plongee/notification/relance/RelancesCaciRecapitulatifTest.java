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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static fr.club.plongee.commun.Calendrier.DATE_FR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Récapitulatif des relances CACI aux administrateurs, élèves compris, de
 * bout en bout : élèves et comptes créés par presidente@club.fr comme dans les
 * écrans, traitement appelé avec un jour D choisi, e-mails lus dans une
 * fausse messagerie.
 *
 * <p>Même configuration que {@link RelancesCaciMoniteursTest} (un seul
 * contexte, base H2 à part). Ancres huit ans en arrière, 45 jours d'écart :
 * loin de celles des moniteurs (trois ans en arrière, jusqu'au jour du
 * lancement) et de la démo, et sans chevauchement de fenêtre de 30 jours
 * entre deux tests. Les personnes sans CACI d'un test (et Tiago, de la démo)
 * restent dans la base et peuvent être citées par le récapitulatif d'un autre
 * test : les contrôles portent sur les lignes de chaque test, pas sur le
 * corps entier (le texte exact est figé par {@code TextesRelancesCaciTest}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:relances-caci;DB_CLOSE_DELAY=-1;MODE=PostgreSQL")
@Import(FausseMessagerie.class)
@ExtendWith(OutputCaptureExtension.class)
class RelancesCaciRecapitulatifTest {

    private static final String CLAIRE = "presidente@club.fr";
    private static final String BIENTOT = "CACI qui expirent bientôt :";
    private static final String AUJOURDHUI = "CACI qui expirent aujourd'hui :";
    private static final String SANS_CACI = "Sans CACI renseigné :";
    private static final String INJOIGNABLES = "Moniteurs que l'e-mail de relance n'a pas pu joindre :";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired Boite messagerie;
    @Autowired RelancesCaciService relances;

    @BeforeEach
    void viderLaMessagerie() {
        messagerie.vider();
    }

    /** Ancre propre au test n : huit ans en arrière, puis 45 jours d'écart entre deux tests. */
    private static LocalDate ancre(int n) {
        return Calendrier.aujourdhui().minusYears(8).plusDays(45L * n);
    }

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** Élève créé par presidente@club.fr ; {@code examen} nul : pas de CACI. */
    private long creerEleve(String nom, String prenom, LocalDate examen, String email) throws Exception {
        String caci = examen == null ? "" : """
                "caciDateExamen":"%s","caciMedecin":"FEDERAL","caciActivites":["ENSEMBLE_ACTIVITES"],""".formatted(examen);
        String adresse = email == null ? "" : "\"email\":\"%s\",".formatted(email);
        String reponse = mvc.perform(post("/api/eleves").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"%s","prenom":"%s",%s%s"autorisationLegale":true}"""
                                .formatted(nom, prenom, caci, adresse)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    /** Inscription en formation N1, comme dans l'écran Élèves. */
    private void inscrire(long eleve, long saison) throws Exception {
        mvc.perform(post("/api/cursus").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eleveId\":%d,\"saisonId\":%d,\"niveau\":\"N1\"}".formatted(eleve, saison)))
                .andExpect(status().isCreated());
    }

    /** La saison ouverte la plus récente (2026-2027 en démo). */
    private long saisonOuverte() {
        return jdbc.queryForObject("SELECT id FROM saison WHERE ouverte = TRUE ORDER BY date_debut DESC LIMIT 1",
                Long.class);
    }

    /** Récapitulatifs reçus par cette adresse. */
    private List<Message> recapitulatifsVers(String adresse) {
        return messagerie.vers(adresse).stream().filter(m -> m.sujet().startsWith("CACI à suivre : ")).toList();
    }

    /** Lignes d'une rubrique du corps (vide si la rubrique est omise). */
    private static List<String> rubrique(String corps, String titre) {
        List<String> lignes = new ArrayList<>();
        boolean dedans = false;
        for (String ligne : corps.lines().toList()) {
            if (ligne.equals(titre)) dedans = true;
            else if (dedans && ligne.startsWith("- ")) lignes.add(ligne);
            else if (dedans) break;
        }
        return lignes;
    }

    /** Compte créé par presidente@club.fr dans l'écran Moniteurs ; {@code examen} nul : pas de CACI. */
    private long creerMoniteur(String email, String nom, String prenom, LocalDate examen, boolean admin)
            throws Exception {
        String caci = examen == null ? "" : """
                "caciDateExamen":"%s","caciMedecin":"FEDERAL","caciActivites":["ENSEMBLE_ACTIVITES"],""".formatted(examen);
        String reponse = mvc.perform(post("/api/admin/moniteurs").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"%s","prenom":"%s","niveauEncadrement":"E2",%s"admin":%s}"""
                                .formatted(email, nom, prenom, caci, admin)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    /** Personnes concernées des traces dont l'adresse est destinataire ce jour-là, dans l'ordre. */
    private List<List<String>> tracesVers(String email, LocalDate jour) {
        List<Long> envois = jdbc.queryForList(
                "SELECT id FROM relance_caci_envoi WHERE destinataire_email = ? AND envoye_le = ? ORDER BY id",
                Long.class, email, jour);
        return envois.stream().map(id -> jdbc.queryForList(
                "SELECT nom || ' ' || prenom FROM relance_caci_envoi_personne WHERE envoi_id = ? ORDER BY ordre",
                String.class, id)).toList();
    }

    @Test
    @DisplayName("Claire reçoit un récapitulatif avec les lignes de chaque rubrique")
    void recapitulatifDeBoutEnBout() throws Exception {
        LocalDate jour = ancre(3);
        inscrire(creerEleve("Lemaire", "Hugo", jour.plusDays(30).minusYears(1), null), saisonOuverte());
        creerMoniteur("paul.marin.ca15@exemple.fr", "Marin", "Paul", jour.minusYears(1), false);
        creerMoniteur("tom.vidal.ca15@exemple.fr", "Vidal", "Tom", null, false);

        relances.executer(jour);

        Message recap = recapitulatifsVers(CLAIRE).getFirst();
        assertThat(recapitulatifsVers(CLAIRE)).hasSize(1);
        assertThat(recap.sujet()).isEqualTo("CACI à suivre : récapitulatif du " + DATE_FR.format(jour));
        assertThat(recap.corps()).startsWith("Bonjour Claire,\n\nVoici les CACI à suivre au " + DATE_FR.format(jour) + ".\n\n");
        assertThat(rubrique(recap.corps(), BIENTOT))
                .containsExactly("- Lemaire Hugo, élève, valable jusqu'au " + DATE_FR.format(jour.plusDays(30)));
        assertThat(rubrique(recap.corps(), AUJOURDHUI))
                .containsExactly("- Marin Paul, moniteur, valable jusqu'au " + DATE_FR.format(jour));
        assertThat(rubrique(recap.corps(), SANS_CACI)).contains("- Vidal Tom, moniteur");
        assertThat(recap.corps()).doesNotContain(INJOIGNABLES);
        // R19 : une ligne de trace pour Claire, qui cite les personnes des trois rubriques.
        assertThat(tracesVers(CLAIRE, jour)).singleElement()
                .satisfies(personnes -> assertThat(personnes).contains("Lemaire Hugo", "Marin Paul", "Vidal Tom"));
    }

    @Test
    @DisplayName("Une personne sans CACI n'est citée qu'une fois sur 7 jours, même si le traitement repasse le même jour")
    void sansCaciUneFoisParSemaine() throws Exception {
        LocalDate jour = ancre(4);
        creerMoniteur("tom.vidal.ca17@exemple.fr", "Vidalsept", "Tom", null, false);
        // Un moniteur injoignable reste dû chaque jour de sa période : un récapitulatif part chaque jour.
        creerMoniteur("injoignable.ca17@exemple.fr", "Injoignable", "Paul", jour.plusDays(30).minusYears(1), false);
        messagerie.refuser("injoignable.ca17@exemple.fr");
        String ligne = "- Vidalsept Tom, moniteur";

        relances.executer(jour);
        assertThat(rubrique(recapitulatifsVers(CLAIRE).getFirst().corps(), SANS_CACI)).contains(ligne);

        for (LocalDate d : List.of(jour, jour.plusDays(1), jour.plusDays(6))) {
            messagerie.vider();
            messagerie.refuser("injoignable.ca17@exemple.fr");
            relances.executer(d);
            assertThat(recapitulatifsVers(CLAIRE)).as("récapitulatif du %s", d).singleElement()
                    .satisfies(m -> assertThat(rubrique(m.corps(), SANS_CACI)).doesNotContain(ligne));
        }

        messagerie.vider();
        messagerie.refuser("injoignable.ca17@exemple.fr");
        relances.executer(jour.plusDays(7));
        assertThat(rubrique(recapitulatifsVers(CLAIRE).getFirst().corps(), SANS_CACI)).contains(ligne);
    }

    @Test
    @DisplayName("Le moniteur injoignable figure dans sa rubrique du récapitulatif")
    void moniteurInjoignableAuRecapitulatif(CapturedOutput journal) throws Exception {
        LocalDate jour = ancre(5);
        LocalDate fin = jour.plusDays(30);
        creerMoniteur("paul.marin.ca21r@exemple.fr", "Marin", "Paul", fin.minusYears(1), false);
        creerMoniteur("autre.ca21r@exemple.fr", "Autre", "Lucie", fin.minusYears(1), false);
        messagerie.refuser("paul.marin.ca21r@exemple.fr");

        relances.executer(jour);

        assertThat(messagerie.vers("autre.ca21r@exemple.fr")).hasSize(1);
        assertThat(recapitulatifsVers(CLAIRE)).singleElement()
                .satisfies(m -> assertThat(rubrique(m.corps(), INJOIGNABLES)).containsExactly("- Marin Paul"));
        assertThat(journal.getOut()).contains(
                "Relances CACI du " + DATE_FR.format(jour) + " : un e-mail de relance à un moniteur n'a pas pu partir.");

        messagerie.accepter("paul.marin.ca21r@exemple.fr");
        relances.executer(jour.plusDays(1));
        assertThat(messagerie.vers("paul.marin.ca21r@exemple.fr")).extracting(Message::sujet)
                .containsExactly("Votre CACI expire le " + DATE_FR.format(fin));
    }

    /** Récapitulatifs partis, toutes adresses confondues. */
    private List<Message> recapitulatifs() {
        return messagerie.tous().stream().filter(m -> m.sujet().startsWith("CACI à suivre : ")).toList();
    }

    /** Lignes du journal des relances (« Relances CACI du … »). */
    private static List<String> lignesDuJournal(CapturedOutput journal) {
        return journal.getOut().lines().filter(l -> l.contains("Relances CACI du")).toList();
    }

    @Test
    @DisplayName("Sans administrateur actif : le moniteur est relancé, l'erreur est journalisée sans nom, l'élève reste dû")
    void sansAdministrateurActif(CapturedOutput journal) throws Exception {
        LocalDate jour = ancre(6);
        LocalDate fin = jour.plusDays(30);
        creerMoniteur("paul.marin.ca20@exemple.fr", "Marin", "Paul", fin.minusYears(1), false);
        inscrire(creerEleve("Lemaire", "Hugo", fin.minusYears(1), null), saisonOuverte());
        // Pas de route pour retirer le dernier administrateur : désactivés en base, remis en place après.
        List<Long> admins = jdbc.queryForList("""
                SELECT u.id FROM utilisateur u JOIN utilisateur_role r ON r.utilisateur_id = u.id
                 WHERE r.role = 'ADMIN' AND u.actif = TRUE""", Long.class);
        try {
            admins.forEach(id -> jdbc.update("UPDATE utilisateur SET actif = FALSE WHERE id = ?", id));

            relances.executer(jour);
        } finally {
            admins.forEach(id -> jdbc.update("UPDATE utilisateur SET actif = TRUE WHERE id = ?", id));
        }

        assertThat(messagerie.vers("paul.marin.ca20@exemple.fr")).hasSize(1);
        assertThat(recapitulatifs()).isEmpty();
        assertThat(lignesDuJournal(journal)).anyMatch(l -> l.endsWith(
                "Relances CACI du " + DATE_FR.format(jour) + " : aucun administrateur actif, récapitulatif non envoyé."));
        assertThat(lignesDuJournal(journal)).noneMatch(l -> l.contains("Marin") || l.contains("Lemaire")
                || l.contains("@") || l.contains(DATE_FR.format(fin)));

        relances.executer(jour.plusDays(1));
        assertThat(recapitulatifsVers(CLAIRE)).singleElement().satisfies(m -> assertThat(rubrique(m.corps(), BIENTOT))
                .containsExactly("- Lemaire Hugo, élève, valable jusqu'au " + DATE_FR.format(fin)));
    }

    @Test
    @DisplayName("Récapitulatif refusé partout : erreur journalisée, élèves cités le lendemain, une seule trace")
    void recapitulatifRefusePartout(CapturedOutput journal) throws Exception {
        LocalDate jour = ancre(7);
        LocalDate fin = jour.plusDays(30);
        inscrire(creerEleve("Lemaire", "Hugo", fin.minusYears(1), null), saisonOuverte());
        messagerie.refuser(CLAIRE);

        relances.executer(jour);

        assertThat(lignesDuJournal(journal)).anyMatch(l -> l.endsWith(
                "Relances CACI du " + DATE_FR.format(jour) + " : récapitulatif refusé pour tous les administrateurs."));
        assertThat(lignesDuJournal(journal)).noneMatch(l -> l.contains("Lemaire") || l.contains("Ferrand")
                || l.contains("@") || l.contains(DATE_FR.format(fin)));

        messagerie.accepter(CLAIRE);
        relances.executer(jour.plusDays(1));

        assertThat(recapitulatifsVers(CLAIRE)).singleElement().satisfies(m -> assertThat(rubrique(m.corps(), BIENTOT))
                .containsExactly("- Lemaire Hugo, élève, valable jusqu'au " + DATE_FR.format(fin)));
        assertThat(jdbc.queryForList("""
                SELECT envoye_le FROM relance_caci_envoi
                 WHERE destinataire_email = ? AND envoye_le BETWEEN ? AND ?""",
                LocalDate.class, CLAIRE, jour, jour.plusDays(1))).containsExactly(jour.plusDays(1));
    }

    @Test
    @DisplayName("Un moniteur sans CACI ne reçoit rien et figure sous Sans CACI renseigné")
    void moniteurSansCaci() throws Exception {
        LocalDate jour = ancre(8);
        creerMoniteur("sans.caci.ca10@exemple.fr", "Sanscaci", "Tiago", null, false);
        creerMoniteur("paul.marin.ca10@exemple.fr", "Marin", "Paul", jour.plusDays(30).minusYears(1), false);

        relances.executer(jour);

        assertThat(messagerie.vers("sans.caci.ca10@exemple.fr")).isEmpty();
        assertThat(recapitulatifsVers(CLAIRE)).singleElement()
                .satisfies(m -> assertThat(rubrique(m.corps(), SANS_CACI)).contains("- Sanscaci Tiago, moniteur"));
    }

    @Test
    @DisplayName("Un élève ne reçoit jamais d'e-mail, même avec une adresse")
    void eleveJamaisEcrit() throws Exception {
        LocalDate jour = ancre(9);
        LocalDate fin = jour.plusDays(30);
        inscrire(creerEleve("Testeleve", "Eva", fin.minusYears(1), "eleve.test@exemple.fr"), saisonOuverte());

        relances.executer(jour);
        relances.executer(fin);

        assertThat(recapitulatifsVers(CLAIRE)).hasSize(2);
        assertThat(messagerie.vers("eleve.test@exemple.fr")).isEmpty();
    }

    @Test
    @DisplayName("Moniteur aussi élève de la saison : une seule relance, de moniteur")
    void moniteurAussiEleve() throws Exception {
        LocalDate jour = ancre(10);
        LocalDate fin = jour.plusDays(30);
        long paul = creerMoniteur("paul.marin.ca14@exemple.fr", "Marin", "Paul", fin.minusYears(1), false);
        long dossier = creerEleve("Marin", "Paul", fin.plusDays(5).minusYears(1), null);
        inscrire(dossier, saisonOuverte());
        // Pas de route pour rattacher un dossier élève à un compte : posé en base.
        jdbc.update("UPDATE eleve SET utilisateur_id = ? WHERE id = ?", paul, dossier);

        relances.executer(jour);

        assertThat(messagerie.vers("paul.marin.ca14@exemple.fr")).extracting(Message::sujet)
                .containsExactly("Votre CACI expire le " + DATE_FR.format(fin));
        assertThat(recapitulatifsVers(CLAIRE)).singleElement().satisfies(m -> assertThat(
                m.corps().lines().filter(l -> l.contains("Marin Paul")).toList())
                .containsExactly("- Marin Paul, moniteur, valable jusqu'au " + DATE_FR.format(fin)));

        messagerie.vider();
        relances.executer(jour.plusDays(5));
        assertThat(messagerie.tous()).noneMatch(m -> m.adresse().equals("paul.marin.ca14@exemple.fr")
                || m.corps().contains("Marin Paul"));
    }

    @Test
    @DisplayName("Sans relance due, pas de récapitulatif même s'il y a des personnes sans CACI")
    void pasDeRecapitulatifSansEcheance() throws Exception {
        LocalDate jour = ancre(11);
        creerMoniteur("sans.caci.ca16@exemple.fr", "Sanscaciseize", "Tom", null, false);
        creerEleve("Sanscaci", "Eleve", null, null);

        relances.executer(jour);

        assertThat(recapitulatifs()).isEmpty();
    }

    @Test
    @DisplayName("Chaque administrateur actif reçoit le sien ; ni le compte désactivé ni le directeur technique non ADMIN")
    void unRecapitulatifParAdministrateurActif() throws Exception {
        LocalDate jour = ancre(12);
        creerMoniteur("paul.marin.ca18@exemple.fr", "Marin", "Paul", jour.plusDays(30).minusYears(1), false);
        long ines = creerMoniteur("ines.admin.ca18@exemple.fr", "Admin", "Ines", Calendrier.aujourdhui(), true);
        long desactive = creerMoniteur("desactive.admin.ca18@exemple.fr", "Desactive", "Remi",
                Calendrier.aujourdhui(), true);
        try {
            mvc.perform(put("/api/admin/moniteurs/" + desactive + "/activation")
                            .header("Authorization", jeton(CLAIRE))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                    .andExpect(status().isOk());

            relances.executer(jour);

            assertThat(recapitulatifs()).extracting(Message::adresse)
                    .containsExactlyInAnyOrder(CLAIRE, "ines.admin.ca18@exemple.fr");
            assertThat(recapitulatifsVers(CLAIRE).getFirst().corps()).startsWith("Bonjour Claire,\n");
            assertThat(recapitulatifsVers("ines.admin.ca18@exemple.fr").getFirst().corps()).startsWith("Bonjour Ines,\n");
            assertThat(messagerie.vers("e3@club.fr")).isEmpty();
            assertThat(messagerie.vers("desactive.admin.ca18@exemple.fr")).isEmpty();
        } finally {
            desactiver(ines);
        }
    }

    /** Remet la base dans l'état attendu par les autres tests : Claire seule administratrice active. */
    private void desactiver(long compte) {
        jdbc.update("UPDATE utilisateur SET actif = FALSE WHERE id = ?", compte);
    }

    @Test
    @DisplayName("Un administrateur moniteur reçoit son e-mail de moniteur et le récapitulatif")
    void administrateurMoniteur() throws Exception {
        LocalDate jour = ancre(13);
        LocalDate fin = jour.plusDays(30);
        long sacha = creerMoniteur("sacha.admin.ca19@exemple.fr", "Adminmoniteur", "Sacha", fin.minusYears(1), true);
        try {
            relances.executer(jour);

            assertThat(messagerie.vers("sacha.admin.ca19@exemple.fr")).extracting(Message::sujet).containsExactly(
                    "Votre CACI expire le " + DATE_FR.format(fin),
                    "CACI à suivre : récapitulatif du " + DATE_FR.format(jour));
            assertThat(rubrique(recapitulatifsVers("sacha.admin.ca19@exemple.fr").getFirst().corps(), BIENTOT))
                    .containsExactly("- Adminmoniteur Sacha, moniteur, valable jusqu'au " + DATE_FR.format(fin));
        } finally {
            desactiver(sacha);
        }
    }

    @Test
    @DisplayName("Récapitulatif reçu par un seul administrateur : l'élève compte comme relancé")
    void recapitulatifRecuParUnSeul() throws Exception {
        LocalDate jour = ancre(14);
        LocalDate fin = jour.plusDays(30);
        inscrire(creerEleve("Lemaire", "Hugo", fin.minusYears(1), null), saisonOuverte());
        // Relance due le lendemain, pour qu'un récapitulatif parte aussi ce jour-là.
        creerMoniteur("lendemain.ca23@exemple.fr", "Lendemain", "Paul", fin.plusDays(1).minusYears(1), false);
        long ines = creerMoniteur("ines.admin.ca23@exemple.fr", "Admin", "Ines", Calendrier.aujourdhui(), true);
        try {
            messagerie.refuser("ines.admin.ca23@exemple.fr");
            relances.executer(jour);
            assertThat(recapitulatifsVers(CLAIRE)).hasSize(1);

            messagerie.vider();
            relances.executer(jour.plusDays(1));

            assertThat(recapitulatifsVers(CLAIRE)).singleElement().satisfies(m -> {
                assertThat(rubrique(m.corps(), BIENTOT)).contains(
                        "- Lendemain Paul, moniteur, valable jusqu'au " + DATE_FR.format(fin.plusDays(1)));
                assertThat(m.corps()).doesNotContain("Lemaire Hugo");
            });
        } finally {
            desactiver(ines);
        }
    }

    @Test
    @DisplayName("Aucun e-mail ne contient la date d'examen, le médecin, les cases, la licence, la naissance, le téléphone, le contact d'urgence, ni l'adresse d'un autre")
    void aucunContenuDuCertificat() throws Exception {
        LocalDate jour = ancre(15);
        LocalDate examen = jour.plusDays(30).minusYears(1);
        mvc.perform(post("/api/admin/moniteurs").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"paul.marin.ca24@exemple.fr","nom":"Marin","prenom":"Paul","niveauEncadrement":"E2",
                                 "numeroLicence":"A-99-024001","caciDateExamen":"%s","caciMedecin":"FEDERAL",
                                 "caciActivites":["ENSEMBLE_ACTIVITES","COMPETITION","LIMITES_PRECONISATIONS"]}"""
                                .formatted(examen)))
                .andExpect(status().isCreated());
        String eleve = mvc.perform(post("/api/eleves").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Lemaire","prenom":"Hugo","dateNaissance":"2011-03-14","numeroLicence":"A-99-024002",
                                 "caciDateExamen":"%s","caciMedecin":"FEDERAL",
                                 "caciActivites":["ENSEMBLE_ACTIVITES","COMPETITION","LIMITES_PRECONISATIONS"],
                                 "email":"hugo.ca24@exemple.fr","telephone":"0600000024",
                                 "contactUrgenceNom":"Urgencenom Mireille","contactUrgenceTelephone":"0600000025",
                                 "autorisationLegale":true}""".formatted(examen)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        inscrire(json.readTree(eleve).get("id").asLong(), saisonOuverte());

        relances.executer(jour);

        List<String> interdits = List.of(DATE_FR.format(examen), examen.toString(),
                examen.format(java.time.format.DateTimeFormatter.ofPattern("d/M/yyyy")),
                examen.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yy")),
                "fédéral", "federal", "compétition", "competition", "limites", "préconisation", "preconisation",
                "A-99-024001", "A-99-024002", "14/03/2011", "2011-03-14", "0600000024", "0600000025", "Urgencenom");
        List<String> adresses = List.of("paul.marin.ca24@exemple.fr", "hugo.ca24@exemple.fr", CLAIRE);
        assertThat(messagerie.vers("paul.marin.ca24@exemple.fr")).hasSize(1);
        assertThat(recapitulatifsVers(CLAIRE)).hasSize(1);
        for (Message m : messagerie.tous()) {
            String texte = (m.sujet() + "\n" + m.corps()).toLowerCase();
            assertThat(interdits).allSatisfy(i -> assertThat(texte).doesNotContain(i.toLowerCase()));
            assertThat(adresses).allSatisfy(a -> assertThat(texte).doesNotContain(a));
        }
    }

    @Test
    @DisplayName("Une relance du récapitulatif impossible à noter : les autres sont notées, le traitement va au bout, journal sans identifiant ni date de CACI")
    void notationEnEchecApresLeRecapitulatif(CapturedOutput journal) throws Exception {
        LocalDate jour = ancre(16);
        LocalDate fin = jour.plusDays(30);
        long eleve = creerEleve("Notation", "Hugo", fin.minusYears(1), null);
        inscrire(eleve, saisonOuverte());
        long voisine = creerEleve("Notation", "Voisine", fin.minusYears(1), null);
        inscrire(voisine, saisonOuverte());
        // Un second passage simultané a déjà noté la relance de l'élève : l'écriture heurte l'unicité.
        messagerie.apresEnvoi(CLAIRE, () -> jdbc.update("""
                INSERT INTO relance_caci_faite (eleve_id, moment, fin_validite, faite_le)
                VALUES (?, 'BIENTOT', ?, ?)""", eleve, java.sql.Date.valueOf(fin), java.sql.Date.valueOf(jour)));

        relances.executer(jour);

        assertThat(recapitulatifsVers(CLAIRE)).hasSize(1);
        assertThat(tracesVers(CLAIRE, jour)).hasSize(1);
        assertThat(lignesDuJournal(journal)).anyMatch(l -> l.contains("Relances CACI du " + DATE_FR.format(jour)
                + " : une relance du récapitulatif n'a pas pu être notée"));
        assertThat(journal.getAll()).doesNotContain(fin.toString()).doesNotContain(DATE_FR.format(fin))
                .doesNotContain("Notation").doesNotContain("eleve_id");
        // R8 : le conflit d'un élève n'empêche pas de noter la relance des autres, qui ne reviendront pas.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM relance_caci_faite WHERE eleve_id = ?",
                Integer.class, voisine)).isEqualTo(1);
    }

    @Test
    @DisplayName("Seuls les élèves non archivés de la saison ouverte, par formation ou adhésion, sont cités")
    void perimetreDesEleves() throws Exception {
        // Fenêtre [ancre, ancre + 30], comme les autres tests : examen = ancre + 30 − 1 an.
        LocalDate examen = ancre(2).plusDays(30).minusYears(1);
        LocalDate fin = examen.plusYears(1);
        long saisonPassee = jdbc.queryForObject("SELECT id FROM saison WHERE libelle = '2025-2026'", Long.class);
        inscrire(creerEleve("Ancien", "Leo", examen, null), saisonPassee);
        long archive = creerEleve("Archive", "Lina", examen, null);
        inscrire(archive, saisonOuverte());
        mvc.perform(post("/api/eleves/" + archive + "/archivage").header("Authorization", jeton(CLAIRE)))
                .andExpect(status().isOk());
        long adherent = creerEleve("Adherent", "Noe", examen, null);
        mvc.perform(post("/api/adhesions").header("Authorization", jeton(CLAIRE))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eleveId\":%d,\"saisonId\":%d}".formatted(adherent, saisonOuverte())))
                .andExpect(status().isCreated());

        relances.executer(fin.minusDays(30));

        assertThat(recapitulatifsVers(CLAIRE)).singleElement()
                .satisfies(m -> assertThat(rubrique(m.corps(), BIENTOT))
                        .containsExactly("- Adherent Noe, élève, valable jusqu'au " + DATE_FR.format(fin)));
    }

    @Test
    @DisplayName("Un élève est cité à J-30 sous bientôt, à J sous aujourd'hui, jamais entre les deux")
    void eleveAuRecapitulatif() throws Exception {
        // Fenêtre [ancre, ancre + 30], comme les autres tests : examen = ancre + 30 − 1 an.
        LocalDate examen = ancre(1).plusDays(30).minusYears(1);
        LocalDate fin = examen.plusYears(1);
        LocalDate jour = fin.minusDays(30);
        inscrire(creerEleve("Lemaire", "Hugo", examen, null), saisonOuverte());
        String ligne = "- Lemaire Hugo, élève, valable jusqu'au " + DATE_FR.format(fin);

        relances.executer(jour);
        assertThat(recapitulatifsVers(CLAIRE)).singleElement()
                .satisfies(m -> assertThat(rubrique(m.corps(), BIENTOT)).contains(ligne));

        messagerie.vider();
        for (LocalDate d = jour.plusDays(1); d.isBefore(fin); d = d.plusDays(1)) {
            relances.executer(d);
        }
        assertThat(messagerie.tous()).noneMatch(m -> m.corps().contains("Lemaire Hugo"));

        relances.executer(fin);
        assertThat(recapitulatifsVers(CLAIRE)).singleElement()
                .satisfies(m -> assertThat(rubrique(m.corps(), AUJOURDHUI)).contains(ligne));
    }
}
