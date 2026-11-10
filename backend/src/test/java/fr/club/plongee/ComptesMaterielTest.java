package fr.club.plongee;

import fr.club.plongee.securite.domain.RoleNom;
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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Directeur technique qui n'est pas moniteur du club (choix du club,
 * 2026-11-10) : compte créé par un administrateur dans un écran à part,
 * qui ne gère que le matériel, les prêts et les sorties auxquelles ils se
 * rattachent ; ni élèves, ni notation, ni planning, ni séjours comme
 * encadrant.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ComptesMaterielTest {

    private static final String MOT_DE_PASSE = "motdepasse-materiel";

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

    private static String nouvelEmail() {
        return "materiel-" + UUID.randomUUID().toString().substring(0, 8) + "@club.fr";
    }

    private static String demande(String email) {
        return """
                {"email":"%s","nom":"Detendeur","prenom":"Sam"}
                """.formatted(email);
    }

    /** Crée le compte par l'API, puis lui donne un mot de passe connu (à la place du lien d'invitation). */
    private long creerCompte(String admin, String email) throws Exception {
        String cree = mvc.perform(post("/api/admin/comptes-materiel").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(cree).get("id").asLong();
        var u = utilisateurs.findById(id).orElseThrow();
        u.setMotDePasse(encodeur.encode(MOT_DE_PASSE));
        utilisateurs.save(u);
        return id;
    }

    private List<String> emails(String url, String jeton) throws Exception {
        String reponse = mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> emails = new ArrayList<>();
        for (JsonNode n : json.readTree(reponse)) emails.add(n.get("email").asText());
        return emails;
    }

    @Test
    @DisplayName("L'administrateur crée un directeur technique qui n'est pas moniteur, absent de la liste des moniteurs")
    void creationParLAdministrateur() throws Exception {
        String admin = admin();
        String email = nouvelEmail();
        long id = creerCompte(admin, email);

        assertThat(utilisateurs.findById(id).orElseThrow().getRoles()).containsExactly(RoleNom.DIRECTEUR_TECHNIQUE);
        assertThat(emails("/api/admin/comptes-materiel", admin)).contains(email);
        assertThat(emails("/api/admin/moniteurs", admin)).doesNotContain(email);
    }

    @Test
    @DisplayName("Un directeur technique qui n'est pas moniteur n'est pas encadrant des séjours, même d'une sortie qu'il a créée")
    void pasEncadrantDesSejours() throws Exception {
        String admin = admin();
        String email = nouvelEmail();
        long id = creerCompte(admin, email);
        String dt = jeton(email, MOT_DE_PASSE);

        // Les séjours de démonstration existent, mais il n'y participe pas.
        String liste = mvc.perform(get("/api/sejours").param("toutes", "true").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(liste)).isEmpty();
        long portCros = json.readTree(mvc.perform(get("/api/sejours").param("toutes", "true")
                        .header("Authorization", admin)).andReturn().getResponse().getContentAsString())
                .get(0).get("sortieId").asLong();
        mvc.perform(get("/api/sejours/" + portCros).header("Authorization", dt)).andExpect(status().isForbidden());

        // Il crée une sortie pour y rattacher des prêts, sans en devenir l'organisateur.
        String sortie = mvc.perform(post("/api/sorties").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nom\":\"Week-end matériel\",\"dateDebut\":\"2027-05-08\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String base = "/api/sejours/" + json.readTree(sortie).get("id").asLong();
        mvc.perform(get(base + "/repas").header("Authorization", dt)).andExpect(status().isForbidden());
        mvc.perform(put(base + "/infos").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infosPratiques\":\"Rendez-vous au local\"}"))
                .andExpect(status().isForbidden());

        // L'administrateur ne peut pas le désigner organisateur.
        mvc.perform(put(base + "/organisateurs").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"utilisateurIds\":[" + id + "]}"))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    @DisplayName("Un directeur technique qui n'est pas moniteur prête et reprend le matériel, et rien d'autre")
    void materielEtPretsSeulement() throws Exception {
        String admin = admin();
        String email = nouvelEmail();
        creerCompte(admin, email);
        String dt = jeton(email, MOT_DE_PASSE);
        String aujourdhui = fr.club.plongee.commun.Calendrier.aujourdhui().toString();

        String equipement = mvc.perform(post("/api/materiel/equipements").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"type":"GILET","reference":"G-%s","taille":"M"}
                                """.formatted(UUID.randomUUID().toString().substring(0, 6))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long equipementId = json.readTree(equipement).get("id").asLong();
        long eleveId = -1;
        String emprunteurs = mvc.perform(get("/api/materiel/emprunteurs").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        for (JsonNode e : json.readTree(emprunteurs)) {
            if ("ELEVE".equals(e.get("type").asText())) { eleveId = e.get("id").asLong(); break; }
        }
        String pret = mvc.perform(post("/api/materiel/prets").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"eleveId":%d,"datePret":"%s","equipementIds":[%d],"detendeursDesinfectes":false}
                                """.formatted(eleveId, aujourdhui, equipementId)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/materiel/prets/" + json.readTree(pret).get("id").asLong() + "/retour")
                        .header("Authorization", dt).contentType(MediaType.APPLICATION_JSON).content("""
                                {"dateRetour":"%s","equipements":[{"equipementId":%d,"incident":null,"horsService":false}]}
                                """.formatted(aujourdhui, equipementId)))
                .andExpect(status().isOk());

        // Élèves, moniteurs, présences, création de plongées, administration : refusés.
        mvc.perform(get("/api/eleves").header("Authorization", dt)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/moniteurs").header("Authorization", dt)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/comptes-materiel").header("Authorization", dt)).andExpect(status().isForbidden());
        mvc.perform(post("/api/seances/serie").header("Authorization", dt).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dateDebut":"2027-05-08","dateFin":"2027-05-09","plongeesParJour":2,"milieu":"NATUREL"}
                                """))
                .andExpect(status().isForbidden());
        // Aucun cursus d'élève.
        String cursus = mvc.perform(get("/api/cursus").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(cursus)).isEmpty();
        String paquet = mvc.perform(get("/api/synchronisation/paquet").header("Authorization", dt))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(paquet).get("cursus")).isEmpty();
    }

    @Test
    @DisplayName("Seul un administrateur gère les comptes de directeur technique non moniteur")
    void reserveALAdministrateur() throws Exception {
        String dtMoniteur = jeton("e3@club.fr", "plongee2026");
        mvc.perform(get("/api/admin/comptes-materiel").header("Authorization", dtMoniteur))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/comptes-materiel").header("Authorization", dtMoniteur)
                        .contentType(MediaType.APPLICATION_JSON).content(demande(nouvelEmail())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("L'administrateur modifie, désactive et réactive le compte, sans toucher aux moniteurs par cette voie")
    void modificationEtActivation() throws Exception {
        String admin = admin();
        String email = nouvelEmail();
        long id = creerCompte(admin, email);
        String nouveau = nouvelEmail();

        mvc.perform(put("/api/admin/comptes-materiel/" + id).header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"%s","nom":"Robinet","prenom":"Sam"}
                                """.formatted(nouveau)))
                .andExpect(status().isOk());
        assertThat(utilisateurs.findById(id).orElseThrow().getNom()).isEqualTo("Robinet");
        jeton(nouveau, MOT_DE_PASSE);

        mvc.perform(put("/api/admin/comptes-materiel/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"motDePasse\":\"%s\"}".formatted(nouveau, MOT_DE_PASSE)))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/admin/comptes-materiel/" + id + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":true}"))
                .andExpect(status().isOk());
        jeton(nouveau, MOT_DE_PASSE);
        mvc.perform(post("/api/admin/comptes-materiel/" + id + "/lien-reinitialisation").header("Authorization", admin))
                .andExpect(status().isAccepted());

        // Un moniteur (même directeur technique) ne se modifie pas par cette voie.
        long e3 = utilisateurs.findByEmailIgnoreCase("e3@club.fr").orElseThrow().getId();
        mvc.perform(put("/api/admin/comptes-materiel/" + e3 + "/activation").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actif\":false}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Un directeur technique non moniteur qui n'a rien enregistré se supprime")
    void suppressionSansHistorique() throws Exception {
        String admin = admin();
        long id = creerCompte(admin, nouvelEmail());

        mvc.perform(delete("/api/admin/comptes-materiel/" + id).header("Authorization", admin))
                .andExpect(status().isNoContent());
        assertThat(utilisateurs.findById(id)).isEmpty();
    }

    @Test
    @DisplayName("Un directeur technique non moniteur qui a écrit au journal du matériel ne se supprime pas : on le désactive")
    void pasDeSuppressionAvecHistorique() throws Exception {
        String admin = admin();
        String email = nouvelEmail();
        long id = creerCompte(admin, email);
        String dt = jeton(email, MOT_DE_PASSE);
        String equipement = mvc.perform(post("/api/materiel/equipements").header("Authorization", dt)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"type":"GILET","reference":"G-%s","taille":"L"}
                                """.formatted(UUID.randomUUID().toString().substring(0, 6))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/materiel/equipements/" + json.readTree(equipement).get("id").asLong() + "/interventions")
                        .header("Authorization", dt).contentType(MediaType.APPLICATION_JSON).content("""
                                {"type":"CONTROLE","dateIntervention":"%s","resultat":"CONFORME"}
                                """.formatted(fr.club.plongee.commun.Calendrier.aujourdhui())))
                .andExpect(status().is2xxSuccessful());

        mvc.perform(delete("/api/admin/comptes-materiel/" + id).header("Authorization", admin))
                .andExpect(status().isUnprocessableContent())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.detail")
                        .value(org.hamcrest.Matchers.containsString("désactivez son compte")));
        assertThat(utilisateurs.findById(id)).isPresent();
    }
}
