package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Étiquettes à QR code du matériel : le QR code imprimé ramène à la fiche,
 * qu'il soit lu par le téléphone ou envoyé en photo au serveur.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class QrCodeMaterielTest {

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

    private long creerGilet(String jeton, String reference) throws Exception {
        return json.readTree(mvc.perform(post("/api/materiel/equipements").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"GILET","reference":"%s","taille":"M"}""".formatted(reference)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    /** Ce que donnerait une photo bien cadrée de l'étiquette imprimée : marge blanche, 6 pixels par carré. */
    private byte[] photo(JsonNode modules) throws Exception {
        int n = modules.size();
        int marge = 4;
        int pas = 6;
        BufferedImage image = new BufferedImage((n + 2 * marge) * pas, (n + 2 * marge) * pas, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int mx = x / pas - marge;
                int my = y / pas - marge;
                boolean noir = mx >= 0 && my >= 0 && mx < n && my < n && modules.get(my).asText().charAt(mx) == '1';
                image.setRGB(x, y, noir ? 0x000000 : 0xFFFFFF);
            }
        }
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        ImageIO.write(image, "png", sortie);
        return sortie.toByteArray();
    }

    @Test
    @DisplayName("Le QR code de l'étiquette porte l'adresse de la fiche, et sa photo ramène à l'équipement")
    void etiquetteEtLecture() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = creerGilet(dt, "G-QR1");

        JsonNode etiquettes = json.readTree(mvc.perform(get("/api/materiel/etiquettes").header("Authorization", dt)
                        .param("ids", String.valueOf(id)).param("origine", "https://suivi.club.fr"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(etiquettes).hasSize(1);
        JsonNode e = etiquettes.get(0);
        assertThat(e.get("reference").asText()).isEqualTo("G-QR1");
        assertThat(e.get("adresse").asText()).isEqualTo("https://suivi.club.fr/materiel/" + id);
        assertThat(e.get("modules").size()).isGreaterThanOrEqualTo(21);

        // Un TIV scanne aussi les étiquettes.
        mvc.perform(multipart("/api/materiel/qr-code/photo")
                        .file(new MockMultipartFile("fichier", "photo.png", "image/png", photo(e.get("modules"))))
                        .header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.equipementId").value(id));
    }

    @Test
    @DisplayName("Le texte lu par le téléphone : adresse de fiche ou référence du club")
    void texteLu() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = creerGilet(dt, "G-QR2");

        mvc.perform(post("/api/materiel/qr-code").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contenu\":\"http://localhost:4200/materiel/" + id + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.equipementId").value(id));
        mvc.perform(post("/api/materiel/qr-code").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contenu\":\" g-qr2 \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.equipementId").value(id));
        mvc.perform(post("/api/materiel/qr-code").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contenu\":\"https://www.ffessm.fr\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail", containsString("aucun équipement")));
    }

    @Test
    @DisplayName("Photo sans QR code, adresse du site douteuse, moniteur sans rôle matériel : refusés")
    void refus() throws Exception {
        String dt = jeton("e3@club.fr");
        long id = creerGilet(dt, "G-QR3");

        BufferedImage blanche = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        ImageIO.write(blanche, "png", sortie);
        mvc.perform(multipart("/api/materiel/qr-code/photo")
                        .file(new MockMultipartFile("fichier", "photo.png", "image/png", sortie.toByteArray()))
                        .header("Authorization", dt))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail", containsString("Aucun QR code")));

        mvc.perform(get("/api/materiel/etiquettes").header("Authorization", dt)
                        .param("ids", String.valueOf(id)).param("origine", "javascript:alert(1)"))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(get("/api/materiel/etiquettes").header("Authorization", jeton("e1@club.fr"))
                        .param("ids", String.valueOf(id)).param("origine", "https://suivi.club.fr"))
                .andExpect(status().isForbidden());
    }
}
