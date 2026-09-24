package fr.club.plongee.formation.calendrier;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.commun.RegleMetierException;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Vacances scolaires lues dans le jeu de données officiel « Calendrier
 * scolaire » de l'Éducation nationale (data.education.gouv.fr). Pas de copie
 * locale : les dates restent celles publiées par le ministère, y compris
 * quand il les modifie.
 *
 * Les dates y sont des instants UTC : le début est minuit (heure de Paris) du
 * premier jour sans cours, la fin minuit du jour de reprise. Le dernier jour
 * de vacances est donc la veille de la fin — sauf pour un pont, publié avec
 * le même début et la même fin, qui ne compte que ce jour-là.
 */
@Component
public class CalendrierScolaireOfficiel implements CalendrierScolaire {

    private static final String URL =
            "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

    private final ObjectMapper json;
    private final RestClient http;

    public CalendrierScolaireOfficiel(ObjectMapper json) {
        this.json = json;
        JdkClientHttpRequestFactory requetes = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        requetes.setReadTimeout(Duration.ofSeconds(15));
        this.http = RestClient.builder().requestFactory(requetes).build();
    }

    @Override
    public List<PeriodeVacances> vacances(String zone, LocalDate debut, LocalDate fin) {
        // Une ligne par académie : on dédoublonne, les dates sont les mêmes dans toute la zone.
        URI uri = UriComponentsBuilder.fromUriString(URL)
                .queryParam("select", "description,start_date,end_date,population")
                .queryParam("where", "zones=\"Zone %s\" and end_date>=date'%s' and start_date<=date'%s'"
                        .formatted(zone, debut, fin.plusDays(1)))
                .queryParam("limit", 100)
                .encode().build().toUri();
        String reponse;
        try {
            reponse = http.get().uri(uri).retrieve().body(String.class);
        } catch (RestClientException e) {
            throw new RegleMetierException("Le calendrier scolaire officiel est injoignable pour le moment. "
                    + "Réessayez plus tard, ou générez la saison sans exclure les vacances.");
        }

        Set<PeriodeVacances> periodes = new LinkedHashSet<>();
        for (JsonNode ligne : json.readTree(reponse).path("results")) {
            // Certaines lignes ne concernent que les enseignants (pré-rentrée) : ignorées.
            String population = ligne.path("population").asText("-");
            if (!population.equals("-") && !population.equalsIgnoreCase("Élèves")) continue;
            if (ligne.path("start_date").isNull() || ligne.path("end_date").isNull()) continue;
            LocalDate premier = jourAParis(ligne.path("start_date").asText());
            LocalDate reprise = jourAParis(ligne.path("end_date").asText());
            // Un pont (Ascension) a le même début et la même fin : un seul jour sans cours.
            LocalDate dernier = reprise.isAfter(premier) ? reprise.minusDays(1) : premier;
            periodes.add(new PeriodeVacances(ligne.path("description").asText().trim(), premier, dernier));
        }
        List<PeriodeVacances> triees = new ArrayList<>(periodes);
        triees.sort((a, b) -> a.premierJour().compareTo(b.premierJour()));
        return triees;
    }

    private static LocalDate jourAParis(String instant) {
        return OffsetDateTime.parse(instant).atZoneSameInstant(Calendrier.ZONE_CLUB).toLocalDate();
    }
}
