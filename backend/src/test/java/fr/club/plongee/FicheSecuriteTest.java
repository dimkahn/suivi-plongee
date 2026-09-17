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

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fiche de sécurité d'une séance (A322-72) : établissement, complément du
 * réalisé, export PDF et habilitations. Chaque test travaille sur sa propre
 * séance (créée à la volée) pour ne pas interférer avec les autres, le
 * contexte Spring et la base H2 étant partagés entre les méthodes.
 *
 * <p>Le test {@code pdfNeCasseJamaisHorsTransaction} est une garde de
 * non-régression : avant que l'assemblage des vues et le rendu PDF ne soient
 * déplacés dans FicheSecuriteService (transactionnel), dp/seance/palanquees/
 * membres étaient parcourus dans le contrôleur après la fermeture de la
 * transaction, ce qui levait une LazyInitializationException (open-in-view
 * désactivé) — invisible dans un test qui n'irait pas jusqu'au bout de la
 * chaîne HTTP réelle.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FicheSecuriteTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String corps = """
                {"email":"%s","motDePasse":"plongee2026"}
                """.formatted(email);
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private long moniteurId(String adminJeton, String email) throws Exception {
        String reponse = mvc.perform(get("/api/admin/moniteurs").header("Authorization", adminJeton))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode m : json.readTree(reponse)) {
            if (email.equals(m.get("email").asText())) return m.get("id").asLong();
        }
        throw new IllegalStateException("Moniteur introuvable : " + email);
    }

    /** Une séance en milieu naturel, propre à chaque test, pour ne pas se marcher dessus. */
    private long creerSeance(String jeton) throws Exception {
        String corps = """
                {"dateSeance":"2026-06-01","milieu":"NATUREL","lieu":"Carriere de Blaisy","profondeurMax":20}
                """;
        String reponse = mvc.perform(post("/api/seances").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private String demandeEtablissement(long dpId) {
        return """
                {
                  "dpId": %d,
                  "meteo": "Beau", "etatMer": "Calme", "visibilite": "10 m",
                  "securiteSurface": "Un surveillant en surface", "planSecours": "VHF canal 16",
                  "palanquees": [
                    {
                      "numero": 1, "profondeurPrevue": 20, "dureePrevue": 40,
                      "membres": [
                        {"nom": "Dulac", "prenom": "Anis", "aptitude": "N2", "fonction": "GUIDE_PALANQUEE",
                         "gaz": "Air", "moyenDesaturation": "Table MN90"},
                        {"nom": "Perrot", "prenom": "Sonia", "aptitude": "N1", "fonction": "PLONGEUR",
                         "gaz": "Nitrox 32"}
                      ]
                    }
                  ]
                }
                """.formatted(dpId);
    }

    @Test
    @DisplayName("Sans authentification, tout accès à la fiche de sécurité est refusé")
    void anonymeRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);
        mvc.perform(get("/api/seances/" + seance + "/fiche-securite"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Un élève ne peut ni consulter ni établir la fiche de sécurité")
    void eleveRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);
        String eleve = jeton("eleve@club.fr");

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", eleve))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", eleve)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(1)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Une séance sans fiche renvoie une fiche vide plutôt qu'une erreur")
    void consulterSansFicheRenvoieVide() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.palanquees").isEmpty());
    }

    @Test
    @DisplayName("Un moniteur établit la fiche : DP, conditions, palanquée et plongeurs")
    void moniteurEtablitLaFiche() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        String reponse = mvc.perform(put("/api/seances/" + seance + "/fiche-securite")
                        .header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode vue = json.readTree(reponse);
        assertThat(vue.get("dp").asText()).isEqualTo("Flora Vasseur");
        assertThat(vue.get("meteo").asText()).isEqualTo("Beau");
        JsonNode palanquee = vue.get("palanquees").get(0);
        assertThat(palanquee.get("numero").asInt()).isEqualTo(1);
        assertThat(palanquee.get("profondeurPrevue").asInt()).isEqualTo(20);
        JsonNode membres = palanquee.get("membres");
        assertThat(membres).hasSize(2);
        assertThat(membres.get(0).get("fonction").asText()).isEqualTo("GUIDE_PALANQUEE");
        assertThat(membres.get(1).get("gaz").asText()).isEqualTo("Nitrox 32");
    }

    @Test
    @DisplayName("Un DP qui n'est pas moniteur est refusé")
    void dpNonMoniteurRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(999999)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Compléter le réalisé sans avoir établi la fiche est refusé")
    void realiseSansEtablissementRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"numero\":1,\"profondeurRealisee\":18}]"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Le complément réalisé met à jour le profil sans toucher aux plongeurs déjà saisis")
    void completerLeRealiseSansRessaisirLesPlongeurs() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk());

        String corpsRealise = """
                [{"numero": 1, "profondeurRealisee": 19, "dureeRealisee": 38,
                  "paliers": "3 min a 3 m", "heureImmersion": "09:15", "heureSortie": "09:53"}]
                """;
        String reponse = mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise")
                        .header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(corpsRealise))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode palanquee = json.readTree(reponse).get("palanquees").get(0);
        assertThat(palanquee.get("profondeurRealisee").asInt()).isEqualTo(19);
        assertThat(palanquee.get("dureeRealisee").asInt()).isEqualTo(38);
        assertThat(palanquee.get("heureImmersion").asText()).isEqualTo("09:15:00");
        assertThat(palanquee.get("membres")).hasSize(2);
        assertThat(palanquee.get("membres").get(0).get("prenom").asText()).isEqualTo("Anis");
    }

    @Test
    @DisplayName("Le complément réalisé refuse un numéro de palanquée inconnu")
    void realiseNumeroInconnuRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk());

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"numero\":9,\"profondeurRealisee\":18}]"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("Ré-établir la fiche préserve le profil déjà réalisé")
    void reEtablirPreserveLeProfilRealise() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"numero\":1,\"profondeurRealisee\":19,\"dureeRealisee\":38}]"))
                .andExpect(status().isOk());

        // Le DP retouche la fiche (nouvelle météo) sans toucher au réalisé.
        String reponse = mvc.perform(put("/api/seances/" + seance + "/fiche-securite")
                        .header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode palanquee = json.readTree(reponse).get("palanquees").get(0);
        assertThat(palanquee.get("profondeurRealisee").asInt()).isEqualTo(19);
        assertThat(palanquee.get("dureeRealisee").asInt()).isEqualTo(38);
    }

    @Test
    @DisplayName("L'export PDF fonctionne de bout en bout, hors de toute transaction ouverte")
    void pdfNeCasseJamaisHorsTransaction() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite/realise").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"numero\":1,\"profondeurRealisee\":19,\"dureeRealisee\":38}]"))
                .andExpect(status().isOk());

        byte[] pdf = mvc.perform(get("/api/seances/" + seance + "/fiche-securite/fiche.pdf")
                        .header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().exists("Content-Disposition"))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }

    @Test
    @DisplayName("L'export PDF est refusé tant qu'aucune fiche n'est établie")
    void pdfSansFicheRefuse() throws Exception {
        String admin = jeton("presidente@club.fr");
        long seance = creerSeance(admin);

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite/fiche.pdf")
                        .header("Authorization", admin))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Seul un ADMIN peut supprimer une fiche de sécurité")
    void suppressionReserveeAdmin() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e2@club.fr");
        long seance = creerSeance(admin);
        long dpId = moniteurId(admin, "e2@club.fr");

        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demandeEtablissement(dpId)))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/seances/" + seance + "/fiche-securite").header("Authorization", moniteur))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").doesNotExist());
    }
}
