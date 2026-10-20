package fr.club.plongee.formation;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.Seance;
import fr.club.plongee.formation.service.EmpreinteFicheSecurite;
import fr.club.plongee.securite.domain.Utilisateur;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** L'empreinte scellée d'une fiche signée, sans Spring. */
class EmpreinteFicheSecuriteTest {

    private static FicheSecurite fiche(String meteo, String etatMer) {
        Seance seance = new Seance();
        seance.setId(7L);
        seance.setDateSeance(LocalDate.of(2026, 6, 8));
        Utilisateur dp = new Utilisateur();
        dp.setId(3L);
        FicheSecurite f = new FicheSecurite();
        f.setSeance(seance);
        f.setDp(dp);
        f.setMeteo(meteo);
        f.setEtatMer(etatMer);
        f.setSignataire(dp);
        f.setSigneeLe(Instant.parse("2026-06-08T18:00:00Z"));
        return f;
    }

    @Test
    @DisplayName("Sans la clé du serveur, on ne retrouve pas l'empreinte")
    void cleDuServeur() {
        FicheSecurite f = fiche("Beau", "Calme");
        assertThat(new EmpreinteFicheSecurite("cle-du-club", "x").calculer(f))
                .hasSize(64)
                .isNotEqualTo(new EmpreinteFicheSecurite("autre-cle", "x").calculer(f));
    }

    @Test
    @DisplayName("Sans clé propre, celle des jetons de connexion scelle l'empreinte")
    void cleDesJetonsParDefaut() {
        FicheSecurite f = fiche("Beau", "Calme");
        assertThat(new EmpreinteFicheSecurite("", "cle-des-jetons").calculer(f))
                .isEqualTo(new EmpreinteFicheSecurite("cle-des-jetons", "x").calculer(f));
    }

    @Test
    @DisplayName("Un texte qui déborde sur le champ suivant ne donne pas la même empreinte")
    void champsSepares() {
        EmpreinteFicheSecurite empreinte = new EmpreinteFicheSecurite("cle-du-club", "x");
        assertThat(empreinte.calculer(fiche("Beau\netatMer=Calme", null)))
                .isNotEqualTo(empreinte.calculer(fiche("Beau", "Calme")));
    }

    @Test
    @DisplayName("Une fiche intègre le reste tant que rien ne change")
    void integre() {
        EmpreinteFicheSecurite empreinte = new EmpreinteFicheSecurite("cle-du-club", "x");
        FicheSecurite f = fiche("Beau", "Calme");
        f.setEmpreinte(empreinte.calculer(f));
        assertThat(empreinte.estIntegre(f)).isTrue();
        f.setMeteo("Pluie");
        assertThat(empreinte.estIntegre(f)).isFalse();
    }
}
