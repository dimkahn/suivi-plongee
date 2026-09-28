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

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Matériel et prêts, de bout en bout, sur les données de démonstration
 * (V105). La base est partagée entre les tests : chacun travaille sur du
 * matériel qu'aucun autre ne modifie, ou crée le sien.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class MaterielTest {

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

    private JsonNode equipement(JsonNode inventaire, String reference) {
        for (JsonNode e : inventaire) if (e.get("reference").asText().equals(reference)) return e;
        throw new AssertionError("Équipement absent : " + reference);
    }

    private long eleveBerthier(String jeton) throws Exception {
        for (JsonNode e : lire("/api/materiel/emprunteurs", jeton)) {
            if (e.get("type").asText().equals("ELEVE") && e.get("nomComplet").asText().equals("Camille Berthier")) {
                return e.get("id").asLong();
            }
        }
        throw new AssertionError("Élève de démonstration introuvable");
    }

    @Test
    @DisplayName("Le matériel est réservé au directeur technique et aux admins")
    void acces() throws Exception {
        mvc.perform(get("/api/materiel/equipements").header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/materiel/equipements").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/materiel/equipements").header("Authorization", jeton("presidente@club.fr")))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("L'inventaire donne l'état de chaque équipement, calculé par le serveur")
    void inventaire() throws Exception {
        JsonNode inventaire = lire("/api/materiel/equipements", jeton("e3@club.fr"));

        assertThat(equipement(inventaire, "B-01").get("statut").asText()).isEqualTo("PRETE");
        assertThat(equipement(inventaire, "B-01").get("pretEnCours").get("emprunteur").asText())
                .isEqualTo("Camille Berthier");
        assertThat(equipement(inventaire, "B-01").get("prochaineInspection").asText())
                .isEqualTo(AUJOURDHUI.minusDays(90).plusMonths(12).toString());
        assertThat(equipement(inventaire, "B-02").get("statut").asText()).isEqualTo("DISPONIBLE");
        assertThat(equipement(inventaire, "B-02").get("alertes").get(0).get("gravite").asText())
                .isEqualTo("AVERTISSEMENT");
        assertThat(equipement(inventaire, "B-03").get("statut").asText()).isEqualTo("A_REGULARISER");
        assertThat(equipement(inventaire, "G-02").get("statut").asText()).isEqualTo("HORS_SERVICE");
        assertThat(equipement(inventaire, "D-02").get("statut").asText()).isEqualTo("DISPONIBLE");
    }

    @Test
    @DisplayName("Prêt refusé pour un équipement déjà prêté, hors échéance ou hors service")
    void pretRefuse() throws Exception {
        String dt = jeton("e3@club.fr");
        JsonNode inventaire = lire("/api/materiel/equipements", dt);
        long eleve = eleveBerthier(dt);

        mvc.perform(post("/api/materiel/prets").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"datePret":"%s","equipementIds":[%d,%d,%d]}"""
                                .formatted(eleve, AUJOURDHUI, equipement(inventaire, "B-01").get("id").asLong(),
                                        equipement(inventaire, "B-03").get("id").asLong(),
                                        equipement(inventaire, "G-02").get("id").asLong())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("Bloc B-01 : déjà prêté à Camille Berthier."),
                        org.hamcrest.Matchers.containsString("Bloc B-03 : Inspection visuelle (TIV) dépassée"),
                        org.hamcrest.Matchers.containsString("Gilet stabilisateur G-02 : Hors service."))));

        // Le TIV du B-02 tombe dans une quinzaine de jours : pas de prêt qui l'enjambe.
        mvc.perform(post("/api/materiel/prets").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"datePret":"%s","dateRetourPrevue":"%s","equipementIds":[%d]}"""
                                .formatted(eleve, AUJOURDHUI, AUJOURDHUI.plusDays(30),
                                        equipement(inventaire, "B-02").get("id").asLong())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("avant la fin du prêt")));
    }

    @Test
    @DisplayName("Un détendeur se désinfecte avant d'être prêté, et la désinfection entre au journal")
    void pretDetendeurEtRetourAvecIncident() throws Exception {
        String dt = jeton("e3@club.fr");
        long d02 = json.readTree(mvc.perform(post("/api/materiel/equipements").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"DETENDEUR","reference":"D-90","marque":"Apeks","periodiciteRevisionMois":24,
                                  "derniereRevision":"%s"}""".formatted(AUJOURDHUI.minusMonths(3))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        long c01 = equipement(lire("/api/materiel/equipements", dt), "C-01").get("id").asLong();
        long encadrant = 0;
        for (JsonNode e : lire("/api/materiel/emprunteurs", dt)) {
            if (e.get("nomComplet").asText().equals("Flora Vasseur")) encadrant = e.get("id").asLong();
        }
        String demande = """
                         {"utilisateurId":%d,"datePret":"%s","dateRetourPrevue":"%s","motif":"Sortie mer",
                          "equipementIds":[%d,%d],"detendeursDesinfectes":%s}""";

        mvc.perform(post("/api/materiel/prets").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content(demande.formatted(encadrant, AUJOURDHUI, AUJOURDHUI.plusDays(2), d02, c01, false)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("A322-81")));

        JsonNode pret = json.readTree(mvc.perform(post("/api/materiel/prets").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(demande.formatted(encadrant, AUJOURDHUI, AUJOURDHUI.plusDays(2), d02, c01, true)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(pret.get("emprunteur").asText()).isEqualTo("Flora Vasseur");
        assertThat(pret.get("pretePar").asText()).isEqualTo("Gwendoline Marchand");
        assertThat(pret.get("equipements")).hasSize(2);

        JsonNode fiche = lire("/api/materiel/equipements/" + d02, dt);
        assertThat(fiche.get("equipement").get("statut").asText()).isEqualTo("PRETE");
        assertThat(fiche.get("journal").get(0).get("type").asText()).isEqualTo("DESINFECTION");
        assertThat(fiche.get("journal").get(0).get("pretId").asLong()).isEqualTo(pret.get("id").asLong());

        mvc.perform(post("/api/materiel/prets/" + pret.get("id").asLong() + "/retour").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateRetour":"%s","equipements":[{"equipementId":%d,"incident":"Fuite au 2e étage","horsService":true}]}"""
                                .formatted(AUJOURDHUI, d02)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dateRetour").value(AUJOURDHUI.toString()));

        JsonNode apres = lire("/api/materiel/equipements/" + d02, dt);
        assertThat(apres.get("equipement").get("statut").asText()).isEqualTo("HORS_SERVICE");
        assertThat(apres.get("journal").get(0).get("type").asText()).isEqualTo("INCIDENT");
        assertThat(apres.get("prets").get(0).get("recuPar").asText()).isEqualTo("Gwendoline Marchand");
    }

    @Test
    @DisplayName("Un bloc créé avec son historique est aussitôt prêtable ; supprimé seulement sans historique")
    void creationDUnBloc() throws Exception {
        String dt = jeton("e3@club.fr");
        JsonNode bloc = json.readTree(mvc.perform(post("/api/materiel/equipements").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"BLOC","reference":"B-10","marque":"Roth","volumeLitres":12,
                                  "pressionServiceBar":232,"matiere":"ACIER","regimeTiv":true,
                                  "derniereInspectionVisuelle":"%s","derniereRequalification":"%s"}"""
                                .formatted(AUJOURDHUI.minusMonths(1), AUJOURDHUI.minusYears(1))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(bloc.get("statut").asText()).isEqualTo("DISPONIBLE");
        assertThat(bloc.get("prochaineRequalification").asText())
                .isEqualTo(AUJOURDHUI.minusYears(1).plusYears(6).toString());

        mvc.perform(post("/api/materiel/equipements").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"GILET","reference":"b-10"}"""))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(delete("/api/materiel/equipements/" + bloc.get("id").asLong()).header("Authorization", dt))
                .andExpect(status().isUnprocessableEntity());

        mvc.perform(post("/api/materiel/equipements/" + bloc.get("id").asLong() + "/interventions")
                        .header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"type":"INSPECTION_VISUELLE","dateIntervention":"%s","resultat":"NON_CONFORME",
                                  "intervenant":"TIV n° 12345","description":"Corrosion au col"}""".formatted(AUJOURDHUI)))
                .andExpect(status().isCreated());
        assertThat(lire("/api/materiel/equipements/" + bloc.get("id").asLong(), dt)
                .get("equipement").get("statut").asText()).isEqualTo("A_REGULARISER");

        mvc.perform(post("/api/materiel/equipements/" + bloc.get("id").asLong() + "/rebut")
                        .header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateRebut":"%s","motif":"Corrosion au col"}""".formatted(AUJOURDHUI)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("REBUTE"));
    }

    @Test
    @DisplayName("Un admin donne le rôle de directeur technique à un moniteur")
    void attributionDuRole() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode moniteurs = lire("/api/admin/moniteurs", admin);
        JsonNode e2 = null;
        for (JsonNode m : moniteurs) if (m.get("email").asText().equals("e2@club.fr")) e2 = m;
        assertThat(e2.get("directeurTechnique").asBoolean()).isFalse();

        mvc.perform(put("/api/admin/moniteurs/" + e2.get("id").asLong()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"e2@club.fr","nom":"Vasseur","prenom":"Flora","niveauEncadrement":"E2",
                                  "directeurTechnique":true}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.directeurTechnique").value(true))
                .andExpect(jsonPath("$.admin").value(false));

        mvc.perform(get("/api/materiel/equipements").header("Authorization", jeton("e2@club.fr")))
                .andExpect(status().isOk());

        mvc.perform(put("/api/admin/moniteurs/" + e2.get("id").asLong()).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"e2@club.fr","nom":"Vasseur","prenom":"Flora","niveauEncadrement":"E2",
                                  "directeurTechnique":false}"""))
                .andExpect(jsonPath("$.directeurTechnique").value(false));
    }

    @Test
    @DisplayName("Photos avant et après un prêt : ajoutées, relues, figées une fois le prêt rendu")
    void photosAvantEtApres() throws Exception {
        String dt = jeton("e3@club.fr");
        long c02 = equipement(lire("/api/materiel/equipements", dt), "C-02").get("id").asLong();
        JsonNode pret = json.readTree(mvc.perform(post("/api/materiel/prets").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"eleveId":%d,"datePret":"%s","equipementIds":[%d]}"""
                                .formatted(eleveBerthier(dt), AUJOURDHUI, c02)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String photos = "/api/materiel/prets/" + pret.get("id").asLong() + "/photos";
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F'};

        JsonNode avant = json.readTree(mvc.perform(multipart(photos).file(new MockMultipartFile("fichier", "a.jpg", "image/jpeg", jpeg))
                        .param("moment", "AVANT").param("equipementId", String.valueOf(c02)).param("legende", "Genou gauche")
                        .header("Authorization", dt))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(avant.get("equipementReference").asText()).isEqualTo("C-02");
        assertThat(avant.get("prisePar").asText()).isEqualTo("Gwendoline Marchand");

        // Un fichier qui n'est pas une image, même annoncé comme telle, est refusé.
        mvc.perform(multipart(photos).file(new MockMultipartFile("fichier", "x.jpg", "image/jpeg", "pas une image".getBytes()))
                        .param("moment", "AVANT").header("Authorization", dt))
                .andExpect(status().isUnprocessableEntity());

        byte[] relu = mvc.perform(get("/api/materiel/prets/photos/" + avant.get("id").asLong()).header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(relu).isEqualTo(jpeg);
        mvc.perform(get("/api/materiel/prets/photos/" + avant.get("id").asLong()).header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/materiel/prets/" + pret.get("id").asLong() + "/retour").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateRetour":"%s"}""".formatted(AUJOURDHUI)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photosAvant").value(1))
                .andExpect(jsonPath("$.photosApres").value(0));

        mvc.perform(delete("/api/materiel/prets/photos/" + avant.get("id").asLong()).header("Authorization", dt))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(multipart(photos).file(new MockMultipartFile("fichier", "b.jpg", "image/jpeg", jpeg))
                        .param("moment", "AVANT").header("Authorization", dt))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(multipart(photos).file(new MockMultipartFile("fichier", "c.jpg", "image/jpeg", jpeg))
                        .param("moment", "APRES").header("Authorization", dt))
                .andExpect(status().isCreated());

        assertThat(lire(photos, dt)).extracting(p -> p.get("moment").asText()).containsExactly("AVANT", "APRES");
    }
}
