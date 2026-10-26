package fr.club.plongee.notification.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

/**
 * Le chiffrement d'une notification pour un téléphone (RFC 8291, codage
 * « aes128gcm » de la RFC 8188), avec les seuls outils du JDK : seul le
 * téléphone abonné peut lire le message ; le service de notification qui
 * le transporte, non. Calcul pur, vérifié sur l'exemple de la norme.
 */
public final class ChiffrementPush {

    /** Taille d'enregistrement annoncée (un seul enregistrement : le message est court). */
    private static final int TAILLE_ENREGISTREMENT = 4096;

    private ChiffrementPush() {}

    /**
     * {@code clePubliqueTelephone} (p256dh, 65 octets) et {@code secretTelephone}
     * (auth, 16 octets) viennent de l'abonnement ; {@code serveur} est une
     * paire éphémère, {@code sel} 16 octets au hasard (fixés pour le test).
     */
    public static byte[] chiffrer(byte[] message, byte[] clePubliqueTelephone, byte[] secretTelephone,
                                  KeyPair serveur, byte[] sel) {
        try {
            KeyAgreement accord = KeyAgreement.getInstance("ECDH");
            accord.init(serveur.getPrivate());
            accord.doPhase(ClesVapid.publique(clePubliqueTelephone), true);
            byte[] secretEcdh = accord.generateSecret();
            byte[] publiqueServeur = ClesVapid.brute((ECPublicKey) serveur.getPublic());

            byte[] prkCle = hmac(secretTelephone, secretEcdh);
            byte[] infoCle = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0},
                    clePubliqueTelephone, publiqueServeur);
            byte[] ikm = developper(prkCle, infoCle, 32);
            byte[] prk = hmac(sel, ikm);
            byte[] cek = developper(prk, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
            byte[] nonce = developper(prk, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

            Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
            aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            // 0x02 : délimiteur du dernier (et seul) enregistrement, sans bourrage.
            byte[] chiffre = aes.doFinal(concat(message, new byte[] {2}));

            ByteBuffer entete = ByteBuffer.allocate(16 + 4 + 1 + publiqueServeur.length);
            entete.put(sel).putInt(TAILLE_ENREGISTREMENT).put((byte) publiqueServeur.length).put(publiqueServeur);
            return concat(entete.array(), chiffre);
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Abonnement illisible : notification impossible à chiffrer", e);
        }
    }

    /** HKDF-Expand d'un seul bloc (la longueur voulue tient dans 32 octets). */
    private static byte[] developper(byte[] prk, byte[] info, int longueur) throws GeneralSecurityException {
        return Arrays.copyOf(hmac(prk, concat(info, new byte[] {1})), longueur);
    }

    private static byte[] hmac(byte[] cle, byte[] donnees) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(cle, "HmacSHA256"));
        return mac.doFinal(donnees);
    }

    private static byte[] concat(byte[]... morceaux) {
        ByteArrayOutputStream r = new ByteArrayOutputStream();
        for (byte[] m : morceaux) r.writeBytes(m);
        return r.toByteArray();
    }
}
