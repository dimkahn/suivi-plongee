package fr.club.plongee;

import fr.club.plongee.identite.IdentiteStructureService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Identité de la structure : vide au départ (l'identité d'origine, rien ne
 * change pour le club déjà installé), lue sans connexion, réglée par un ADMIN.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class IdentiteStructureTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired IdentiteStructureService identite;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    /** Les autres tests retrouvent l'identité d'origine. */
    @AfterEach
    void revenirALOrigine() {
        identite.modifier(new IdentiteStructureService.DemandeIdentite(null, null, null, null, null, null));
        identite.supprimerLogo();
    }

    @Test
    @DisplayName("Sans réglage, l'identité d'origine : lue sans connexion, nom des documents par défaut")
    void identiteDOrigine() throws Exception {
        mvc.perform(get("/api/identite"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nom").isEmpty())
                .andExpect(jsonPath("$.couleurPrincipale").isEmpty())
                .andExpect(jsonPath("$.logoPersonnalise").value(false));
        assertThat(identite.nom()).isEqualTo("Club de plongee");
        assertThat(identite.logoPng()).isEqualTo(identite.logoOrigine());
        byte[] logo = mvc.perform(get("/api/identite/logo.png"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(logo).isEqualTo(identite.logoOrigine());
    }

    @Test
    @DisplayName("Un ADMIN règle nom, couleurs et logo ; les documents et le manifeste les reprennent")
    void adminRegleLIdentite() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(put("/api/identite").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nom":"Centre de plongée des Calanques","nomCourt":"Calanques",
                                 "couleurPrincipale":"#1d4ed8","couleurFoncee":"#0B1F44","couleurAccent":"#F59E0B"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.couleurPrincipale").value("#1D4ED8"));
        assertThat(identite.nom()).isEqualTo("Centre de plongée des Calanques");

        BufferedImage carre = new BufferedImage(900, 600, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        ImageIO.write(carre, "jpg", jpeg);
        mvc.perform(multipart("/api/identite/logo").file(new MockMultipartFile("fichier", "logo.jpg",
                                "image/jpeg", jpeg.toByteArray()))
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoPersonnalise").value(true));
        // Gardé en PNG, réduit à 512 px de côté.
        BufferedImage logo = ImageIO.read(new ByteArrayInputStream(identite.logoPng()));
        assertThat(logo.getWidth()).isEqualTo(512);

        byte[] icone = mvc.perform(get("/api/identite/icone/512.png").param("masquable", "true"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage imageIcone = ImageIO.read(new ByteArrayInputStream(icone));
        assertThat(imageIcone.getWidth()).isEqualTo(512);
        // Fond de la couleur foncée dans le coin (zone hors logo).
        assertThat(imageIcone.getRGB(2, 2) & 0xFFFFFF).isEqualTo(0x0B1F44);

        String manifeste = mvc.perform(get("/api/identite/manifest.webmanifest"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode m = json.readTree(manifeste);
        assertThat(m.get("short_name").asText()).isEqualTo("Calanques");
        assertThat(m.get("theme_color").asText()).isEqualTo("#0B1F44");
    }

    @Test
    @DisplayName("Couleur mal écrite, fichier qui n'est pas une image, compte non ADMIN : refusés")
    void refus() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(put("/api/identite").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"couleurPrincipale\":\"bleu\"}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(multipart("/api/identite/logo").file(new MockMultipartFile("fichier", "logo.png",
                                "image/png", "pas une image".getBytes()))
                        .with(r -> { r.setMethod("PUT"); return r; })
                        .header("Authorization", admin))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/identite").header("Authorization", jeton("e2@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nom\":\"Pirate\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/identite").contentType(MediaType.APPLICATION_JSON).content("{\"nom\":\"Pirate\"}"))
                .andExpect(status().isUnauthorized());
    }
}
