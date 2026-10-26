package fr.club.plongee.notification.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le chiffrement d'une notification pour le téléphone (RFC 8291) : vérifié
 * sur l'exemple de l'annexe A de la norme, sans réseau ni Spring.
 */
class ChiffrementPushTest {

    private static byte[] b64(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    @Test
    @DisplayName("Le message chiffré est celui de l'exemple de la RFC 8291")
    void exempleDeLaNorme() {
        KeyPair serveur = ClesVapid.paire(b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"),
                b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
        byte[] chiffre = ChiffrementPush.chiffrer(
                "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8),
                b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
                b64("BTBZMqHH6r4Tts7J_aSIgg"), serveur, b64("DGv6ra1nlYgDCS1FRnbzlw"));

        assertThat(Base64.getUrlEncoder().withoutPadding().encodeToString(chiffre)).isEqualTo(
                "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8w"
                        + "EqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
    }

    @Test
    @DisplayName("Une paire de clés tirée au hasard se relit à l'identique depuis ses deux textes")
    void clesRelues() {
        ClesVapid cles = ClesVapid.generer();
        ClesVapid relues = new ClesVapid(cles.publique(), cles.privee());
        assertThat(b64(relues.publique())).hasSize(65);
        assertThat(relues.paire().getPublic().getEncoded()).isEqualTo(cles.paire().getPublic().getEncoded());
    }

    @Test
    @DisplayName("Le jeton VAPID est signé pour l'origine du service de notification")
    void jetonVapid() {
        ClesVapid cles = ClesVapid.generer();
        String jeton = cles.jeton("https://fcm.googleapis.com/fcm/send/abc", "https://club.exemple.fr", 1_800_000_000L);
        String[] parties = jeton.split("\\.");
        assertThat(parties).hasSize(3);
        assertThat(new String(b64(parties[1]), StandardCharsets.UTF_8))
                .contains("\"aud\":\"https://fcm.googleapis.com\"").contains("\"exp\":1800000000")
                .contains("\"sub\":\"https://club.exemple.fr\"");
        assertThat(b64(parties[2])).hasSize(64);
        assertThat(cles.verifier(parties[0] + "." + parties[1], b64(parties[2]))).isTrue();
    }
}
