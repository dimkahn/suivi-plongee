package fr.club.plongee.formation.service;

import fr.club.plongee.formation.domain.FicheSecurite;
import fr.club.plongee.formation.domain.MembrePalanquee;
import fr.club.plongee.formation.domain.Palanquee;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;

/**
 * Empreinte scellée d'une fiche de sécurité signée (demande du club,
 * octobre 2026) : HMAC-SHA256 de son contenu, avec une clé du serveur qui
 * n'est pas en base. Calculée à la signature, recalculée à chaque lecture :
 * une fiche modifiée après coup, même directement en base, ne retombe plus
 * sur la même empreinte, et sans la clé on ne peut pas en refaire une juste.
 *
 * <p>Le contenu couvre tout ce que la fiche affiche et imprime : séance (son
 * identifiant et sa date), DP, conditions, palanquées (profils prévu et
 * réalisé) et plongeurs, plus le signataire et la date de signature. Changer
 * ce qu'il couvre change toutes les empreintes déjà signées : n'y ajouter un
 * champ qu'avec une version suivante de {@link #FORMAT}.
 */
@Component
public class EmpreinteFicheSecurite {

    /** Version du contenu signé, en tête de celui-ci. */
    static final String FORMAT = "fiche-securite/1";

    private final SecretKeySpec cle;

    /** {@code cle} vide : la clé des jetons de connexion ({@code JWT_SECRET}). */
    public EmpreinteFicheSecurite(@Value("${app.signature-fiches.cle:}") String cle,
                                  @Value("${app.jwt.secret}") String cleJetons) {
        String choisie = cle == null || cle.isBlank() ? cleJetons : cle;
        this.cle = new SecretKeySpec(choisie.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** L'empreinte du contenu actuel de la fiche, en hexadécimal (64 caractères). */
    public String calculer(FicheSecurite fiche) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(cle);
            return HexFormat.of().formatHex(mac.doFinal(contenu(fiche).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 indisponible", e);
        }
    }

    /** Vrai si la fiche est signée et que son contenu n'a pas changé depuis la signature. */
    public boolean estIntegre(FicheSecurite fiche) {
        return fiche.getEmpreinte() != null && MessageDigest.isEqual(
                fiche.getEmpreinte().getBytes(StandardCharsets.UTF_8),
                calculer(fiche).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Le texte signé : une ligne par valeur, préfixée de son nom ; retours à
     * la ligne et barres obliques inverses échappés, pour qu'une valeur ne
     * puisse pas se faire passer pour la suivante.
     */
    static String contenu(FicheSecurite f) {
        StringBuilder t = new StringBuilder(FORMAT).append('\n');
        ligne(t, "seance", f.getSeance().getId());
        ligne(t, "date", f.getSeance().getDateSeance());
        ligne(t, "dp", f.getDp().getId());
        ligne(t, "meteo", f.getMeteo());
        ligne(t, "etatMer", f.getEtatMer());
        ligne(t, "visibilite", f.getVisibilite());
        ligne(t, "courant", f.getCourant());
        ligne(t, "maree", f.getMaree());
        ligne(t, "temperatureEau", f.getTemperatureEau());
        ligne(t, "securiteSurface", f.getSecuriteSurface());
        ligne(t, "planSecours", f.getPlanSecours());
        ligne(t, "observations", f.getObservations());
        for (Palanquee p : f.getPalanquees().stream().sorted(Comparator.comparingInt(Palanquee::getNumero)).toList()) {
            ligne(t, "palanquee", p.getNumero());
            ligne(t, "profondeurPrevue", p.getProfondeurPrevue());
            ligne(t, "dureePrevue", p.getDureePrevue());
            ligne(t, "profondeurRealisee", p.getProfondeurRealisee());
            ligne(t, "dureeRealisee", p.getDureeRealisee());
            ligne(t, "paliers", p.getPaliers());
            ligne(t, "heureImmersion", p.getHeureImmersion());
            ligne(t, "heureSortie", p.getHeureSortie());
            // Les plongeurs, dans l'ordre de leur saisie (identifiant croissant, une saisie les recrée tous).
            // Sans le lien vers le dossier de l'élève ou le compte : la suppression d'un élève le défait
            // (SuppressionEleveService) sans rien changer à ce que la fiche dit.
            for (MembrePalanquee m : p.getMembres().stream()
                    .sorted(Comparator.comparing(MembrePalanquee::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList()) {
                ligne(t, "nom", m.getNom());
                ligne(t, "prenom", m.getPrenom());
                ligne(t, "aptitude", m.getAptitude());
                ligne(t, "aptitudeDonneeParDp", m.getAptitudeDonneeParDp());
                ligne(t, "qualificationPreparee", m.getQualificationPreparee());
                ligne(t, "fonction", m.getFonction());
                ligne(t, "gaz", m.getGaz());
                ligne(t, "ppo2Max", m.getPpo2Max() == null ? null : m.getPpo2Max().stripTrailingZeros().toPlainString());
                ligne(t, "moyenDesaturation", m.getMoyenDesaturation());
                ligne(t, "observationsPlongeur", m.getObservations());
            }
        }
        ligne(t, "signataire", f.getSignataire() == null ? null : f.getSignataire().getId());
        ligne(t, "signeeLe", f.getSigneeLe());
        return t.toString();
    }

    private static void ligne(StringBuilder t, String nom, Object valeur) {
        t.append(nom).append('=');
        if (valeur == null) {
            t.append('∅');
        } else {
            String texte = valeur instanceof BigDecimal d ? d.toPlainString() : valeur.toString();
            t.append(texte.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("∅", "\\∅"));
        }
        t.append('\n');
    }
}
