package fr.club.plongee.notification.courriel;

import fr.club.plongee.identite.IdentiteStructureService;
import fr.club.plongee.identite.IdentiteStructureService.IdentiteVue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Le gabarit des e-mails : HTML aux couleurs de la structure, texte équivalent, rien de chargé de l'extérieur. */
class GabaritCourrielTest {

    /** L'identité de la structure, sans base : couleurs données, logo de quelques octets. */
    static class IdentiteDonnee extends IdentiteStructureService {
        private final String principale, foncee, accent;

        IdentiteDonnee(String principale, String foncee, String accent) {
            super(null, "Club de plongée d'essai");
            this.principale = principale;
            this.foncee = foncee;
            this.accent = accent;
        }

        @Override
        public IdentiteVue lire() {
            return new IdentiteVue(null, null, null, principale, foncee, accent, false, 0);
        }

        @Override
        public String nom() {
            return "Club de plongée d'essai";
        }

        @Override
        public byte[] logoPng() {
            return new byte[] {1, 2, 3};
        }
    }

    private final GabaritCourriel gabarit = new GabaritCourriel(new IdentiteDonnee(null, null, null));

    @Test
    @DisplayName("Un texte saisi est échappé dans le HTML : un nom ne peut pas injecter de balise")
    void echappe() {
        CourrielRendu rendu = gabarit.rendre(Courriel.titre("Carnet du séjour")
                .bonjour("<script>alert(1)</script>").paragraphe("Lieu : Port-Cros & Porquerolles"));

        assertThat(rendu.html()).doesNotContain("<script>").contains("&lt;script&gt;")
                .contains("Port-Cros &amp; Porquerolles");
        assertThat(rendu.texte()).contains("Bonjour <script>alert(1)</script>,", "Lieu : Port-Cros & Porquerolles");
    }

    @Test
    @DisplayName("Le bouton porte le lien ; la version texte donne le même lien en clair")
    void bouton() {
        String lien = "https://club.exemple/reinitialiser-mot-de-passe?jeton=abc";
        CourrielRendu rendu = gabarit.rendre(Courriel.titre("Votre mot de passe").bonjour("Léa")
                .bouton("Choisir mon mot de passe", lien));

        assertThat(rendu.html()).contains("href=\"" + lien + "\"", "Choisir mon mot de passe");
        assertThat(rendu.texte()).contains("Choisir mon mot de passe : " + lien);
    }

    @Test
    @DisplayName("Aucune image chargée depuis un serveur : le logo est joint au message")
    void logoJoint() {
        CourrielRendu rendu = gabarit.rendre(Courriel.titre("Votre code"));

        assertThat(rendu.html()).contains("src=\"cid:" + GabaritCourriel.CID_LOGO + "\"")
                .doesNotContain("src=\"http");
        assertThat(rendu.logo()).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("Aux couleurs de la structure, celles d'origine si rien n'est réglé")
    void couleurs() {
        CourrielRendu origine = gabarit.rendre(Courriel.titre("Votre code").bouton("Ouvrir", "https://x"));
        CourrielRendu reglee = new GabaritCourriel(new IdentiteDonnee("#1E6091", "#123456", "#E76F51"))
                .rendre(Courriel.titre("Votre code").bouton("Ouvrir", "https://x"));

        assertThat(origine.html()).contains("#0C3547");
        assertThat(reglee.html()).contains("#123456").doesNotContain("#0C3547");
        assertThat(reglee.html()).contains("Club de plongée d&#39;essai");
    }

    @Test
    @DisplayName("Un bouton sur une couleur claire garde un texte lisible (foncé, pas blanc)")
    void boutonClair() {
        CourrielRendu rendu = new GabaritCourriel(new IdentiteDonnee(null, "#FDE68A", null))
                .rendre(Courriel.titre("Votre code").bouton("Ouvrir", "https://x"));

        assertThat(rendu.html()).containsPattern("background(-color)?:#FDE68A;[^\"]*color:#0F172A");
    }

    @Test
    @DisplayName("Encadré, code, tableau et note se retrouvent dans les deux versions")
    void blocs() {
        CourrielRendu rendu = gabarit.rendre(Courriel.titre("Décompte des frais")
                .encadre("Votre solde", List.of(Map.entry("Vous devez", "244,00 €")))
                .code("482913")
                .tableau(List.of("Dépense", "Montant"), List.of(List.of("Gîte", "720,00 €")))
                .note("Gardé deux ans.")
                .signature("Bonnes bulles"));

        assertThat(rendu.html()).contains("Votre solde", "244,00 €", "482913", "<table", "Gîte", "720,00 €",
                "Gardé deux ans.", "Bonnes bulles");
        assertThat(rendu.texte()).contains("Vous devez : 244,00 €", "482913", "Gîte", "720,00 €",
                "Gardé deux ans.", "Bonnes bulles", "Club de plongée d'essai");
    }
}
