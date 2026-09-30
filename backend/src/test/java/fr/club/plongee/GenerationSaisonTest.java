package fr.club.plongee;

import fr.club.plongee.formation.calendrier.CalendrierScolaire;
import fr.club.plongee.formation.calendrier.PeriodeVacances;
import fr.club.plongee.formation.domain.Saison;
import fr.club.plongee.formation.repository.SaisonRepository;
import fr.club.plongee.formation.repository.SeanceRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Génération d'une saison : une séance chaque jour de la semaine choisi. Les vacances
 * viennent d'une fausse source (pas de réseau en test), recopiée du
 * calendrier officiel de la zone C pour 2026-2027 : la génération doit
 * alors retrouver exactement le calendrier saisi à la main dans V11.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@Import(GenerationSaisonTest.VacancesZoneC.class)
class GenerationSaisonTest {

    @TestConfiguration
    static class VacancesZoneC {
        @Bean @Primary
        CalendrierScolaire calendrierScolaireDeTest() {
            return (zone, debut, fin) -> List.of(
                    new PeriodeVacances("Vacances de la Toussaint", LocalDate.of(2026, 10, 17), LocalDate.of(2026, 11, 1)),
                    new PeriodeVacances("Vacances de Noël", LocalDate.of(2026, 12, 19), LocalDate.of(2027, 1, 3)),
                    new PeriodeVacances("Vacances d'Hiver", LocalDate.of(2027, 2, 6), LocalDate.of(2027, 2, 21)),
                    new PeriodeVacances("Vacances de Printemps", LocalDate.of(2027, 4, 3), LocalDate.of(2027, 4, 18)),
                    new PeriodeVacances("Pont de l'Ascension", LocalDate.of(2027, 5, 7), LocalDate.of(2027, 5, 7)));
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SaisonRepository saisons;
    @Autowired SeanceRepository seances;

    private String jeton(String email) throws Exception {
        String reponse = mvc.perform(post("/api/auth/connexion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"email":"%s","motDePasse":"plongee2026"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(reponse).get("jetonAcces").asText();
    }

    private Set<String> apercu(String admin, String jours, String lieu, int profondeur) throws Exception {
        String reponse = mvc.perform(post("/api/seances/generation/apercu").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2026-09-01","dateFin":"2027-06-30","zoneVacances":"C","exclureFeries":true,
                                  "jours":%s,"milieu":"ARTIFICIEL","lieu":"%s","profondeurMax":%d}"""
                                .formatted(jours, lieu, profondeur)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saison").value("2026-2027"))
                .andReturn().getResponse().getContentAsString();
        JsonNode apercu = json.readTree(reponse);
        List<String> motifs = apercu.get("exclusions").valueStream().map(e -> e.get("motif").asText()).toList();
        assertThat(motifs).contains("Vacances de la Toussaint (zone C)", "Jour férié : Lundi de Pâques");
        Set<String> dates = new TreeSet<>();
        for (JsonNode s : apercu.get("seances")) dates.add(s.get("date").asText() + " " + s.get("lieu").asText());
        return dates;
    }

    @Test
    @DisplayName("Fosse lundi + mercredi, piscine lundi, zone C, sans fériés : le calendrier réel 2026-2027 (V11)")
    void retrouveLeCalendrierSaisiALaMain() throws Exception {
        String admin = jeton("presidente@club.fr");
        Set<String> generees = new TreeSet<>(apercu(admin, "[\"MONDAY\",\"WEDNESDAY\"]", "Fosse", 10));
        generees.addAll(apercu(admin, "[\"MONDAY\"]", "Piscine", 2));

        Saison saison = saisons.findAll().stream().filter(s -> s.getLibelle().equals("2026-2027")).findFirst().orElseThrow();
        Set<String> saisiesALaMain = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison.getId()).stream()
                .filter(s -> s.getLieu().equals("Piscine") || s.getLieu().equals("Fosse"))
                .map(s -> s.getDateSeance() + " " + s.getLieu())
                .collect(Collectors.toCollection(TreeSet::new));
        assertThat(generees).isEqualTo(saisiesALaMain);
    }

    @Test
    @DisplayName("Création : une séance par jour choisi ; une seconde génération prend le n° de plongée suivant")
    void creeLesSeances() throws Exception {
        String admin = jeton("presidente@club.fr");
        // Samedis de juin 2027 : aucune séance V11 ce jour-là.
        for (String groupe : List.of("Groupe N2", "Groupe N3")) {
            mvc.perform(post("/api/seances/generation").header("Authorization", admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                     {"dateDebut":"2027-06-01","dateFin":"2027-06-30","zoneVacances":"",
                                      "jours":["SATURDAY"],"milieu":"NATUREL","lieu":"Lac de l'Ailette","site":"Ponton",
                                      "info":"%s"}""".formatted(groupe)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.nbSeances").value(4));
        }

        Saison saison = saisons.findAll().stream().filter(s -> s.getLibelle().equals("2026-2027")).findFirst().orElseThrow();
        var samedi = seances.findBySaisonIdOrderByDateSeanceAscOrdreAsc(saison.getId()).stream()
                .filter(s -> s.getDateSeance().equals(LocalDate.of(2027, 6, 12))).toList();
        assertThat(samedi).extracting("ordre", "commentaire").containsExactly(
                org.assertj.core.groups.Tuple.tuple(1, "Groupe N2"), org.assertj.core.groups.Tuple.tuple(2, "Groupe N3"));
        assertThat(samedi.get(0).getSite()).isEqualTo("Ponton");
    }

    @Test
    @DisplayName("Refus : dates à cheval sur deux saisons, zone inconnue, réservé à l'ADMIN")
    void refus() throws Exception {
        String admin = jeton("presidente@club.fr");
        String seance = "\"jours\":[\"MONDAY\"],\"milieu\":\"ARTIFICIEL\",\"lieu\":\"Piscine\"";
        mvc.perform(post("/api/seances/generation/apercu").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2026-06-01","dateFin":"2026-10-01",%s}""".formatted(seance)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("une seule saison")));
        mvc.perform(post("/api/seances/generation/apercu").header("Authorization", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2026-09-01","dateFin":"2026-10-01","zoneVacances":"Z",%s}"""
                                .formatted(seance)))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/seances/generation/apercu").header("Authorization", jeton("e3@club.fr"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                 {"dateDebut":"2026-09-01","dateFin":"2026-10-01",%s}""".formatted(seance)))
                .andExpect(status().isForbidden());
    }
}
