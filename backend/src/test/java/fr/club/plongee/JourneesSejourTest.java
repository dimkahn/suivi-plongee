package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La présentation des journées du programme d'un séjour, comme un carnet de
 * voyage : titre, trajet, photos des lieux, ce qu'on y verra, un conseil,
 * l'hébergement (demande du club, 2026).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class JourneesSejourTest {

    /** Une image PNG minimale : la signature suffit au contrôle du serveur. */
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            case "POST" -> post(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private JsonNode photo(String url, String jeton, byte[] contenu, int attendu) throws Exception {
        String reponse = mvc.perform(multipart(url).file(new MockMultipartFile("fichier", "lieu.png", "image/png", contenu))
                        .header("Authorization", jeton))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private long eleveCamille(String jeton) throws Exception {
        for (JsonNode p : envoyer("GET", "/api/plongeurs-connus", jeton, null, 200)) {
            if (p.get("prenom").asText().equals("Camille") && p.hasNonNull("eleveId")) return p.get("eleveId").asLong();
        }
        throw new AssertionError("Camille introuvable");
    }

    @Test
    @DisplayName("L'organisateur présente une journée avec ses photos ; les participants la lisent, les autres ne la modifient pas")
    void presenterUneJournee() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(270);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour présenté","dateDebut":"%s","dateFin":"%s"}""".formatted(debut, debut.plusDays(3)), 201)
                .get("id").asLong();
        String base = "/api/sejours/" + sortie;
        String journee = base + "/journees/" + debut.plusDays(1);
        envoyer("POST", base + "/participants", dt, """
                {"eleveId":%d,"nom":"Berthier","prenom":"Camille","plongeur":true}""".formatted(eleveCamille(dt)), 200);

        JsonNode s = envoyer("PUT", journee, dt, """
                {"titre":"Jour 1 — Cabo Ledo","trajet":"Luanda → Muxima (facultatif) → Cabo Ledo · 235 km",
                 "descriptif":"Le Miradouro da Lua, ses falaises ocre ; Cabo Ledo, ses plages.",
                 "conseil":"Décider du détour par Muxima avant de partir.",
                 "hebergement":"Hôtel Doce Mar — 2 chambres, 1 nuit, payé à 50 %"}""", 200);
        JsonNode j = s.get("journees").get(0);
        assertThat(j.get("jour").asText()).isEqualTo(debut.plusDays(1).toString());
        assertThat(j.get("titre").asText()).isEqualTo("Jour 1 — Cabo Ledo");
        assertThat(j.get("trajet").asText()).contains("235 km");
        assertThat(j.get("descriptif").asText()).contains("Miradouro");
        assertThat(j.get("conseil").asText()).contains("Muxima");
        assertThat(j.get("hebergement").asText()).contains("Doce Mar");
        assertThat(j.get("photos")).isEmpty();

        // Modifier la même journée la remplace, sans en créer une deuxième.
        s = envoyer("PUT", journee, dt, """
                {"titre":"Jour 1 — Cabo Ledo et Muxima"}""", 200);
        assertThat(s.get("journees")).hasSize(1);
        assertThat(s.get("journees").get(0).get("titre").asText()).isEqualTo("Jour 1 — Cabo Ledo et Muxima");
        assertThat(s.get("journees").get(0).get("descriptif").isNull()).isTrue();

        // Des photos des lieux, quatre au plus ; seulement des images.
        for (int i = 0; i < 4; i++) s = photo(journee + "/photos", dt, PNG, 200);
        assertThat(s.get("journees").get(0).get("photos")).hasSize(4);
        assertThat(photo(journee + "/photos", dt, PNG, 422).get("detail").asText()).contains("4 photos");
        photo(journee + "/photos", dt, "pas une image".getBytes(), 422);
        long photoId = s.get("journees").get(0).get("photos").get(0).asLong();

        // Un jour trop loin du séjour est refusé.
        envoyer("PUT", base + "/journees/" + debut.plusDays(60), dt, """
                {"titre":"Trop tard"}""", 422);

        // Camille, participante : elle lit la journée et ses photos, sans la modifier.
        String camille = jeton("eleve@club.fr");
        JsonNode carnet = envoyer("GET", base, camille, null, 200);
        assertThat(carnet.get("journees").get(0).get("titre").asText()).isEqualTo("Jour 1 — Cabo Ledo et Muxima");
        mvc.perform(get(journee + "/photos/" + photoId).header("Authorization", camille))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", "image/png"));
        envoyer("PUT", journee, camille, "{\"titre\":\"Autre\"}", 403);
        photo(journee + "/photos", camille, PNG, 403);
        // Un moniteur qui n'organise pas lit, sans modifier.
        String e1 = jeton("e1@club.fr");
        assertThat(envoyer("GET", base, e1, null, 200).get("journees")).hasSize(1);
        envoyer("PUT", journee, e1, "{\"titre\":\"Autre\"}", 403);
        envoyer("DELETE", journee + "/photos/" + photoId, e1, null, 403);

        // Retirer une photo, puis la journée entière (ses photos partent avec elle).
        s = envoyer("DELETE", journee + "/photos/" + photoId, dt, null, 200);
        assertThat(s.get("journees").get(0).get("photos")).hasSize(3);
        s = envoyer("DELETE", journee, dt, null, 200);
        assertThat(s.get("journees")).isEmpty();
        long autrePhoto = photoId + 1;
        mvc.perform(get(journee + "/photos/" + autrePhoto).header("Authorization", dt)).andExpect(status().isNotFound());

        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }

    @Test
    @DisplayName("Un élève qui ne participe pas au séjour ne voit pas les photos de ses journées")
    void photosFermeesAuxAutres() throws Exception {
        String dt = jeton("e3@club.fr");
        LocalDate debut = LocalDate.now(ZoneId.of("Europe/Paris")).plusDays(275);
        long sortie = envoyer("POST", "/api/sorties", dt, """
                {"nom":"Séjour sans Camille","dateDebut":"%s"}""".formatted(debut), 201).get("id").asLong();
        String journee = "/api/sejours/" + sortie + "/journees/" + debut;
        envoyer("PUT", journee, dt, "{\"titre\":\"Arrivée\"}", 200);
        long photoId = photo(journee + "/photos", dt, PNG, 200).get("journees").get(0).get("photos").get(0).asLong();
        mvc.perform(get(journee + "/photos/" + photoId).header("Authorization", jeton("eleve@club.fr")))
                .andExpect(status().isForbidden());
        envoyer("DELETE", "/api/sorties/" + sortie, dt, null, 204);
    }
}
