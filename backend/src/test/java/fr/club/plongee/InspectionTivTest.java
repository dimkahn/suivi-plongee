package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fiche d'évaluation et de suivi d'une bouteille (inspection TIV). Chaque
 * test crée ses propres blocs : la base de démonstration est partagée.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class InspectionTivTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private static final LocalDate AUJOURDHUI = LocalDate.now(ZoneId.of("Europe/Paris"));

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private long creerBloc(String jeton, String reference, String matiere, boolean nitrox) throws Exception {
        return json.readTree(mvc.perform(post("/api/materiel/equipements").header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"BLOC","reference":"%s","volumeLitres":12,"matiere":"%s","nitrox":%s,
                                  "proprietaire":"Jean Brunet","datePremiereEpreuve":"%s"}"""
                                .formatted(reference, matiere, nitrox, AUJOURDHUI.minusYears(2))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    /** Toutes les questions du modèle, avec la réponse d'une bouteille saine, sauf celles qu'on force. */
    private ArrayNode constats(JsonNode modele, Map<String, Boolean> forcees) {
        ArrayNode constats = json.createArrayNode();
        for (JsonNode section : modele.get("sections")) {
            for (JsonNode p : section.get("points")) {
                String code = p.get("code").asText();
                constats.addObject().put("point", code)
                        .put("reponse", forcees.getOrDefault(code, p.get("reponseNormale").asBoolean()));
            }
        }
        return constats;
    }

    private ResultActions inspecter(String jeton, long blocId, String decision, String observations,
                                    ArrayNode constats) throws Exception {
        ObjectNode demande = json.createObjectNode()
                .put("dateInspection", AUJOURDHUI.toString())
                .put("motif", "PERIODIQUE")
                .put("tivNom", "Gwendoline Marchand")
                .put("tivNumero", "12345")
                .put("filetageBouteille", "M25x2")
                .put("filetageRobinet", "M25x2")
                .put("marquageRequalification", "Tête de cheval 03/24")
                .put("decision", decision)
                .put("observations", observations);
        demande.set("constats", constats);
        return mvc.perform(post("/api/materiel/equipements/" + blocId + "/inspections-tiv")
                .header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(demande)));
    }

    private List<String> sections(JsonNode modele) {
        List<String> codes = new ArrayList<>();
        for (JsonNode s : modele.get("sections")) codes.add(s.get("code").asText());
        return codes;
    }

    @Test
    @DisplayName("Les questions aluminium et service oxygène ne sont posées que pour les blocs concernés")
    void questionsSelonLeBloc() throws Exception {
        String dt = jeton("e3@club.fr");
        long acier = creerBloc(dt, "B-T01", "ACIER", false);
        long aluNitrox = creerBloc(dt, "B-T02", "ALUMINIUM", true);

        assertThat(sections(lire("/api/materiel/equipements/" + acier + "/inspections-tiv/modele", dt)))
                .contains("ROBINETTERIE", "PAROI").doesNotContain("ALUMINIUM", "OXYGENE");
        assertThat(sections(lire("/api/materiel/equipements/" + aluNitrox + "/inspections-tiv/modele", dt)))
                .contains("ROBINETTERIE", "ALUMINIUM", "OXYGENE");

        mvc.perform(get("/api/materiel/equipements/" + acier + "/inspections-tiv/modele")
                        .header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Une fiche favorable entre au journal, donne les échéances et se relit comme compte rendu")
    void inspectionFavorable() throws Exception {
        String dt = jeton("e3@club.fr");
        long bloc = creerBloc(dt, "B-T03", "ACIER", false);
        JsonNode modele = lire("/api/materiel/equipements/" + bloc + "/inspections-tiv/modele", dt);

        JsonNode fiche = json.readTree(inspecter(dt, bloc, "FAVORABLE", "RAS",
                        constats(modele, Map.of("FILETAGE_LEGEREMENT_OXYDE", true)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());

        assertThat(fiche.get("numero").asText()).matches("TIV-" + AUJOURDHUI.getYear() + "-\\d{4}");
        assertThat(fiche.get("club").asText()).isNotBlank();
        assertThat(fiche.get("proprietaire").asText()).isEqualTo("Jean Brunet");
        assertThat(fiche.get("prochaineInspection").asText()).isEqualTo(AUJOURDHUI.plusMonths(12).toString());
        assertThat(fiche.get("prochaineRequalification").asText())
                .isEqualTo(AUJOURDHUI.minusYears(2).plusYears(6).toString());
        // Un défaut sans décision saisie reçoit celle de la fiche.
        JsonNode filetage = null;
        for (JsonNode s : fiche.get("sections")) {
            for (JsonNode c : s.get("constats")) {
                if (c.get("point").asText().equals("FILETAGE_LEGEREMENT_OXYDE")) filetage = c;
            }
        }
        assertThat(filetage.get("defaut").asBoolean()).isTrue();
        assertThat(filetage.get("decision").asText()).isEqualTo("À nettoyer");

        JsonNode journal = lire("/api/materiel/equipements/" + bloc, dt).get("journal");
        assertThat(journal.get(0).get("type").asText()).isEqualTo("INSPECTION_VISUELLE");
        assertThat(journal.get(0).get("resultat").asText()).isEqualTo("CONFORME");
        assertThat(journal.get(0).get("intervenant").asText()).isEqualTo("Gwendoline Marchand (TIV n° 12345)");
        assertThat(journal.get(0).get("inspectionTivId").asLong()).isEqualTo(fiche.get("id").asLong());
        assertThat(lire("/api/materiel/equipements/" + bloc, dt).get("equipement").get("statut").asText())
                .isEqualTo("DISPONIBLE");

        assertThat(lire("/api/materiel/inspections-tiv/" + fiche.get("id").asLong(), dt).get("numero").asText())
                .isEqualTo(fiche.get("numero").asText());

        // La fois suivante, le nom et le n° du TIV et les filetages du bloc sont repris.
        JsonNode suivant = lire("/api/materiel/equipements/" + bloc + "/inspections-tiv/modele", dt);
        assertThat(suivant.get("tivNumero").asText()).isEqualTo("12345");
        assertThat(suivant.get("filetageBouteille").asText()).isEqualTo("M25x2");
    }

    @Test
    @DisplayName("Fiche incomplète, défaut qui impose le rejet, avis défavorable non motivé : refusés")
    void refus() throws Exception {
        String dt = jeton("e3@club.fr");
        long bloc = creerBloc(dt, "B-T04", "ACIER", false);
        JsonNode modele = lire("/api/materiel/equipements/" + bloc + "/inspections-tiv/modele", dt);

        ArrayNode incomplets = constats(modele, Map.of());
        incomplets.remove(0);
        inspecter(dt, bloc, "FAVORABLE", null, incomplets)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(containsString("Fiche incomplète")));

        inspecter(dt, bloc, "FAVORABLE", null, constats(modele, Map.of("CORROSION_FEUILLETANTE_LOCALISEE", true)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(containsString("Avis favorable impossible")));

        inspecter(dt, bloc, "DEFAVORABLE", " ", constats(modele, Map.of()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(containsString("observations")));

        ArrayNode alu = constats(modele, Map.of());
        alu.addObject().put("point", "COL_ALUMINIUM_SANS_FISSURE").put("reponse", true);
        inspecter(dt, bloc, "FAVORABLE", null, alu)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(containsString("ne concerne pas ce bloc")));

        assertThat(lire("/api/materiel/equipements/" + bloc, dt).get("journal")).isEmpty();
    }

    @Test
    @DisplayName("Un TIV remplit la fiche d'inspection et consulte le matériel, sans gérer l'inventaire ni les prêts")
    void roleTiv() throws Exception {
        String dt = jeton("e3@club.fr");
        String tiv = jeton("e2@club.fr");
        long bloc = creerBloc(dt, "B-T07", "ACIER", false);
        JsonNode modele = lire("/api/materiel/equipements/" + bloc + "/inspections-tiv/modele", tiv);

        JsonNode fiche = json.readTree(inspecter(tiv, bloc, "FAVORABLE", null, constats(modele, Map.of()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(lire("/api/materiel/inspections-tiv/" + fiche.get("id").asLong(), tiv).get("tivNom").asText())
                .isEqualTo("Gwendoline Marchand");

        // Il voit qu'un bloc est prêté, pas à qui, et pas l'historique des prêts.
        JsonNode inventaire = lire("/api/materiel/equipements", tiv);
        JsonNode b01 = null;
        for (JsonNode e : inventaire) if (e.get("reference").asText().equals("B-01")) b01 = e;
        assertThat(b01.get("pretEnCours").get("emprunteur").asText()).isEqualTo("un membre du club");
        JsonNode ficheB01 = lire("/api/materiel/equipements/" + b01.get("id").asLong(), tiv);
        assertThat(ficheB01.get("prets")).isEmpty();
        assertThat(lire("/api/materiel/equipements/" + b01.get("id").asLong(), dt).get("prets")).isNotEmpty();

        mvc.perform(post("/api/materiel/equipements").header("Authorization", tiv)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"type":"BLOC","reference":"B-T08"}"""))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/materiel/equipements/" + bloc + "/interventions").header("Authorization", tiv)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"type":"CONTROLE","dateIntervention":"%s"}""".formatted(AUJOURDHUI)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/materiel/prets").header("Authorization", tiv))
                .andExpect(status().isForbidden());
        // Sans le rôle TIV, rien.
        mvc.perform(get("/api/materiel/equipements").header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un admin donne et retire le rôle TIV dans l'écran Moniteurs")
    void donnerLeRoleTiv() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode cree = json.readTree(mvc.perform(post("/api/admin/moniteurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"tiv.essai@club.fr","nom":"Essai","prenom":"Tiv","niveauEncadrement":"E1",
                                 "tiv":true}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tiv").value(true))
                .andExpect(jsonPath("$.directeurTechnique").value(false))
                .andReturn().getResponse().getContentAsString());
        mvc.perform(put("/api/admin/moniteurs/" + cree.get("id").asLong()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"tiv.essai@club.fr","nom":"Essai","prenom":"Tiv","niveauEncadrement":"E1",
                                 "tiv":false}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tiv").value(false));
    }

    @Test
    @DisplayName("Un avis défavorable bloque les prêts ; un rebut met le bloc au rebut")
    void defavorableEtRebut() throws Exception {
        String dt = jeton("e3@club.fr");
        long defavorable = creerBloc(dt, "B-T05", "ACIER", false);
        long rebut = creerBloc(dt, "B-T06", "ACIER", false);
        JsonNode modele = lire("/api/materiel/equipements/" + defavorable + "/inspections-tiv/modele", dt);

        JsonNode fiche = json.readTree(inspecter(dt, defavorable, "DEFAVORABLE", "Chancre profond près du fond",
                        constats(modele, Map.of("CHANCRES", true)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(fiche.get("prochaineInspection").isNull()).isTrue();
        assertThat(lire("/api/materiel/equipements/" + defavorable, dt).get("equipement").get("statut").asText())
                .isEqualTo("A_REGULARISER");

        inspecter(dt, rebut, "REBUT", "Corrosion feuilletante généralisée",
                        constats(modele, Map.of("CORROSION_FEUILLETANTE_GENERALISEE", true)))
                .andExpect(status().isCreated());
        JsonNode e = lire("/api/materiel/equipements/" + rebut, dt).get("equipement");
        assertThat(e.get("statut").asText()).isEqualTo("REBUTE");
        assertThat(e.get("motifRebut").asText()).contains("Gwendoline Marchand", "feuilletante");
    }
}
