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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Inscription au club à jour, saison par saison : l'ADMIN la note dans
 * l'administration des élèves (pastille OK / KO sur chaque carte).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class InscriptionClubTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** Les saisons de la démonstration : ne pas en créer d'ouvertes, les autres tests lisent la saison en cours. */
    private long saison(String jeton, String libelle) throws Exception {
        String reponse = mvc.perform(get("/api/saisons").header("Authorization", jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode s : json.readTree(reponse)) if (s.get("libelle").asText().equals(libelle)) return s.get("id").asLong();
        throw new AssertionError("Saison " + libelle + " absente de la démonstration");
    }

    private long creerEleve(String jeton) throws Exception {
        String reponse = mvc.perform(post("/api/eleves").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"nom":"Lemoine","prenom":"Inscrit","autorisationLegale":true}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private JsonNode inscriptions(String jeton, long saison) throws Exception {
        String reponse = mvc.perform(get("/api/inscriptions-club").param("saisonId", String.valueOf(saison))
                        .header("Authorization", jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private static boolean inscrit(JsonNode liste, long eleve) {
        for (JsonNode i : liste) if (i.get("eleveId").asLong() == eleve) return true;
        return false;
    }

    private String chemin(long saison, long eleve) {
        return "/api/inscriptions-club/saisons/" + saison + "/eleves/" + eleve;
    }

    @Test
    @DisplayName("L'ADMIN note l'inscription d'un élève pour une saison, sans qu'elle vaille pour la suivante")
    void inscriptionParSaison() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = saison(admin, "2025-2026");
        long suivante = saison(admin, "2026-2027");
        long eleve = creerEleve(admin);
        assertThat(inscrit(inscriptions(admin, saison), eleve)).isFalse();

        mvc.perform(put(chemin(saison, eleve)).header("Authorization", admin)).andExpect(status().isOk());
        // Noter deux fois ne fait pas deux inscriptions.
        mvc.perform(put(chemin(saison, eleve)).header("Authorization", admin)).andExpect(status().isOk());

        JsonNode lui = null;
        int fois = 0;
        for (JsonNode i : inscriptions(admin, saison)) if (i.get("eleveId").asLong() == eleve) { lui = i; fois++; }
        assertThat(fois).isEqualTo(1);
        assertThat(lui.get("saisiPar").asText()).isEqualTo("Claire Ferrand");
        assertThat(inscrit(inscriptions(admin, suivante), eleve)).isFalse();

        mvc.perform(delete(chemin(saison, eleve)).header("Authorization", admin)).andExpect(status().isNoContent());
        assertThat(inscrit(inscriptions(admin, saison), eleve)).isFalse();
    }

    @Test
    @DisplayName("Un moniteur voit l'inscription d'un élève mais ne la change pas")
    void moniteurNeChangePasLInscription() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");
        long saison = saison(admin, "2026-2027");
        long eleve = creerEleve(admin);
        mvc.perform(put(chemin(saison, eleve)).header("Authorization", admin)).andExpect(status().isOk());

        assertThat(inscrit(inscriptions(moniteur, saison), eleve)).isTrue();
        mvc.perform(put(chemin(saison, eleve)).header("Authorization", moniteur)).andExpect(status().isForbidden());
        mvc.perform(delete(chemin(saison, eleve)).header("Authorization", moniteur)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un élève ne lit pas les inscriptions au club des autres")
    void eleveNeLitPasLesInscriptions() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = saison(admin, "2026-2027");
        mvc.perform(get("/api/inscriptions-club").param("saisonId", String.valueOf(saison))
                        .header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un élève archivé ne se note pas inscrit")
    void eleveArchiveRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long saison = saison(admin, "2026-2027");
        long eleve = creerEleve(admin);
        mvc.perform(post("/api/eleves/" + eleve + "/archivage").header("Authorization", admin));

        String reponse = mvc.perform(put(chemin(saison, eleve)).header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity())
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(reponse).get("detail").asText())
                .isEqualTo("Cet élève est archivé : désarchivez-le avant de noter son inscription au club.");
    }
}
