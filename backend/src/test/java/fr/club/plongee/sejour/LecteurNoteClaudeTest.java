package fr.club.plongee.sejour;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** Ce que l'appli retient de la réponse du service de lecture : sans réseau, sur des réponses écrites à la main. */
class LecteurNoteClaudeTest {

    private final ObjectMapper json = new ObjectMapper();

    private LecteurNote.NoteLue interpreter(String entree) {
        return LecteurNoteClaude.interpreter(json.readTree("""
                {"content":[{"type":"text","text":"Voici."},
                            {"type":"tool_use","name":"noter_la_note","input":%s}]}""".formatted(entree)));
    }

    @Test
    @DisplayName("Le total en euros devient des centimes, la date un jour")
    void totalEtDate() {
        assertThat(interpreter("{\"montant_total\":45.8,\"date_achat\":\"2027-06-12\"}"))
                .isEqualTo(new LecteurNote.NoteLue(4580L, LocalDate.of(2027, 6, 12)));
        assertThat(interpreter("{\"montant_total\":12.345,\"date_achat\":null}").montantCentimes()).isEqualTo(1235L);
    }

    @Test
    @DisplayName("Ce qui n'a pas pu être lu, ou n'a pas de sens, reste vide")
    void illisibleResteVide() {
        assertThat(interpreter("{\"montant_total\":null,\"date_achat\":\"12/06/2027\"}"))
                .isEqualTo(new LecteurNote.NoteLue(null, null));
        assertThat(interpreter("{\"montant_total\":-3,\"date_achat\":\"2027-02-30\"}"))
                .isEqualTo(new LecteurNote.NoteLue(null, null));
        assertThat(interpreter("{\"montant_total\":250000}").montantCentimes()).isNull();
        assertThat(LecteurNoteClaude.interpreter(json.readTree("{\"content\":[]}")))
                .isEqualTo(new LecteurNote.NoteLue(null, null));
    }
}
