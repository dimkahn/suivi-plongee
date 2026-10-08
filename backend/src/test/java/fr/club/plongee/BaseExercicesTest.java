package fr.club.plongee;

import fr.club.plongee.commun.Calendrier;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Base d'exercices par compétence : contenu initial du N1 PE20, exercice noté
 * avec chaque évaluation (seule la maîtrise fait passer à acquis), programme
 * de séance tiré de la base, et modification par un administrateur.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class BaseExercicesTest {

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

    private JsonNode envoyer(String methode, String url, String jeton, Object corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        String contenu = corps == null ? "" : corps instanceof String s ? s : json.writeValueAsString(corps);
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(contenu))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    private long referentielN1(String jeton) throws Exception {
        for (JsonNode r : envoyer("GET", "/api/referentiels", jeton, null, 200)) {
            if ("N1".equals(r.get("niveau").asText()) && r.get("versionMft").asText().startsWith("PE20")) {
                return r.get("id").asLong();
            }
        }
        throw new AssertionError("Référentiel N1 PE20 absent");
    }

    private long saisonOuverte(String admin) throws Exception {
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) return s.get("id").asLong();
        }
        throw new AssertionError("Aucune saison ouverte");
    }

    @Test
    @DisplayName("La base du N1 PE20 compte 90 exercices, 9 par compétence, dont 3 de maîtrise")
    void contenuInitial() throws Exception {
        String moniteur = jeton("e1@club.fr");
        long ref = referentielN1(moniteur);
        JsonNode exercices = envoyer("GET", "/api/referentiels/" + ref + "/exercices", moniteur, null, 200);
        assertThat(exercices).hasSize(90);

        Map<Long, Integer> maitriseParBloc = new HashMap<>();
        for (JsonNode e : exercices) {
            if ("MAITRISE".equals(e.get("phase").asText())) maitriseParBloc.merge(e.get("blocId").asLong(), 1, Integer::sum);
        }
        assertThat(maitriseParBloc).hasSize(10).allSatisfy((bloc, n) -> assertThat(n).isEqualTo(3));
        // Chaque exercice travaille au moins un critère de sa compétence (V54).
        for (JsonNode e : exercices) {
            assertThat(e.get("critereIds")).as("critères de l'exercice " + e.get("numero").asText()).isNotEmpty();
        }

        // Le document numérote « 9 » Retourner en surface : rattaché au bon bloc du MFT.
        JsonNode detail = envoyer("GET", "/api/referentiels/" + ref, moniteur, null, 200);
        long blocSurface = -1;
        for (JsonNode b : detail.get("blocs")) {
            if (b.get("intitule").asText().equals("Retourner en surface")) blocSurface = b.get("id").asLong();
        }
        for (JsonNode e : exercices) {
            if (e.get("numero").asText().equals("9.7")) {
                assertThat(e.get("blocId").asLong()).isEqualTo(blocSurface);
                assertThat(e.get("intitule").asText()).isEqualTo("REC depuis 6 m");
            }
        }
    }

    @Test
    @DisplayName("Un critère ne passe à acquis que sur un exercice de maîtrise de sa compétence")
    void notationSurExercice() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");

        long eleveId = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Exercice","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}""",
                201).get("id").asLong();
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":8,"milieu":"ARTIFICIEL","lieu":"Piscine exercices"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        try {
            long cursus = envoyer("POST", "/api/cursus", admin, """
                    {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saisonOuverte(admin)),
                    201).get("id").asLong();
            envoyer("PUT", "/api/seances/" + seanceId + "/presences", moniteur, """
                    [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus), 200);

            JsonNode grille = envoyer("GET", "/api/cursus/" + cursus + "/grille", moniteur, null, 200);
            JsonNode bloc = grille.get("blocs").get(0);
            long critere = bloc.get("criteres").get(0).get("id").asLong();
            Map<String, Long> parNumero = new HashMap<>();
            for (JsonNode e : bloc.get("exercices")) parNumero.put(e.get("numero").asText(), e.get("id").asLong());
            assertThat(parNumero).containsKeys("1.1", "1.6", "1.7", "1.8");
            // « Gréage et dégréage » : 1.1, 1.3, 1.6 et 1.7 ; 1.8 travaille le capelage.
            assertThat(bloc.get("criteres").get(0).get("savoirFaire").asText()).isEqualTo("Gréage et dégréage");
            for (JsonNode e : bloc.get("exercices")) {
                if (e.get("numero").asText().equals("1.8")) {
                    assertThat(e.get("critereIds")).extracting(JsonNode::asLong)
                            .containsExactly(bloc.get("criteres").get(1).get("id").asLong());
                }
            }

            String url = "/api/cursus/" + cursus + "/evaluations";
            String note = """
                    {"critereId":%d,"seanceId":%d,"statut":"%s","exerciceId":%s}""";
            JsonNode refus = envoyer("POST", url, moniteur, note.formatted(critere, seanceId, "ACQUIS", "null"), 422);
            assertThat(refus.get("detail").asText()).contains("exercice de maîtrise").contains("(1.7)");
            // Exercice de perfectionnement acquis : c'est l'exercice qui est acquis, le critère reste en cours.
            JsonNode perfectionnement = envoyer("POST", url, moniteur,
                    note.formatted(critere, seanceId, "ACQUIS", parNumero.get("1.6")), 201);
            assertThat(perfectionnement.get("statutExercice").asText()).isEqualTo("ACQUIS");
            assertThat(perfectionnement.get("statut").asText()).isEqualTo("EN_COURS");
            refus = envoyer("POST", url, moniteur,
                    note.formatted(critere, seanceId, "ACQUIS", parNumero.get("1.8")), 422);
            assertThat(refus.get("detail").asText()).contains("ne travaille pas le critère « Gréage et dégréage »");

            JsonNode enCours = envoyer("POST", url, moniteur,
                    note.formatted(critere, seanceId, "EN_COURS", parNumero.get("1.1")), 201);
            assertThat(enCours.get("exercice").get("phase").asText()).isEqualTo("INITIATION");
            envoyer("POST", url, moniteur, note.formatted(critere, seanceId, "ACQUIS", parNumero.get("1.7")), 201);
            // Déjà acquis : un simple commentaire n'a pas à redonner l'exercice.
            envoyer("POST", url, moniteur, """
                    {"critereId":%d,"seanceId":%d,"statut":"ACQUIS","commentaire":"Toujours propre"}"""
                    .formatted(critere, seanceId), 201);

            JsonNode historique = envoyer("GET", "/api/cursus/" + cursus + "/criteres/" + critere + "/historique",
                    moniteur, null, 200);
            List<String> numeros = new ArrayList<>();
            for (JsonNode h : historique) numeros.add(h.get("exercice").isNull() ? "-" : h.get("exercice").get("numero").asText());
            assertThat(numeros).containsExactly("1.6", "1.1", "1.7", "-");

            JsonNode matrice = envoyer("GET", "/api/cursus/" + cursus + "/matrice", moniteur, null, 200);
            assertThat(matrice.get("exercices")).hasSize(90);
            JsonNode cellules = null;
            for (JsonNode l : matrice.get("lignes")) if (l.get("critereId").asLong() == critere) cellules = l.get("historique");
            assertThat(cellules.get(2).get("exerciceId").asLong()).isEqualTo(parNumero.get("1.7"));
            // La case garde l'état de l'exercice (P acquis) et celui du critère (en cours).
            assertThat(cellules.get(0).get("statutExercice").asText()).isEqualTo("ACQUIS");
            assertThat(cellules.get(0).get("statut").asText()).isEqualTo("EN_COURS");

            // La vue globale porte aussi le programme de la séance : exercice libre et exercice de la base.
            Map<String, Object> libre = new HashMap<>();
            libre.put("intitule", "Échauffement : 200 m");
            libre.put("critereIds", List.of());
            libre.put("phase", "INITIATION");
            Map<String, Object> deLaBase = new HashMap<>();
            deLaBase.put("intitule", "1.7 Gréage avec anomalie cachée");
            deLaBase.put("referentielId", referentielN1(moniteur));
            deLaBase.put("critereIds", List.of());
            deLaBase.put("exerciceBaseId", parNumero.get("1.7"));
            envoyer("PUT", "/api/seances/" + seanceId + "/programme", moniteur, List.of(libre, deLaBase), 200);
            JsonNode programme = null;
            JsonNode vueGlobale = envoyer("GET", "/api/cursus/" + cursus + "/matrice", moniteur, null, 200);
            for (JsonNode p : vueGlobale.get("programmes")) {
                if (p.get("seanceId").asLong() == seanceId) programme = p.get("exercices");
            }
            assertThat(vueGlobale.get("seancesPresent")).extracting(JsonNode::asLong).contains(seanceId);
            assertThat(programme).hasSize(2);
            assertThat(programme.get(0).get("exerciceBase").isNull()).isTrue();
            assertThat(programme.get(1).get("exerciceBase").get("numero").asText()).isEqualTo("1.7");
            // Phase choisie pour l'exercice libre ; celle de la base pour l'autre.
            assertThat(programme.get(0).get("phase").asText()).isEqualTo("INITIATION");
            assertThat(programme.get(1).get("phase").asText()).isEqualTo("MAITRISE");

            JsonNode apres = envoyer("GET", "/api/cursus/" + cursus + "/grille", moniteur, null, 200);
            JsonNode critereApres = apres.get("blocs").get(0).get("criteres").get(0);
            assertThat(critereApres.get("statut").asText()).isEqualTo("ACQUIS");
        } finally {
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }

    @Test
    @DisplayName("Le programme d'une séance se construit à partir des exercices de la base")
    void programmeDepuisLaBase() throws Exception {
        String admin = jeton("presidente@club.fr");
        long ref = referentielN1(admin);
        JsonNode base = envoyer("GET", "/api/referentiels/" + ref + "/exercices", admin, null, 200).get(3);
        long seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":7,"milieu":"ARTIFICIEL","lieu":"Piscine base"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        try {
            Map<String, Object> exercice = new HashMap<>();
            exercice.put("intitule", base.get("numero").asText() + " " + base.get("intitule").asText());
            exercice.put("consignes", base.get("deroulement").asText());
            exercice.put("referentielId", ref);
            exercice.put("critereIds", List.of());
            exercice.put("exerciceBaseId", base.get("id").asLong());
            JsonNode programme = envoyer("PUT", "/api/seances/" + seanceId + "/programme", admin, List.of(exercice), 200);
            JsonNode lu = programme.get("exercices").get(0).get("exerciceBase");
            assertThat(lu.get("numero").asText()).isEqualTo("1.4");
            assertThat(lu.get("phase").asText()).isEqualTo("PERFECTIONNEMENT");
            // 1.4 Test du lestage : « Choix de son matériel personnel ».
            assertThat(lu.get("critereIds")).hasSize(1);
            assertThat(lu.get("critereIds").get(0).asLong()).isEqualTo(base.get("critereIds").get(0).asLong());
            // Envoyé sans critère : l'exercice du programme reprend ceux de la base.
            JsonNode criteres = programme.get("exercices").get(0).get("criteres");
            assertThat(criteres).hasSize(1);
            assertThat(criteres.get(0).get("id").asLong()).isEqualTo(base.get("critereIds").get(0).asLong());
        } finally {
            mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        }
    }

    @Test
    @DisplayName("Les schémas du document du club sont rattachés aux exercices ; un administrateur les remplace")
    void schemas() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");
        long ref = referentielN1(moniteur);
        Map<String, JsonNode> parNumero = new HashMap<>();
        int avecSchema = 0;
        for (JsonNode e : envoyer("GET", "/api/referentiels/" + ref + "/exercices", moniteur, null, 200)) {
            parNumero.put(e.get("numero").asText(), e);
            if (e.get("aSchema").asBoolean()) avecSchema++;
        }
        // 29 schémas dans le document, 5.3 et 5.4 partagent le même ; rien pour les compétences 9 et 10.
        assertThat(avecSchema).isEqualTo(30);
        assertThat(parNumero.get("5.4").get("aSchema").asBoolean()).isTrue();
        assertThat(parNumero.get("10.1").get("aSchema").asBoolean()).isFalse();

        long schema = parNumero.get("1.1").get("id").asLong();
        byte[] png = mvc.perform(get("/api/exercices/" + schema + "/schema").header("Authorization", moniteur))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().contentType("image/png"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(png[1]).isEqualTo((byte) 'P');

        long sansSchema = parNumero.get("10.1").get("id").asLong();
        String url = "/api/exercices/" + sansSchema + "/schema";
        mvc.perform(get(url).header("Authorization", moniteur)).andExpect(status().isNotFound());
        var fichier = new org.springframework.mock.web.MockMultipartFile("fichier", "schema.png", "image/png", png);
        var texte = new org.springframework.mock.web.MockMultipartFile("fichier", "schema.png", "image/png",
                "pas une image".getBytes());
        mvc.perform(multipart(url).file(fichier).with(r -> { r.setMethod("PUT"); return r; })
                .header("Authorization", moniteur)).andExpect(status().isForbidden());
        mvc.perform(multipart(url).file(texte).with(r -> { r.setMethod("PUT"); return r; })
                .header("Authorization", admin)).andExpect(status().isUnprocessableContent());
        mvc.perform(multipart(url).file(fichier).with(r -> { r.setMethod("PUT"); return r; })
                .header("Authorization", admin)).andExpect(status().isOk());
        mvc.perform(get(url).header("Authorization", moniteur)).andExpect(status().isOk());
        mvc.perform(delete(url).header("Authorization", admin)).andExpect(status().isOk());
        mvc.perform(get(url).header("Authorization", moniteur)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Un administrateur ajoute, modifie et supprime un exercice ; un moniteur ne peut que lire")
    void administration() throws Exception {
        String admin = jeton("presidente@club.fr");
        String moniteur = jeton("e1@club.fr");
        long ref = referentielN1(admin);
        JsonNode blocs = envoyer("GET", "/api/referentiels/" + ref, admin, null, 200).get("blocs");
        long bloc = blocs.get(0).get("id").asLong();
        long greage = blocs.get(0).get("criteres").get(0).get("id").asLong();
        long capelage = blocs.get(0).get("criteres").get(1).get("id").asLong();
        long autreBloc = blocs.get(1).get("criteres").get(0).get("id").asLong();
        String url = "/api/referentiels/" + ref + "/blocs/" + bloc + "/exercices";
        String corps = """
                {"numero":"%s","ordre":10,"phase":"MAITRISE","intitule":"Équipement de nuit","actif":%s,
                 "critereIds":%s}""";

        envoyer("POST", url, moniteur, corps.formatted("1.10", true, "[" + greage + "]"), 403);
        JsonNode doublon = envoyer("POST", url, admin, corps.formatted("1.7", true, "[" + greage + "]"), 422);
        assertThat(doublon.get("detail").asText()).contains("déjà pris");
        JsonNode sansCritere = envoyer("POST", url, admin, corps.formatted("1.10", true, "[]"), 422);
        assertThat(sansCritere.get("detail").asText()).contains("au moins un critère");
        envoyer("POST", url, admin, corps.formatted("1.10", true, "[" + autreBloc + "]"), 422);

        long id = envoyer("POST", url, admin, corps.formatted("1.10", true, "[" + greage + "]"), 201).get("id").asLong();
        JsonNode modifie = envoyer("PUT", "/api/referentiels/" + ref + "/exercices/" + id, admin,
                corps.formatted("1.10", false, "[" + greage + "," + capelage + "]"), 200);
        assertThat(modifie.get("actif").asBoolean()).isFalse();
        assertThat(modifie.get("critereIds")).hasSize(2);
        envoyer("DELETE", "/api/referentiels/" + ref + "/exercices/" + id, admin, null, 200);
        assertThat(envoyer("GET", "/api/referentiels/" + ref + "/exercices", moniteur, null, 200)).hasSize(90);
    }
}
