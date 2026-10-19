package fr.club.plongee;

import fr.club.plongee.commun.Calendrier;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Validation d'une compétence (choix du club, 2026) : un nombre d'exercices
 * de maîtrise acquis fixé par compétence, puis l'accord des encadrants du
 * groupe d'entraînement de l'élève, comme un vote : la compétence est validée
 * dès que la moitié d'entre eux l'ont acceptée. Un référent du groupe la
 * valide seul.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ValidationParAccordTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String admin;
    private Long eleveId;
    private Long seanceId;
    private Long groupeId;
    private Long blocModifie;
    private Long referentielModifie;
    private Long moniteurCree;

    private JsonNode session(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse);
    }

    private String jeton(String email) throws Exception {
        return "Bearer " + session(email).get("jetonAcces").asText();
    }

    private long id(String email) throws Exception {
        return session(email).get("id").asLong();
    }

    private JsonNode envoyer(String methode, String url, String jeton, String corps, int attendu) throws Exception {
        var requete = switch (methode) {
            case "POST" -> post(url);
            case "PUT" -> put(url);
            case "DELETE" -> delete(url);
            default -> get(url);
        };
        String reponse = mvc.perform(requete.header("Authorization", jeton).contentType(MediaType.APPLICATION_JSON)
                        .content(corps == null ? "" : corps))
                .andExpect(status().is(attendu)).andReturn().getResponse().getContentAsString();
        return reponse.isEmpty() ? null : json.readTree(reponse);
    }

    /**
     * Un élève de N1 présent à une séance du jour, rangé dans un groupe dont
     * les encadrants et référents sont donnés (aucun groupe si {@code encadrants} est null).
     */
    private long eleveDuGroupe(List<Long> encadrants, List<Long> referents) throws Exception {
        admin = jeton("presidente@club.fr");
        long saison = -1;
        for (JsonNode s : envoyer("GET", "/api/saisons", admin, null, 200)) {
            if (s.get("ouverte").asBoolean()) saison = s.get("id").asLong();
        }
        eleveId = envoyer("POST", "/api/eleves", admin, """
                {"nom":"Accord","prenom":"Test","dateNaissance":"2000-01-01","autorisationLegale":true}""",
                201).get("id").asLong();
        seanceId = envoyer("POST", "/api/seances", admin, """
                {"dateSeance":"%s","ordre":21,"milieu":"ARTIFICIEL","lieu":"Piscine accord"}"""
                .formatted(Calendrier.aujourdhui()), 201).get("id").asLong();
        long cursus = envoyer("POST", "/api/cursus", admin, """
                {"eleveId":%d,"saisonId":%d,"niveau":"N1"}""".formatted(eleveId, saison), 201)
                .get("id").asLong();
        if (encadrants != null) {
            groupeId = envoyer("POST", "/api/groupes-entrainement", admin, """
                    {"saisonId":%d,"nom":"Groupe accord","encadrantIds":%s,"referentIds":%s}"""
                    .formatted(saison, encadrants, referents), 201).get("id").asLong();
            envoyer("PUT", "/api/groupes-entrainement/saison/" + saison + "/eleves/" + eleveId, admin, """
                    {"groupeId":%d}""".formatted(groupeId), 200);
        }
        envoyer("PUT", "/api/seances/" + seanceId + "/presences", jeton("e3@club.fr"), """
                [{"cursusId":%d,"statut":"PRESENT","atelier":"BLOC"}]""".formatted(cursus), 200);
        return cursus;
    }

    /** « S'immerger » du N1 : ses deux critères sont travaillés par chacun de ses exercices de maîtrise 3.7, 3.8, 3.9. */
    private JsonNode blocImmersion(long cursus) throws Exception {
        for (JsonNode b : envoyer("GET", "/api/cursus/" + cursus + "/grille", jeton("e3@club.fr"), null, 200).get("blocs")) {
            for (JsonNode e : b.get("exercices")) if ("3.7".equals(e.get("numero").asText())) return b;
        }
        throw new AssertionError("Compétence « S'immerger » introuvable");
    }

    private long exercice(JsonNode bloc, String numero) {
        for (JsonNode e : bloc.get("exercices")) if (numero.equals(e.get("numero").asText())) return e.get("id").asLong();
        throw new AssertionError("Exercice " + numero + " introuvable");
    }

    /** Tous les critères du bloc notés acquis sur un même exercice de maîtrise. */
    private void acquerir(long cursus, JsonNode bloc, String numero) throws Exception {
        for (JsonNode c : bloc.get("criteres")) {
            envoyer("POST", "/api/cursus/" + cursus + "/evaluations", jeton("e3@club.fr"), """
                    {"critereId":%d,"seanceId":%d,"statut":"ACQUIS","exerciceId":%d}"""
                    .formatted(c.get("id").asLong(), seanceId, exercice(bloc, numero)), 201);
        }
    }

    private String validation(long cursus, JsonNode bloc) {
        return "/api/cursus/" + cursus + "/competences/" + bloc.get("id").asLong() + "/validation";
    }

    @AfterEach
    void nettoyer() throws Exception {
        if (admin == null) return;
        if (blocModifie != null) {
            envoyer("PUT", "/api/referentiels/" + referentielModifie + "/blocs/" + blocModifie + "/maitrises-requises",
                    admin, "{\"nombre\":1}", 200);
        }
        if (groupeId != null) mvc.perform(delete("/api/groupes-entrainement/" + groupeId).header("Authorization", admin));
        if (eleveId != null) {
            mvc.perform(post("/api/eleves/" + eleveId + "/archivage").header("Authorization", admin));
            mvc.perform(delete("/api/eleves/" + eleveId).header("Authorization", admin));
        }
        if (seanceId != null) mvc.perform(delete("/api/seances/" + seanceId).header("Authorization", admin));
        // Ses accords sont partis avec le cursus de l'élève : le compte se supprime de nouveau.
        if (moniteurCree != null) {
            mvc.perform(delete("/api/admin/moniteurs/" + moniteurCree).header("Authorization", admin))
                    .andExpect(status().is2xxSuccessful());
        }
    }

    @Test
    @DisplayName("Sans référent, la compétence est validée quand la moitié des encadrants du groupe l'ont acceptée")
    void validationParLaMoitieDesEncadrants() throws Exception {
        long e1 = id("e1@club.fr"), e2 = id("e2@club.fr"), e3 = id("e3@club.fr");
        long cursus = eleveDuGroupe(List.of(e1, e2, e3), List.of());
        JsonNode bloc = blocImmersion(cursus);
        acquerir(cursus, bloc, "3.7");

        JsonNode grille = envoyer("GET", "/api/cursus/" + cursus + "/grille", jeton("e1@club.fr"), null, 200);
        assertThat(grille.get("votantIds")).extracting(JsonNode::asLong).containsExactlyInAnyOrder(e1, e2, e3);
        assertThat(grille.get("accordsRequis").asInt()).isEqualTo(2);

        // Le premier encadrant propose la validation : un accord sur les deux nécessaires.
        JsonNode etat = envoyer("POST", validation(cursus, bloc), jeton("e1@club.fr"), null, 201);
        assertThat(etat.get("validee").asBoolean()).isFalse();
        assertThat(etat.get("accords").asInt()).isEqualTo(1);
        assertThat(etat.get("accordsRequis").asInt()).isEqualTo(2);
        JsonNode b = blocImmersion(cursus);
        assertThat(b.get("valide").asBoolean()).isFalse();
        assertThat(b.get("accords")).extracting(a -> a.get("moniteurId").asLong()).containsExactly(e1);
        assertThat(b.get("accords").get(0).get("nom").asText()).isEqualTo("Tiago Nogueira");

        // On ne donne son accord qu'une fois.
        JsonNode refus = envoyer("POST", validation(cursus, bloc), jeton("e1@club.fr"), null, 422);
        assertThat(refus.get("detail").asText()).contains("déjà donné votre accord");

        // Le deuxième accord fait la moitié : la compétence est validée.
        etat = envoyer("POST", validation(cursus, bloc), jeton("e2@club.fr"), null, 201);
        assertThat(etat.get("validee").asBoolean()).isTrue();
        b = blocImmersion(cursus);
        assertThat(b.get("valide").asBoolean()).isTrue();
        assertThat(b.get("valideePar").asText()).isEqualTo("Flora Vasseur");
        assertThat(b.get("accords")).hasSize(2);
    }

    @Test
    @DisplayName("Un référent du groupe valide la compétence seul, sans attendre les autres encadrants")
    void referentValideSeul() throws Exception {
        long e1 = id("e1@club.fr"), e2 = id("e2@club.fr"), e3 = id("e3@club.fr");
        long cursus = eleveDuGroupe(List.of(e1, e2, e3), List.of(e2));
        JsonNode bloc = blocImmersion(cursus);
        acquerir(cursus, bloc, "3.7");

        JsonNode etat = envoyer("POST", validation(cursus, bloc), jeton("e2@club.fr"), null, 201);
        assertThat(etat.get("validee").asBoolean()).isTrue();
        assertThat(blocImmersion(cursus).get("valide").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("Un encadrant qui n'est pas du groupe de l'élève ne peut ni proposer ni accepter la validation")
    void encadrantHorsDuGroupeRefuse() throws Exception {
        long e1 = id("e1@club.fr"), e2 = id("e2@club.fr");
        long cursus = eleveDuGroupe(List.of(e1, e2), List.of());
        JsonNode bloc = blocImmersion(cursus);
        acquerir(cursus, bloc, "3.7");

        JsonNode refus = envoyer("POST", validation(cursus, bloc), jeton("e3@club.fr"), null, 422);
        assertThat(refus.get("detail").asText()).contains("encadrants de son groupe");
        assertThat(blocImmersion(cursus).get("accords")).isEmpty();
    }

    @Test
    @DisplayName("Un élève sans groupe d'entraînement voit sa compétence validée par un seul encadrant, comme avant")
    void sansGroupeValidationDirecte() throws Exception {
        long cursus = eleveDuGroupe(null, null);
        JsonNode bloc = blocImmersion(cursus);
        acquerir(cursus, bloc, "3.7");

        JsonNode etat = envoyer("POST", validation(cursus, bloc), jeton("e1@club.fr"), null, 201);
        assertThat(etat.get("validee").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("Un moniteur qui a donné un accord de validation ne se supprime pas : on désactive son compte")
    void moniteurAyantDonneUnAccordNonSupprime() throws Exception {
        admin = jeton("presidente@club.fr");
        String email = "accord-" + System.nanoTime() + "@club.fr";
        long moniteur = envoyer("POST", "/api/admin/moniteurs", admin, """
                {"email":"%s","nom":"Accord","prenom":"Alix","niveauEncadrement":"E1"}""".formatted(email), 201)
                .get("id").asLong();
        envoyer("PUT", "/api/admin/moniteurs/" + moniteur + "/mot-de-passe", admin,
                "{\"nouveauMotDePasse\":\"plongee2026\"}", 204);
        moniteurCree = moniteur;
        long cursus = eleveDuGroupe(List.of(moniteur, id("e1@club.fr"), id("e2@club.fr")), List.of());
        JsonNode bloc = blocImmersion(cursus);
        acquerir(cursus, bloc, "3.7");
        envoyer("POST", validation(cursus, bloc), jeton(email), null, 201);

        JsonNode refus = envoyer("DELETE", "/api/admin/moniteurs/" + moniteur, admin, null, 422);
        assertThat(refus.get("detail").asText()).contains("désactivez son compte");
    }

    @Test
    @DisplayName("Une compétence qui demande deux exercices de maîtrise acquis ne se valide pas avec un seul")
    void nombreDExercicesDeMaitriseRequis() throws Exception {
        long cursus = eleveDuGroupe(null, null);
        JsonNode bloc = blocImmersion(cursus);
        JsonNode grille = envoyer("GET", "/api/cursus/" + cursus + "/grille", admin, null, 200);
        referentielModifie = grille.get("referentielId").asLong();
        blocModifie = bloc.get("id").asLong();
        String url = "/api/referentiels/" + referentielModifie + "/blocs/" + blocModifie + "/maitrises-requises";

        // Réglé par un administrateur seulement, entre 1 et le nombre d'exercices de maîtrise actifs.
        envoyer("PUT", url, jeton("e3@club.fr"), "{\"nombre\":2}", 403);
        JsonNode refus = envoyer("PUT", url, admin, "{\"nombre\":4}", 422);
        assertThat(refus.get("detail").asText()).contains("3 exercices de maîtrise");
        envoyer("PUT", url, admin, "{\"nombre\":0}", 422);
        envoyer("PUT", url, admin, "{\"nombre\":2}", 200);

        acquerir(cursus, bloc, "3.7");
        JsonNode b = blocImmersion(cursus);
        assertThat(b.get("maitrisesRequises").asInt()).isEqualTo(2);
        assertThat(b.get("maitrisesAcquises").asInt()).isEqualTo(1);
        List<String> attendus = new ArrayList<>();
        b.get("maitriseAttendue").forEach(n -> attendus.add(n.asText()));
        assertThat(attendus).containsExactly("3.8", "3.9");

        refus = envoyer("POST", validation(cursus, bloc), jeton("e1@club.fr"), null, 422);
        assertThat(refus.get("detail").asText()).contains("2 exercices de maîtrise acquis");

        acquerir(cursus, bloc, "3.8");
        b = blocImmersion(cursus);
        assertThat(b.get("maitrisesAcquises").asInt()).isEqualTo(2);
        assertThat(b.get("maitriseAttendue")).isEmpty();
        envoyer("POST", validation(cursus, bloc), jeton("e1@club.fr"), null, 201);
    }
}
