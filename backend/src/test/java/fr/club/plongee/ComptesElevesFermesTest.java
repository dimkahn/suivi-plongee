package fr.club.plongee;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Comptes élèves fermés, comme en production (choix du club, 2026) : le
 * compte de démonstration eleve@club.fr ne se connecte pas, les encadrants
 * si.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = "app.comptes-eleves-ouverts=false")
class ComptesElevesFermesTest {

    @Autowired MockMvc mvc;

    private static String connexion(String email) {
        return "{\"email\":\"%s\",\"motDePasse\":\"plongee2026\"}".formatted(email);
    }

    @Test
    @DisplayName("Un compte élève ne se connecte pas ; un moniteur, si")
    void compteEleveRefuse() throws Exception {
        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content(connexion("eleve@club.fr")))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail").value(containsString("comptes élèves ne sont pas encore ouverts")));
        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content(connexion("e2@club.fr")))
                .andExpect(status().isOk());
        // Un mauvais mot de passe reste un refus ordinaire : on ne dit pas que le compte existe.
        mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"eleve@club.fr\",\"motDePasse\":\"faux\"}"))
                .andExpect(status().is(401));
    }
}
