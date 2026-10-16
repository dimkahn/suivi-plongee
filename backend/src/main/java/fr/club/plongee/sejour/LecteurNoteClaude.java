package fr.club.plongee.sejour;

import fr.club.plongee.commun.RegleMetierException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.RoundingMode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Lecture des notes par Claude (Anthropic), qui lit l'image et répond par
 * un outil imposé : le total payé et la date, ou null pour ce qu'il ne lit
 * pas. La photo n'est envoyée qu'à la demande de celui qui saisit la
 * dépense, et n'est pas gardée par le service au-delà de la réponse.
 * <p>
 * Clé d'accès par installation ({@code LECTURE_NOTES_CLE_API}) : vide, la
 * lecture n'est pas proposée.
 */
@Component
public class LecteurNoteClaude implements LecteurNote {

    private static final String URL = "https://api.anthropic.com/v1/messages";
    private static final String OUTIL = "noter_la_note";

    private static final String CONSIGNE = """
            Cette photo est une note de frais (ticket de caisse, facture, reçu) prise pendant un séjour.
            Donne le montant total réellement payé, TTC, en euros (la ligne « Total », « Net à payer »,
            « Montant payé »… ; pas un sous-total, pas la TVA, pas le rendu de monnaie), et la date de l'achat.
            Si la note n'est pas lisible ou si une valeur n'y figure pas, réponds null pour cette valeur :
            n'invente rien.""";

    private static final Map<String, Object> SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "montant_total", Map.of("type", List.of("number", "null"),
                            "description", "Total payé TTC en euros, point décimal (45.80)"),
                    "date_achat", Map.of("type", List.of("string", "null"),
                            "description", "Date de l'achat au format AAAA-MM-JJ")),
            "required", List.of("montant_total", "date_achat"));

    private final ObjectMapper json;
    private final RestClient http;
    private final String cle;
    private final String modele;

    public LecteurNoteClaude(ObjectMapper json,
                             @Value("${app.lecture-notes.cle-api:}") String cle,
                             @Value("${app.lecture-notes.modele:claude-sonnet-5}") String modele) {
        this.json = json;
        this.cle = cle == null ? "" : cle.trim();
        this.modele = modele;
        JdkClientHttpRequestFactory requetes = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        requetes.setReadTimeout(Duration.ofSeconds(40));
        this.http = RestClient.builder().requestFactory(requetes).build();
    }

    @Override
    public boolean actif() {
        return !cle.isEmpty();
    }

    @Override
    public NoteLue lire(byte[] image, String type) {
        Map<String, Object> demande = Map.of(
                "model", modele,
                "max_tokens", 300,
                "tools", List.of(Map.of("name", OUTIL,
                        "description", "Noter le total et la date lus sur la note.",
                        "input_schema", SCHEMA)),
                "tool_choice", Map.of("type", "tool", "name", OUTIL),
                "messages", List.of(Map.of("role", "user", "content", List.of(
                        Map.of("type", "image", "source", Map.of("type", "base64", "media_type", type,
                                "data", Base64.getEncoder().encodeToString(image))),
                        Map.of("type", "text", "text", CONSIGNE)))));
        String reponse;
        try {
            reponse = http.post().uri(URL)
                    .header("x-api-key", cle)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json.writeValueAsString(demande))
                    .retrieve().body(String.class);
        } catch (RestClientException e) {
            throw new RegleMetierException("La note n'a pas pu être lue pour le moment : "
                    + "saisissez le montant et la date.");
        }
        return interpreter(json.readTree(reponse));
    }

    /** Le total en centimes et la date, ou null pour ce qui manque ou n'a pas de sens. */
    static NoteLue interpreter(JsonNode reponse) {
        for (JsonNode bloc : reponse.path("content")) {
            if (!"tool_use".equals(bloc.path("type").asText())) continue;
            JsonNode entree = bloc.path("input");
            return new NoteLue(centimes(entree.path("montant_total")), jour(entree.path("date_achat")));
        }
        return new NoteLue(null, null);
    }

    private static Long centimes(JsonNode montant) {
        if (!montant.isNumber()) return null;
        long centimes = montant.decimalValue().movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
        return centimes > 0 && centimes <= FraisService.MONTANT_MAX_CENTIMES ? centimes : null;
    }

    private static LocalDate jour(JsonNode date) {
        if (!date.isString()) return null;
        try {
            return LocalDate.parse(date.asText());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
