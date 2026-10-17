package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Dupliquer une séance depuis sa fiche de sécurité (un second bateau, une
 * seconde rotation) : la nouvelle séance reprend le jour et le lieu, prend le
 * n° de plongée suivant, reçoit les palanquées choisies avec un nouveau DP, et
 * les deux séances sont liées. Chaque test crée ses propres séances.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class DuplicationFicheSecuriteTest {

    /** Dans la saison ouverte de la démo, que liste {@code GET /api/seances}. */
    private static final String JOUR = "2027-05-22";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private long moniteurId(String admin, String email) throws Exception {
        String reponse = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode m : json.readTree(reponse)) {
            if (email.equals(m.get("email").asText())) return m.get("id").asLong();
        }
        throw new IllegalStateException("Moniteur introuvable : " + email);
    }

    private JsonNode seance(String jeton, long id) throws Exception {
        String reponse = mvc.perform(get("/api/seances").header("Authorization", jeton))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode s : json.readTree(reponse)) {
            if (s.get("id").asLong() == id) return s;
        }
        throw new IllegalStateException("Séance introuvable : " + id);
    }

    private int dernierNumeroDuJour(String jeton) throws Exception {
        String reponse = mvc.perform(get("/api/seances").header("Authorization", jeton))
                .andReturn().getResponse().getContentAsString();
        int max = 0;
        for (JsonNode s : json.readTree(reponse)) {
            if (JOUR.equals(s.get("date").asText())) max = Math.max(max, s.get("ordre").asInt());
        }
        return max;
    }

    /** Une séance en mer, avec sa fiche : trois palanquées d'un plongeur chacune. */
    private long seanceAvecFiche(String admin, long dpId) throws Exception {
        long seance = json.readTree(mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dateSeance":"%s","milieu":"NATUREL","lieu":"Port-Cros","site":"La Gabinière",
                                 "profondeurMax":30,"commentaire":"Bateau 1"}
                                """.formatted(JOUR)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"dpId": %d, "meteo": "Mistral faible", "planSecours": "VHF 16",
                                 "palanquees": [
                                   {"numero": 1, "profondeurPrevue": 20, "membres": [{"nom": "Alpha", "prenom": "Anne"}]},
                                   {"numero": 2, "profondeurPrevue": 30, "membres": [{"nom": "Bravo", "prenom": "Bruno"}]},
                                   {"numero": 3, "profondeurPrevue": 12, "membres": [{"nom": "Charlie", "prenom": "Chloé"}]}
                                 ]}
                                """.formatted(dpId)))
                .andExpect(status().isOk());
        return seance;
    }

    private String demande(long dpId, String palanquees) {
        return """
                {"dpId": %d, "palanquees": %s, "info": "Bateau 2", "infoOrigine": "Bateau 1 — Zodiac"}
                """.formatted(dpId, palanquees);
    }

    @Test
    @DisplayName("Dupliquer une séance déplace les palanquées choisies vers une nouvelle séance liée, avec son DP")
    void dupliquerDeplaceLesPalanqueesChoisies() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long dpOrigine = moniteurId(admin, "e3@club.fr");
        long nouveauDp = moniteurId(admin, "presidente@club.fr");
        long origine = seanceAvecFiche(admin, dpOrigine);
        int numeroAttendu = dernierNumeroDuJour(admin) + 1;

        String reponse = mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(nouveauDp, "[2, 3]")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long nouvelle = json.readTree(reponse).get("seanceId").asLong();

        JsonNode copie = seance(admin, nouvelle);
        assertThat(copie.get("date").asText()).isEqualTo(JOUR);
        assertThat(copie.get("ordre").asInt()).isEqualTo(numeroAttendu);
        assertThat(copie.get("lieu").asText()).isEqualTo("Port-Cros");
        assertThat(copie.get("site").asText()).isEqualTo("La Gabinière");
        assertThat(copie.get("milieu").asText()).isEqualTo("NATUREL");
        assertThat(copie.get("profondeurMax").asInt()).isEqualTo(30);
        assertThat(copie.get("commentaire").asText()).isEqualTo("Bateau 2");
        assertThat(seance(admin, origine).get("commentaire").asText()).isEqualTo("Bateau 1 — Zodiac");

        // La nouvelle fiche : nouveau DP, conditions reprises, palanquées 2 et 3 renumérotées 1 et 2.
        mvc.perform(get("/api/seances/" + nouvelle + "/fiche-securite").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dpId").value(nouveauDp))
                .andExpect(jsonPath("$.meteo").value("Mistral faible"))
                .andExpect(jsonPath("$.planSecours").value("VHF 16"))
                .andExpect(jsonPath("$.palanquees.length()").value(2))
                .andExpect(jsonPath("$.palanquees[0].numero").value(1))
                .andExpect(jsonPath("$.palanquees[0].profondeurPrevue").value(30))
                .andExpect(jsonPath("$.palanquees[0].membres[0].nom").value("Bravo"))
                .andExpect(jsonPath("$.palanquees[1].numero").value(2))
                .andExpect(jsonPath("$.palanquees[1].membres[0].nom").value("Charlie"))
                .andExpect(jsonPath("$.seancesLiees[0].seanceId").value(origine));

        // L'ancienne fiche garde son DP et la seule palanquée restante, liée à la nouvelle.
        mvc.perform(get("/api/seances/" + origine + "/fiche-securite").header("Authorization", moniteur))
                .andExpect(jsonPath("$.dpId").value(dpOrigine))
                .andExpect(jsonPath("$.palanquees.length()").value(1))
                .andExpect(jsonPath("$.palanquees[0].numero").value(1))
                .andExpect(jsonPath("$.palanquees[0].membres[0].nom").value("Alpha"))
                .andExpect(jsonPath("$.seancesLiees[0].seanceId").value(nouvelle))
                .andExpect(jsonPath("$.seancesLiees[0].plongeursPlaces.length()").value(2));
    }

    @Test
    @DisplayName("Le n° de plongée de la copie peut être choisi, et aucune palanquée n'est obligatoire")
    void numeroChoisiSansPalanquee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long dp = moniteurId(admin, "e3@club.fr");
        long origine = seanceAvecFiche(admin, dp);

        String reponse = mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dpId\": %d, \"ordre\": 7, \"palanquees\": []}".formatted(dp)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long nouvelle = json.readTree(reponse).get("seanceId").asLong();

        assertThat(seance(admin, nouvelle).get("ordre").asInt()).isEqualTo(7);
        assertThat(seance(admin, origine).get("commentaire").asText()).isEqualTo("Bateau 1");
        mvc.perform(get("/api/seances/" + origine + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.palanquees.length()").value(3));
    }

    @Test
    @DisplayName("La séance dupliquée rejoint la sortie de l'originale")
    void laCopieRejointLaSortie() throws Exception {
        String admin = jeton("presidente@club.fr");
        long dp = moniteurId(admin, "e3@club.fr");
        long origine = seanceAvecFiche(admin, dp);
        long sortie = json.readTree(mvc.perform(post("/api/sorties").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Week-end Port-Cros","lieu":"Port-Cros","dateDebut":"%s","dateFin":"%s"}
                                """.formatted(JOUR, JOUR)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(put("/api/sorties/" + sortie + "/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"seanceIds\": [" + origine + "]}"))
                .andExpect(status().isOk());

        long nouvelle = json.readTree(mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content(demande(dp, "[1]")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("seanceId").asLong();

        mvc.perform(get("/api/seances/" + nouvelle + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.sortie.id").value(sortie));
    }

    @Test
    @DisplayName("Le nouveau DP doit être au moins E3")
    void nouveauDpE2Refuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long origine = seanceAvecFiche(admin, moniteurId(admin, "e3@club.fr"));

        mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content(demande(moniteurId(admin, "e2@club.fr"), "[1]")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("au moins E3")));
        mvc.perform(get("/api/seances/" + origine + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.palanquees.length()").value(3))
                .andExpect(jsonPath("$.seancesLiees").isEmpty());
    }

    @Test
    @DisplayName("Une palanquée qui n'est pas sur la fiche ne peut pas être déplacée")
    void palanqueeInconnueRefusee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long dp = moniteurId(admin, "e3@club.fr");
        long origine = seanceAvecFiche(admin, dp);

        mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content(demande(dp, "[9]")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value("La palanquée 9 n'existe pas sur cette fiche."));
    }

    @Test
    @DisplayName("Un E1 sans le droit d'établir la fiche ne peut pas dupliquer la séance ; un élève non plus")
    void dupliquerSansDroitRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long dp = moniteurId(admin, "e3@club.fr");
        long origine = seanceAvecFiche(admin, dp);

        mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", jeton("e1@club.fr")).contentType(MediaType.APPLICATION_JSON)
                        .content(demande(dp, "[1]")))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post("/api/seances/" + origine + "/fiche-securite/duplication")
                        .header("Authorization", jeton("eleve@club.fr")).contentType(MediaType.APPLICATION_JSON)
                        .content(demande(dp, "[1]")))
                .andExpect(status().isForbidden());
    }
}
