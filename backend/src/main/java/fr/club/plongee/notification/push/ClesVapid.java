package fr.club.plongee.notification.push;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Arrays;
import java.util.Base64;
import java.net.URI;

/**
 * La paire de clés VAPID du serveur (RFC 8292), courbe P-256 : la clé
 * publique est donnée au téléphone qui s'abonne, la clé privée signe chaque
 * envoi pour que le service de notification (Google, Apple, Mozilla) sache
 * qu'il vient de nous. Textes en base64url : la publique en point non
 * compressé (65 octets), la privée en scalaire (32 octets).
 */
public record ClesVapid(String publique, String privee) {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder D64 = Base64.getUrlDecoder();
    /** Un jeton VAPID vaut au plus 24 h ; douze suffisent pour un envoi. */
    static final long SECONDES_VALIDITE_JETON = 12 * 3600;

    public static ClesVapid generer() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair p = g.generateKeyPair();
            return new ClesVapid(B64.encodeToString(brute((ECPublicKey) p.getPublic())),
                    B64.encodeToString(sur32(((ECPrivateKey) p.getPrivate()).getS().toByteArray())));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public KeyPair paire() {
        return paire(D64.decode(publique), D64.decode(privee));
    }

    /** Le jeton signé pour l'origine de {@code endpoint}, au nom de {@code contact} (adresse du site). */
    public String jeton(String endpoint, String contact, long expireEpoch) {
        URI u = URI.create(endpoint);
        String origine = u.getScheme() + "://" + u.getHost() + (u.getPort() == -1 ? "" : ":" + u.getPort());
        String entete = B64.encodeToString("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String corps = B64.encodeToString(("{\"aud\":\"" + origine + "\",\"exp\":" + expireEpoch + ",\"sub\":\""
                + contact + "\"}").getBytes(StandardCharsets.UTF_8));
        String signe = entete + "." + corps;
        try {
            Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
            s.initSign(paire().getPrivate());
            s.update(signe.getBytes(StandardCharsets.US_ASCII));
            return signe + "." + B64.encodeToString(s.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    boolean verifier(String signe, byte[] signature) {
        try {
            Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
            s.initVerify(paire().getPublic());
            s.update(signe.getBytes(StandardCharsets.US_ASCII));
            return s.verify(signature);
        } catch (GeneralSecurityException e) {
            return false;
        }
    }

    // ------------------------------------------------------------------
    //  Conversions entre octets bruts et clés Java
    // ------------------------------------------------------------------

    static ECParameterSpec p256() {
        try {
            AlgorithmParameters a = AlgorithmParameters.getInstance("EC");
            a.init(new ECGenParameterSpec("secp256r1"));
            return a.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Une clé publique de 65 octets (0x04, x, y), celle d'un téléphone ou la nôtre. */
    static ECPublicKey publique(byte[] brute) {
        if (brute.length != 65 || brute[0] != 4) throw new IllegalArgumentException("Clé publique P-256 attendue");
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(brute, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(brute, 33, 65));
        ECParameterSpec courbe = p256();
        BigInteger p = ((ECFieldFp) courbe.getCurve().getField()).getP();
        // Sur la courbe : y² = x³ + ax + b (mod p) ; sinon l'échange de clés serait faussé.
        if (x.compareTo(p) >= 0 || y.compareTo(p) >= 0 || !y.pow(2).mod(p).equals(
                x.pow(3).add(courbe.getCurve().getA().multiply(x)).add(courbe.getCurve().getB()).mod(p))) {
            throw new IllegalArgumentException("Point hors de la courbe P-256");
        }
        try {
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), courbe));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Clé publique P-256 illisible", e);
        }
    }

    /** Refuse (IllegalArgumentException) ce qui n'est pas une clé publique P-256 de 65 octets. */
    public static void verifierClePublique(byte[] brute) {
        publique(brute);
    }

    static KeyPair paire(byte[] publiqueBrute, byte[] priveeBrute) {
        try {
            PrivateKey privee = KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, priveeBrute), p256()));
            return new KeyPair(publique(publiqueBrute), privee);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static byte[] brute(ECPublicKey cle) {
        byte[] r = new byte[65];
        r[0] = 4;
        System.arraycopy(sur32(cle.getW().getAffineX().toByteArray()), 0, r, 1, 32);
        System.arraycopy(sur32(cle.getW().getAffineY().toByteArray()), 0, r, 33, 32);
        return r;
    }

    /** Un entier en exactement 32 octets (sans l'octet de signe, complété de zéros à gauche). */
    private static byte[] sur32(byte[] b) {
        if (b.length == 32) return b;
        byte[] r = new byte[32];
        if (b.length > 32) System.arraycopy(b, b.length - 32, r, 0, 32);
        else System.arraycopy(b, 0, r, 32 - b.length, b.length);
        return r;
    }
}
