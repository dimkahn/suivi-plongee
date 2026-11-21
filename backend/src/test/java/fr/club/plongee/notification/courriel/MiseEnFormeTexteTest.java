package fr.club.plongee.notification.courriel;

import fr.club.plongee.notification.courriel.Courriel.Bloc;
import fr.club.plongee.notification.courriel.Courriel.Bouton;
import fr.club.plongee.notification.courriel.Courriel.Liste;
import fr.club.plongee.notification.courriel.Courriel.Paragraphe;
import fr.club.plongee.notification.courriel.Courriel.Section;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Un e-mail écrit en texte, découpé en blocs pour sa version HTML. */
class MiseEnFormeTexteTest {

    private static final String DECOMPTE = """
            Bonjour Léa,

            Les frais du séjour « Port-Cros » (du 04/06/2027 au 07/06/2027) sont clos. Voici votre décompte.

            VOS DÉPENSES
              - Gîte, le 04/06/2027 (payé par Gwendoline Marchand) : 720,00 € au total ; votre part : 120,00 €
              - Glaces (payé par vous) : 18,00 € au total ; votre part : 3,00 €

            AFFAIRES À PRÉVOIR (* indispensable)
              Matériel
                - Masque *
                - Palmes

            Le détail de toutes les dépenses est dans l'onglet « Frais » du séjour :
            https://club.exemple/sejour/abc123
            Une fois votre virement fait, envoyez-y sa preuve.

            Merci,
            Club de plongée d'essai
            """;

    private final Courriel courriel = MiseEnFormeTexte.courriel("Décompte des frais", "Port-Cros", DECOMPTE,
            "Club de plongée d'essai");

    @Test
    @DisplayName("« Bonjour Léa, » devient la salutation, la formule de fin la signature, sans répéter le nom du club")
    void debutEtFin() {
        assertThat(courriel.getPrenom()).isEqualTo("Léa");
        assertThat(courriel.getSignature()).isEqualTo("Merci");
        assertThat(courriel.getBlocs()).noneMatch(b -> b.toString().contains("Club de plongée d'essai"));
        assertThat(courriel.getBlocs()).noneMatch(b -> b.toString().contains("Bonjour"));
    }

    @Test
    @DisplayName("Les titres en majuscules deviennent des intertitres, leurs lignes en retrait une liste avec ses détails")
    void sectionsEtListes() {
        List<Bloc> blocs = courriel.getBlocs();
        assertThat(blocs).contains(new Section("Vos dépenses"), new Section("Affaires à prévoir (* indispensable)"));
        Liste depenses = (Liste) blocs.get(blocs.indexOf(new Section("Vos dépenses")) + 1);
        assertThat(depenses.elements()).extracting(Liste.Element::texte).containsExactly(
                "Gîte, le 04/06/2027 (payé par Gwendoline Marchand) : 720,00 € au total ; votre part : 120,00 €",
                "Glaces (payé par vous) : 18,00 € au total ; votre part : 3,00 €");
        Liste affaires = (Liste) blocs.get(blocs.indexOf(new Section("Affaires à prévoir (* indispensable)")) + 1);
        assertThat(affaires.elements()).containsExactly(new Liste.Element("Matériel", List.of("Masque *", "Palmes")));
    }

    @Test
    @DisplayName("Une adresse seule sur sa ligne devient un bouton ; le texte autour reste en paragraphes")
    void adresseEnBouton() {
        List<Bloc> blocs = courriel.getBlocs();
        assertThat(blocs).contains(
                new Paragraphe("Le détail de toutes les dépenses est dans l'onglet « Frais » du séjour :", false),
                new Bouton("Ouvrir le séjour", "https://club.exemple/sejour/abc123"),
                new Paragraphe("Une fois votre virement fait, envoyez-y sa preuve.", false));
        assertThat(blocs.indexOf(new Bouton("Ouvrir le séjour", "https://club.exemple/sejour/abc123")))
                .isEqualTo(blocs.indexOf(new Paragraphe("Le détail de toutes les dépenses est dans l'onglet « Frais » du séjour :", false)) + 1);
    }

    @Test
    @DisplayName("Des lignes « - … » sans retrait, sous une ligne qui finit par « : », font une liste sous un titre en gras")
    void listeSansRetrait() {
        Courriel recap = MiseEnFormeTexte.courriel("CACI à suivre", null, """
                Bonjour Claire,

                Voici les CACI à suivre au 20/11/2026.

                CACI qui expirent bientôt :
                - Dulac Anis, élève, valable jusqu'au 03/12/2026
                - Morel Léa, moniteur, valable jusqu'au 05/12/2026

                Message envoyé automatiquement par le suivi des formations du club.""", "Club de plongée d'essai");

        assertThat(recap.getBlocs()).containsSubsequence(
                new Paragraphe("CACI qui expirent bientôt :", true),
                new Liste(List.of(new Liste.Element("Dulac Anis, élève, valable jusqu'au 03/12/2026", List.of()),
                        new Liste.Element("Morel Léa, moniteur, valable jusqu'au 05/12/2026", List.of()))));
    }

    @Test
    @DisplayName("La version texte envoyée reste celle écrite, mot pour mot")
    void texteInchange() {
        CourrielRendu rendu = new GabaritCourriel(new IdentiteDonnee()).rendreTexte("Décompte des frais", "Port-Cros", DECOMPTE);
        assertThat(rendu.texte()).isEqualTo(DECOMPTE);
        assertThat(rendu.html()).contains("Vos dépenses", "Glaces", "href=\"https://club.exemple/sejour/abc123\"");
    }
}
