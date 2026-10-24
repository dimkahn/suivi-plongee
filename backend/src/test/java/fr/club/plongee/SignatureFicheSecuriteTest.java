package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Signature électronique de la fiche de sécurité par son directeur de
 * plongée (demande du club, octobre 2026) : seul le DP de la fiche signe,
 * une fois la plongée passée ; signée, la fiche ne se modifie plus, et une
 * empreinte scellée révèle toute modification faite malgré tout (en base).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SignatureFicheSecuriteTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

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

    private long creerSeance(String admin, String date) throws Exception {
        String reponse = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"dateSeance":"%s","milieu":"NATUREL","lieu":"Carriere","profondeurMax":20}
                                """.formatted(date)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private String fiche(long dpId, String meteo) {
        return """
                {"dpId":%d,"meteo":"%s","palanquees":[{"numero":1,"profondeurPrevue":20,"dureePrevue":40,
                  "membres":[{"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"PLONGEUR"}]}]}
                """.formatted(dpId, meteo);
    }

    private static final String REALISE = "[{\"numero\":1,\"profondeurRealisee\":18,\"dureeRealisee\":38}]";

    /** Une séance passée, avec sa fiche établie dont le DP est e3@club.fr. */
    private long seanceAvecFiche(String admin) throws Exception {
        long seance = creerSeance(admin, "2026-06-08");
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(moniteurId(admin, "e3@club.fr"), "Beau")))
                .andExpect(status().isOk());
        return seance;
    }

    @Test
    @DisplayName("Le DP signe sa fiche : signataire, date et fiche intègre")
    void leDpSigne() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.signature").doesNotExist());
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signature.signataire").value(containsString("Marchand")))
                .andExpect(jsonPath("$.signature.signeeLe").value(notNullValue()))
                .andExpect(jsonPath("$.signature.integre").value(true));
        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", jeton("e1@club.fr")))
                .andExpect(jsonPath("$.signature.integre").value(true));
    }

    @Test
    @DisplayName("La liste des séances dit le DP de la fiche et si elle est signée")
    void laListeDitSiLaFicheEstSignee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);
        long dpId = moniteurId(admin, "e3@club.fr");
        String filtre = "$[?(@.id == %d)]".formatted(seance);

        mvc.perform(get("/api/seances?saisonId=" + saisonDe(admin, seance)).header("Authorization", admin))
                .andExpect(jsonPath(filtre + ".ficheSignee").value(false))
                .andExpect(jsonPath(filtre + ".ficheDpId").value((int) dpId));
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/seances?saisonId=" + saisonDe(admin, seance)).header("Authorization", admin))
                .andExpect(jsonPath(filtre + ".ficheSignee").value(true));
    }

    @Test
    @DisplayName("La page de signature montre la fiche imprimée en image, A4 paysage, aux mêmes comptes que le PDF")
    void apercuDeLaFicheImprimee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);

        byte[] png = mvc.perform(get("/api/seances/" + seance + "/fiche-securite/apercu.png")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Type", "image/png"))
                .andReturn().getResponse().getContentAsByteArray();
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(png));
        org.assertj.core.api.Assertions.assertThat(image.getWidth()).isGreaterThan(image.getHeight());

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite/apercu.png")
                        .header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
        // La sécurité surface ne voit que les séances qui lui sont confiées.
        mvc.perform(get("/api/seances/" + seance + "/fiche-securite/apercu.png")
                        .header("Authorization", jeton("surface@club.fr")))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Un élève ne lit pas dans la liste des séances le DP de la fiche ni sa signature")
    void lEleveNeVoitPasLeDp() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);
        String filtre = "$[?(@.id == %d)]".formatted(seance);

        mvc.perform(get("/api/seances?saisonId=" + saisonDe(admin, seance)).header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(filtre + ".id").value((int) seance))
                .andExpect(jsonPath(filtre + ".ficheDpId").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())))
                .andExpect(jsonPath(filtre + ".ficheSignee").value(false));
    }

    private long saisonDe(String admin, long seance) {
        return jdbc.queryForObject("SELECT saison_id FROM seance WHERE id = ?", Long.class, seance);
    }

    @Test
    @DisplayName("Seul le DP de la fiche la signe, pas un autre E3 ni un administrateur")
    void seulLeDpSigne() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);

        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature").header("Authorization", admin))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("Seul le directeur de plongée")));
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("surface@club.fr")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.signature").doesNotExist());
    }

    @Test
    @DisplayName("Une fiche ne se signe qu'une fois la plongée passée")
    void pasAvantLaPlongee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin, "2027-06-08");
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(moniteurId(admin, "e3@club.fr"), "Beau")))
                .andExpect(status().isOk());

        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("n'a pas encore eu lieu")));
    }

    @Test
    @DisplayName("Signée, la fiche ne se modifie plus, ne se complète plus, ne se resigne pas et ne se supprime pas")
    void ficheSigneeVerrouillee() throws Exception {
        String admin = jeton("presidente@club.fr");
        String dp = jeton("e3@club.fr");
        long seance = seanceAvecFiche(admin);
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", dp)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isOk());
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature").header("Authorization", dp))
                .andExpect(status().isOk());

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", dp)
                        .contentType(MediaType.APPLICATION_JSON).content(fiche(moniteurId(admin, "e3@club.fr"), "Pluie")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("signée")));
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", dp)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/duplication").header("Authorization", dp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dpId\":%d,\"palanquees\":[1]}".formatted(moniteurId(admin, "e3@club.fr"))))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature").header("Authorization", dp))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("déjà signée")));
        mvc.perform(delete("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(status().isUnprocessableContent());

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.meteo").value("Beau"))
                .andExpect(jsonPath("$.palanquees[0].profondeurRealisee").value(18))
                .andExpect(jsonPath("$.signature.integre").value(true));
    }

    @Test
    @DisplayName("Une modification faite en base après la signature est détectée")
    void modificationEnBaseDetectee() throws Exception {
        String admin = jeton("presidente@club.fr");
        String dp = jeton("e3@club.fr");
        long seance = seanceAvecFiche(admin);
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature").header("Authorization", dp))
                .andExpect(status().isOk());

        jdbc.update("""
                UPDATE membre_palanquee SET aptitude = 'N3' WHERE palanquee_id IN (
                  SELECT p.id FROM palanquee p JOIN fiche_securite f ON f.id = p.fiche_securite_id
                  WHERE f.seance_id = ?)""", seance);

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.signature.integre").value(false));
    }

    @Test
    @DisplayName("Une date de signature changée en base est détectée")
    void dateDeSignatureChangeeDetectee() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = seanceAvecFiche(admin);
        mvc.perform(post("/api/seances/" + seance + "/fiche-securite/signature")
                        .header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk());

        jdbc.update("UPDATE fiche_securite SET signee_le = TIMESTAMP '2026-06-08 08:00:00' WHERE seance_id = ?", seance);

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(jsonPath("$.signature.integre").value(false));
    }
}
