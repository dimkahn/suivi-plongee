package fr.club.plongee;

import fr.club.plongee.sejour.NettoyageHtml;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Le mail du loueur d'une voiture : ce qu'on en garde, ce qu'on en dit, et sa version texte. */
class NettoyageHtmlTest {

    @Test
    @DisplayName("Tableaux, listes et liens sûrs sont gardés ; rien n'est signalé quand rien n'est retiré")
    void htmlPropre() {
        var r = NettoyageHtml.nettoyer("""
                <p>Bonjour,</p><table><tr><td>Retrait</td><td>12 juin, 10 h</td></tr></table>
                <ul><li>Permis</li></ul><a href="tel:+33600000000">Appeler</a> <a href="#haut">haut</a>""");
        assertThat(r.retraits()).isEmpty();
        assertThat(r.html()).contains("<table>").contains("<li>Permis</li>").contains("href=\"tel:+33600000000\"")
                .contains("rel=\"noopener noreferrer nofollow\"");
    }

    @Test
    @DisplayName("Un mail sans texte (une image seule) ne laisse rien")
    void sansTexte() {
        var r = NettoyageHtml.nettoyer("<img src=\"https://x.fr/a.png\">");
        assertThat(r.html()).isNull();
        assertThat(r.retraits()).containsExactly("1 image");
        assertThat(NettoyageHtml.nettoyer("  ").html()).isNull();
    }

    @Test
    @DisplayName("En texte brut : une ligne par paragraphe ou ligne de tableau, l'adresse des liens entre parenthèses")
    void enTexte() {
        String texte = NettoyageHtml.enTexte("""
                <p>Réservation <b>H123</b></p><table><tr><td>Retrait</td><td>Terminal 1</td></tr></table>
                <a href="https://loueur.fr/r">Gérer</a><br>Fin""");
        assertThat(texte).isEqualTo("Réservation H123\nRetrait Terminal 1\nGérer (https://loueur.fr/r)\nFin");
    }
}
