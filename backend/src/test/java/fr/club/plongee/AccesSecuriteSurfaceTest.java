package fr.club.plongee;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.securite.repository.UtilisateurRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Comptes « sécurité surface » (choix du club, 2026) : créés pour une
 * sortie, une séance ou quelques séances, ils ne voient et ne complètent
 * que les fiches de ces séances, et se désactivent d'eux-mêmes passé la
 * date de fin d'accès ; l'administrateur peut les réactiver pour d'autres
 * séances.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AccesSecuriteSurfaceTest {

    private static final String MOT_DE_PASSE = "motdepasse-surface";
    private static final String REALISE = "[{\"numero\":1,\"profondeurRealisee\":18,\"dureeRealisee\":38}]";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encodeur;

    private String jeton(String email, String motDePasse) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"%s\"}".formatted(email, motDePasse)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private String admin() throws Exception {
        return jeton("presidente@club.fr", "plongee2026");
    }

    private long creerSeance(String admin) throws Exception {
        String reponse = mvc.perform(post("/api/seances").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"dateSeance":"2026-06-13","milieu":"NATUREL","lieu":"Carriere","profondeurMax":20}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(reponse).get("id").asLong();
    }

    private long dpId(String admin) throws Exception {
        String reponse = mvc.perform(get("/api/admin/moniteurs").header("Authorization", admin))
                .andReturn().getResponse().getContentAsString();
        for (JsonNode m : json.readTree(reponse)) {
            if ("e3@club.fr".equals(m.get("email").asText())) return m.get("id").asLong();
        }
        throw new IllegalStateException("E3 introuvable");
    }

    private void etablirFiche(String admin, long seance) throws Exception {
        mvc.perform(put("/api/seances/" + seance + "/fiche-securite").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"dpId":%d,"palanquees":[{"numero":1,"profondeurPrevue":20,"dureePrevue":40,
                                  "membres":[{"nom":"Dulac","prenom":"Anis","aptitude":"N2","fonction":"PLONGEUR"}]}]}
                                """.formatted(dpId(admin))))
                .andExpect(status().isOk());
    }

    private static String demande(String email, LocalDate fin, long... seances) {
        List<String> ids = new ArrayList<>();
        for (long s : seances) ids.add(String.valueOf(s));
        return """
                {"email":"%s","nom":"Bouee","prenom":"Lou","seanceIds":[%s],"accesJusquAu":%s}
                """.formatted(email, String.join(",", ids), fin == null ? "null" : "\"" + fin + "\"");
    }

    private static String nouvelEmail() {
        return "surface-" + UUID.randomUUID().toString().substring(0, 8) + "@club.fr";
    }

    /** Crée le compte par l'API, puis lui donne un mot de passe connu (à la place du lien d'invitation). */
    private long creerCompte(String admin, String email, LocalDate fin, long... seances) throws Exception {
        String cree = mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(email, fin, seances)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(cree).get("id").asLong();
        var u = utilisateurs.findById(id).orElseThrow();
        u.setMotDePasse(encodeur.encode(MOT_DE_PASSE));
        utilisateurs.save(u);
        return id;
    }

    @Test
    @DisplayName("La sécurité surface ne voit et ne complète que les fiches des séances qui lui sont confiées")
    void seulementSesSeances() throws Exception {
        String admin = admin();
        long confiee = creerSeance(admin);
        long autre = creerSeance(admin);
        etablirFiche(admin, confiee);
        etablirFiche(admin, autre);
        String email = nouvelEmail();
        creerCompte(admin, email, Calendrier.aujourdhui().plusDays(7), confiee);
        String surface = jeton(email, MOT_DE_PASSE);

        String liste = mvc.perform(get("/api/seances").header("Authorization", surface))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Long> ids = new ArrayList<>();
        for (JsonNode s : json.readTree(liste)) ids.add(s.get("id").asLong());
        assertThat(ids).containsExactly(confiee);

        mvc.perform(get("/api/seances/" + confiee + "/fiche-securite").header("Authorization", surface))
                .andExpect(status().isOk());
        mvc.perform(put("/api/seances/" + confiee + "/fiche-securite/realise").header("Authorization", surface)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isOk());

        mvc.perform(get("/api/seances/" + autre + "/fiche-securite").header("Authorization", surface))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("confiées")));
        mvc.perform(put("/api/seances/" + autre + "/fiche-securite/realise").header("Authorization", surface)
                        .contentType(MediaType.APPLICATION_JSON).content(REALISE))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(get("/api/seances/" + autre + "/fiche-securite/fiche.pdf").header("Authorization", surface))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(get("/api/seances/" + autre + "/fiche-securite/fiche.xlsx").header("Authorization", surface))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    @DisplayName("Un compte de sécurité surface se crée pour au moins une séance, avec une date de fin d'accès à venir")
    void seancesEtDateObligatoires() throws Exception {
        String admin = admin();
        long seance = creerSeance(admin);
        LocalDate demain = Calendrier.aujourdhui().plusDays(1);

        mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(nouvelEmail(), demain)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("au moins une séance")));
        mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(nouvelEmail(), null, seance)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("date de fin d'accès")));
        mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(demande(nouvelEmail(), Calendrier.aujourdhui().minusDays(1), seance)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value(containsString("déjà passée")));

        String email = nouvelEmail();
        mvc.perform(post("/api/admin/securite-surface").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(email, demain, seance)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actif").value(true))
                .andExpect(jsonPath("$.accesJusquAu").value(demain.toString()))
                .andExpect(jsonPath("$.seances[0].id").value(seance))
                .andExpect(jsonPath("$.seances[0].date").value("2026-06-13"));
    }

    @Test
    @DisplayName("Passé la date de fin d'accès, le compte est désactivé ; l'administrateur le réactive pour d'autres séances")
    void desactivationEtReactivation() throws Exception {
        String admin = admin();
        long premiere = creerSeance(admin);
        long seconde = creerSeance(admin);
        String email = nouvelEmail();
        long id = creerCompte(admin, email, Calendrier.aujourdhui(), premiere);
        jeton(email, MOT_DE_PASSE);

        // Le lendemain de la date de fin d'accès.
        var u = utilisateurs.findById(id).orElseThrow();
        u.setAccesJusquAu(Calendrier.aujourdhui().minusDays(1));
        utilisateurs.save(u);

        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"%s\"}".formatted(email, MOT_DE_PASSE)))
                .andExpect(status().isUnauthorized());
        String liste = mvc.perform(get("/api/admin/securite-surface").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode compte = null;
        for (JsonNode c : json.readTree(liste)) if (c.get("id").asLong() == id) compte = c;
        assertThat(compte).isNotNull();
        assertThat(compte.get("actif").asBoolean()).isFalse();

        // Réactiver sans nouvelle date : refusé.
        mvc.perform(put("/api/admin/securite-surface/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":true,\"seanceIds\":[%d]}"
                                .formatted(seconde)))
                .andExpect(status().isUnprocessableContent());

        LocalDate fin = Calendrier.aujourdhui().plusDays(3);
        mvc.perform(put("/api/admin/securite-surface/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"actif":true,"seanceIds":[%d],"accesJusquAu":"%s"}
                                """.formatted(seconde, fin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(true))
                .andExpect(jsonPath("$.accesJusquAu").value(fin.toString()))
                .andExpect(jsonPath("$.seances.length()").value(1))
                .andExpect(jsonPath("$.seances[0].id").value(seconde));

        String surface = jeton(email, MOT_DE_PASSE);
        mvc.perform(get("/api/seances/" + premiere + "/fiche-securite").header("Authorization", surface))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    @DisplayName("Un compte désactivé à la main reste désactivé, même avant sa date de fin d'accès")
    void desactivationManuelle() throws Exception {
        String admin = admin();
        long seance = creerSeance(admin);
        String email = nouvelEmail();
        long id = creerCompte(admin, email, Calendrier.aujourdhui().plusDays(5), seance);

        mvc.perform(put("/api/admin/securite-surface/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(false));
        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"%s\"}".formatted(email, MOT_DE_PASSE)))
                .andExpect(status().isUnauthorized());
    }
}
