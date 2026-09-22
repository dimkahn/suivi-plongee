package fr.club.plongee;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * « Se souvenir de moi » : cookie persistant (Max-Age) si coche, cookie de
 * session sinon ; le choix survit a la rotation du jeton de rafraichissement.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SeSouvenirDeMoiTest {

    @Autowired MockMvc mvc;

    private String connexion(String seSouvenir) throws Exception {
        String champ = seSouvenir == null ? "" : ",\"seSouvenir\":" + seSouvenir;
        return mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"e1@club.fr\",\"motDePasse\":\"plongee2026\"" + champ + "}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Set-Cookie");
    }

    private String rafraichir(String setCookie) throws Exception {
        String jeton = setCookie.substring("refresh=".length(), setCookie.indexOf(';'));
        return mvc.perform(post("/api/auth/rafraichir").cookie(new Cookie("refresh", jeton)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Set-Cookie");
    }

    @Test
    @DisplayName("Case cochee : cookie persistant, conserve a la rotation")
    void persistant() throws Exception {
        String cookie = connexion("true");
        assertThat(cookie).contains("Max-Age=");
        assertThat(rafraichir(cookie)).contains("Max-Age=");
    }

    @Test
    @DisplayName("Case decochee : cookie de session, conserve a la rotation")
    void session() throws Exception {
        String cookie = connexion("false");
        assertThat(cookie).startsWith("refresh=").doesNotContain("Max-Age");
        assertThat(rafraichir(cookie)).startsWith("refresh=").doesNotContain("Max-Age");
    }

    @Test
    @DisplayName("Sans le champ (ancienne version de l'appli) : persistant, comme avant")
    void compatibilite() throws Exception {
        assertThat(connexion(null)).contains("Max-Age=");
    }
}
