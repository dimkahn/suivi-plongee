package fr.club.plongee;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import fr.club.plongee.ia.service.AssistantIaService;
import fr.club.plongee.ia.service.EnvoiCodeIa;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.mock.web.MockMultipartFile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Assistant IA : droits, rôle réservé aux admins, et le parcours branche →
 * tests → merge → tag poussé, sur un dépôt git jetable (avec son propre
 * « origin » nu) et un faux Maven. Claude Code lui-même n'est pas lancé.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AssistantIaTest {

    private static final Path RACINE;
    private static final Path DEPOT;
    private static final Path ORIGINE;

    static {
        try {
            RACINE = Files.createTempDirectory("assistant-ia-");
            ORIGINE = RACINE.resolve("origine.git");
            DEPOT = RACINE.resolve("depot");
            git(RACINE, "init", "-q", "--bare", "-b", "master", ORIGINE.toString());
            git(RACINE, "init", "-q", "-b", "master", DEPOT.toString());
            Files.writeString(DEPOT.resolve("LISEZ-MOI.txt"), "Dépôt de test\n");
            git(DEPOT, "add", ".");
            git(DEPOT, "commit", "-q", "-m", "Premier commit");
            git(DEPOT, "remote", "add", "origin", ORIGINE.toString());
            git(DEPOT, "push", "-q", "origin", "master");

            // Faux Claude Code : garde le message (entrée standard) et ses arguments, puis termine son tour.
            Path fauxClaude = RACINE.resolve("faux-claude.sh");
            Files.writeString(fauxClaude, "#!/bin/sh\ncat > \"" + RACINE.resolve("message.txt") + "\"\n"
                    + "echo \"$@\" > \"" + RACINE.resolve("arguments.txt") + "\"\n"
                    + "echo '{\"type\":\"result\",\"is_error\":false,\"duration_ms\":1}'\n");
            Files.setPosixFilePermissions(fauxClaude, PosixFilePermissions.fromString("rwxr-xr-x"));

            Path fauxMvn = RACINE.resolve("faux-mvn.sh");
            Files.writeString(fauxMvn, "#!/bin/sh\necho \"tests simulés\"\nexit 0\n");
            Files.setPosixFilePermissions(fauxMvn, PosixFilePermissions.fromString("rwxr-xr-x"));
        } catch (IOException | InterruptedException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void proprietes(DynamicPropertyRegistry registre) {
        registre.add("app.ia.depot", DEPOT::toString);
        registre.add("app.ia.dossier-travail", () -> RACINE.resolve("travail").toString());
        registre.add("app.ia.mvn", () -> RACINE.resolve("faux-mvn.sh").toString());
        registre.add("app.ia.email-code", () -> "responsable-ia@club.fr");
        registre.add("app.ia.delai-entre-codes-secondes", () -> "0");
        registre.add("app.ia.claude", () -> RACINE.resolve("faux-claude.sh").toString());
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired FauxEnvoiCode envoi;

    /** Garde le dernier code « envoyé » au lieu de passer par un serveur SMTP. */
    static class FauxEnvoiCode implements EnvoiCodeIa {
        volatile String destinataire;
        volatile String code;

        @Override
        public void envoyer(String destinataire, String code, String demandeur, int minutesDeValidite) {
            this.destinataire = destinataire;
            this.code = code;
        }
    }

    @TestConfiguration
    static class Configuration {
        @Bean @Primary
        FauxEnvoiCode fauxEnvoiCode() {
            return new FauxEnvoiCode();
        }
    }

    /** Demande un code et le saisit : l'assistant est ensuite ouvert pour ce jeton. */
    private void ouvrirAcces(String jeton) throws Exception {
        if (lire("/api/ia/acces", jeton).get("ouvert").asBoolean()) return;
        poster("/api/ia/acces/code", jeton, "{}", 200);
        poster("/api/ia/acces", jeton, """
                {"code":"%s"}""".formatted(envoi.code), 200);
    }

    private static String git(Path dossier, String... arguments) throws IOException, InterruptedException {
        String[] commande = new String[arguments.length + 5];
        commande[0] = "git";
        commande[1] = "-c";
        commande[2] = "user.name=Test";
        commande[3] = "-c";
        commande[4] = "user.email=test@club.fr";
        System.arraycopy(arguments, 0, commande, 5, arguments.length);
        Process p = new ProcessBuilder(commande).directory(dossier.toFile()).redirectErrorStream(true).start();
        String sortie = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
        if (p.waitFor() != 0) throw new IllegalStateException(String.join(" ", commande) + " : " + sortie);
        return sortie;
    }

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private JsonNode poster(String url, String jeton, String corps, int statutAttendu) throws Exception {
        String reponse = mvc.perform(post(url).header("Authorization", jeton)
                        .contentType(MediaType.APPLICATION_JSON).content(corps))
                .andExpect(status().is(statutAttendu))
                .andReturn().getResponse().getContentAsString();
        return reponse.isBlank() ? null : json.readTree(reponse);
    }

    private JsonNode lire(String url, String jeton) throws Exception {
        return json.readTree(mvc.perform(get(url).header("Authorization", jeton))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    @DisplayName("L'assistant IA est réservé aux admins qui ont le rôle IA")
    void acces() throws Exception {
        mvc.perform(get("/api/ia/etat").header("Authorization", jeton("e1@club.fr")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/ia/etat").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isForbidden());
        String admin = jeton("presidente@club.fr");
        ouvrirAcces(admin);
        mvc.perform(get("/api/ia/etat").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.brancheCourante").value("master"));
    }

    @Test
    @DisplayName("Sans le code envoyé par courriel, l'assistant reste fermé, même à un admin IA")
    void codeDAcces() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(delete("/api/ia/acces").header("Authorization", admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/ia/sessions").header("Authorization", admin)).andExpect(status().isForbidden());
        mvc.perform(get("/api/ia/etat").header("Authorization", admin)).andExpect(status().isForbidden());
        // Les rôles restent exigés pour demander un code.
        mvc.perform(post("/api/ia/acces/code").header("Authorization", jeton("e3@club.fr")))
                .andExpect(status().isForbidden());

        JsonNode etat = poster("/api/ia/acces/code", admin, "{}", 200);
        assertThat(envoi.destinataire).isEqualTo("responsable-ia@club.fr");
        assertThat(etat.get("destinataire").asText()).isEqualTo("r•••a@club.fr");
        assertThat(etat.get("codeEnvoye").asBoolean()).isTrue();
        assertThat(envoi.code).matches("[A-Z2-9]{8}");

        JsonNode refus = poster("/api/ia/acces", admin, """
                {"code":"FAUXCODE"}""", 422);
        assertThat(refus.get("detail").asText()).contains("4 essai(s) restant(s)");
        // Casse et espaces ignorés à la saisie.
        String saisi = envoi.code.substring(0, 4).toLowerCase() + " " + envoi.code.substring(4);
        JsonNode ouvert = poster("/api/ia/acces", admin, """
                {"code":"%s"}""".formatted(saisi), 200);
        assertThat(ouvert.get("ouvert").asBoolean()).isTrue();
        mvc.perform(get("/api/ia/sessions").header("Authorization", admin)).andExpect(status().isOk());

        // Un code ne sert qu'une fois.
        poster("/api/ia/acces", admin, """
                {"code":"%s"}""".formatted(envoi.code), 422);
    }

    @Test
    @DisplayName("Cinq erreurs annulent le code")
    void cinqErreurs() throws Exception {
        String admin = jeton("presidente@club.fr");
        mvc.perform(delete("/api/ia/acces").header("Authorization", admin)).andExpect(status().isNoContent());
        poster("/api/ia/acces/code", admin, "{}", 200);
        String bon = envoi.code;
        for (int i = 0; i < 4; i++) poster("/api/ia/acces", admin, "{\"code\":\"MAUVAIS\"}", 422);
        JsonNode annule = poster("/api/ia/acces", admin, "{\"code\":\"MAUVAIS\"}", 422);
        assertThat(annule.get("detail").asText()).contains("il est annulé");
        JsonNode trop = poster("/api/ia/acces", admin, """
                {"code":"%s"}""".formatted(bon), 422);
        assertThat(trop.get("detail").asText()).contains("Aucun code en cours de validité");
        ouvrirAcces(admin);
    }

    @Test
    @DisplayName("Le rôle IA ne se donne qu'à un admin et part avec lui")
    void roleReserveAuxAdmins() throws Exception {
        String admin = jeton("presidente@club.fr");
        JsonNode refus = poster("/api/admin/moniteurs", admin, """
                {"email":"ia-sans-admin@club.fr","nom":"Test","prenom":"Ia","niveauEncadrement":"E2",
                 "admin":false,"ia":true}""", 422);
        assertThat(refus.get("detail").asText()).contains("réservé aux administrateurs");

        JsonNode cree = poster("/api/admin/moniteurs", admin, """
                {"email":"ia-admin@club.fr","nom":"Test","prenom":"Ia","niveauEncadrement":"E2",
                 "admin":true,"ia":true}""", 201);
        assertThat(cree.get("ia").asBoolean()).isTrue();

        String modification = mvc.perform(put("/api/admin/moniteurs/" + cree.get("id").asLong())
                        .header("Authorization", admin).contentType(MediaType.APPLICATION_JSON).content("""
                                {"email":"ia-admin@club.fr","nom":"Test","prenom":"Ia","niveauEncadrement":"E2",
                                 "admin":false}"""))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(modification).get("admin").asBoolean()).isFalse();
        assertThat(json.readTree(modification).get("ia").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("Branche, tests, merge sur master, tag poussé : chaque étape exige la précédente")
    void parcoursDeLivraison() throws Exception {
        String admin = jeton("presidente@club.fr");
        ouvrirAcces(admin);
        JsonNode session = poster("/api/ia/sessions", admin, """
                {"titre":"Ajouter l'écran des bouées"}""", 201);
        long id = session.get("id").asLong();
        String branche = session.get("branche").asText();
        assertThat(branche).startsWith("ia/").endsWith("-ajouter-l-ecran-des-bouees");

        // Le travail de l'« assistant », commité dans sa copie.
        Path copie = RACINE.resolve("travail").resolve(branche.replace('/', '-'));
        Files.writeString(copie.resolve("bouees.txt"), "Bouées\n");
        git(copie, "add", ".");
        git(copie, "commit", "-q", "-m", "Écran des bouées");
        String sha = git(copie, "rev-parse", "HEAD");

        JsonNode sansTests = poster("/api/ia/sessions/" + id + "/merge", admin, "{}", 422);
        assertThat(sansTests.get("detail").asText()).contains("lancez-les d'abord");
        JsonNode tagSansTests = poster("/api/ia/sessions/" + id + "/tag", admin, """
                {"tag":"v2099.01.1"}""", 422);
        assertThat(tagSansTests.get("detail").asText()).contains("n'a pas de passage de tests vert");

        poster("/api/ia/sessions/" + id + "/tests", admin, "{}", 202);
        attendre(id, admin, "TESTS_OK");

        JsonNode apresMerge = poster("/api/ia/sessions/" + id + "/merge", admin, "{}", 200);
        assertThat(apresMerge.get("dansMaster").asBoolean()).isTrue();
        assertThat(git(DEPOT, "rev-parse", "master")).isEqualTo(sha);
        assertThat(Files.exists(DEPOT.resolve("bouees.txt"))).isTrue();

        String tag = apresMerge.get("tagSuggere").asText();
        assertThat(tag).matches("v\\d{4}\\.\\d{2}\\.1");
        poster("/api/ia/sessions/" + id + "/tag", admin, """
                {"tag":"%s"}""".formatted(tag), 200);
        assertThat(git(ORIGINE, "rev-parse", "master")).isEqualTo(sha);
        assertThat(git(ORIGINE, "rev-parse", tag + "^{commit}")).isEqualTo(sha);

        JsonNode doublon = poster("/api/ia/sessions/" + id + "/tag", admin, """
                {"tag":"%s"}""".formatted(tag), 422);
        assertThat(doublon.get("detail").asText()).contains("existe déjà");

        java.util.List<String> types = new java.util.ArrayList<>();
        for (JsonNode ligne : lire("/api/ia/sessions/" + id + "/journal", admin)) types.add(ligne.get("type").asText());
        assertThat(types)
                .containsSubsequence("TESTS_LANCES", "TESTS_OK", "MERGE", "TAG_POUSSE");
    }

    @Test
    @DisplayName("Les pièces jointes sont rangées hors du dépôt et leurs chemins transmis à l'assistant")
    void piecesJointes() throws Exception {
        String admin = jeton("presidente@club.fr");
        ouvrirAcces(admin);
        JsonNode session = poster("/api/ia/sessions", admin, """
                {"titre":"Capture de l'écran des présences"}""", 201);
        long id = session.get("id").asLong();
        String branche = session.get("branche").asText();

        mvc.perform(multipart("/api/ia/sessions/" + id + "/messages").header("Authorization", admin)
                        .file(new MockMultipartFile("fichiers", "Capture d'écran.png", "image/png", new byte[]{1, 2, 3}))
                        .file(new MockMultipartFile("fichiers", "../../etc/passwd", "text/plain", "piège".getBytes()))
                        .param("texte", "Le bouton est mal placé"))
                .andExpect(status().isAccepted());
        attendre(id, admin, "FIN");

        Path pieces = RACINE.resolve("travail").resolve(branche.replace('/', '-') + "-pieces");
        java.util.List<Path> fichiers;
        try (var liste = Files.list(pieces)) {
            fichiers = liste.sorted().toList();
        }
        assertThat(fichiers).hasSize(2);
        assertThat(fichiers.get(0).getFileName().toString()).endsWith("-1-Capture_d_ecran.png");
        assertThat(fichiers.get(1).getFileName().toString()).endsWith("-2-passwd");
        assertThat(Files.readAllBytes(fichiers.get(0))).containsExactly(1, 2, 3);

        String message = Files.readString(RACINE.resolve("message.txt"));
        assertThat(message).startsWith("Le bouton est mal placé").contains(fichiers.get(0).toString());
        assertThat(Files.readString(RACINE.resolve("arguments.txt"))).contains("--add-dir " + pieces);

        String journal = null;
        for (JsonNode ligne : lire("/api/ia/sessions/" + id + "/journal", admin)) {
            if (ligne.get("type").asText().equals("MESSAGE")) journal = ligne.get("contenu").asText();
        }
        assertThat(journal).contains("Pièces jointes : Capture d'écran.png (3 o), ../../etc/passwd (6 o)")
                .doesNotContain(pieces.toString());
    }

    @Test
    @DisplayName("Claude Code et les tests ne reçoivent pas les secrets du serveur")
    void environnementFiltre() {
        java.util.Map<String, String> env = new java.util.HashMap<>(java.util.Map.of(
                "PATH", "/usr/bin", "HOME", "/root", "CLAUDE_CODE_OAUTH_TOKEN", "jeton-claude",
                "GIT_AUTHOR_NAME", "Assistant IA", "DB_PASSWORD", "secret", "JWT_SECRET", "secret",
                "SMTP_MOT_DE_PASSE", "secret", "SSH_AUTH_SOCK", "/tmp/agent", "SPRING_DATASOURCE_PASSWORD", "secret"));
        env.put("GIT_SSH_COMMAND", "ssh -i /ia/ssh/cle");
        AssistantIaService.filtrerEnvironnement(env);
        assertThat(env).containsOnlyKeys("PATH", "HOME", "CLAUDE_CODE_OAUTH_TOKEN", "GIT_AUTHOR_NAME",
                "GIT_SSH_COMMAND", "GIT_TERMINAL_PROMPT");
        assertThat(env.get("GIT_SSH_COMMAND")).isEqualTo("false");
    }

    @Test
    @DisplayName("Une nouvelle session repart du master de GitHub quand il a avancé ailleurs")
    void masterRepriseDeGitHub() throws Exception {
        String admin = jeton("presidente@club.fr");
        ouvrirAcces(admin);
        // Un commit poussé depuis un autre poste.
        Path autre = RACINE.resolve("autre-poste-" + System.nanoTime());
        git(RACINE, "clone", "-q", ORIGINE.toString(), autre.toString());
        Files.writeString(autre.resolve("depuis-ailleurs.txt"), "poussé d'ailleurs\n");
        git(autre, "add", ".");
        git(autre, "commit", "-q", "-m", "Commit d'un autre poste");
        git(autre, "push", "-q", "origin", "master");
        String distant = git(autre, "rev-parse", "HEAD");

        JsonNode session = poster("/api/ia/sessions", admin, """
                {"titre":"Après un commit d'ailleurs"}""", 201);
        assertThat(git(DEPOT, "rev-parse", "master")).isEqualTo(distant);
        Path copie = RACINE.resolve("travail").resolve(session.get("branche").asText().replace('/', '-'));
        assertThat(Files.exists(copie.resolve("depuis-ailleurs.txt"))).isTrue();
    }

    private void attendre(long sessionId, String jeton, String type) throws Exception {
        for (int i = 0; i < 100; i++) {
            for (JsonNode ligne : lire("/api/ia/sessions/" + sessionId + "/journal", jeton)) {
                if (ligne.get("type").asText().equals(type)) return;
                if (ligne.get("type").asText().equals("TESTS_KO")) {
                    throw new AssertionError("Tests KO : " + ligne.get("contenu").asText());
                }
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Pas de " + type + " au journal");
    }
}
