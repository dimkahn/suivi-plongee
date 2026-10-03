package fr.club.plongee.materiel.service;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.EncodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.WriterException;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.google.zxing.qrcode.encoder.ByteMatrix;
import com.google.zxing.qrcode.encoder.Encoder;
import com.google.zxing.qrcode.encoder.QRCode;
import fr.club.plongee.commun.RegleMetierException;
import fr.club.plongee.materiel.domain.Equipement;
import fr.club.plongee.materiel.repository.EquipementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Étiquettes à QR code collées sur le matériel. Le QR code porte l'adresse
 * de la fiche ({@code https://…/materiel/42}) : l'appareil photo de
 * n'importe quel téléphone l'ouvre directement, et le bouton « Scanner »
 * de l'application la retrouve aussi. L'adresse vise l'id, pas la
 * référence : la référence peut être corrigée sans réimprimer l'étiquette.
 * Une ancienne étiquette qui ne porterait que la référence (« B-12 ») est
 * reconnue elle aussi.
 */
@Service
public class QrCodeMaterielService {

    /** Une planche d'étiquettes pour tout l'inventaire, mais pas davantage. */
    static final int ETIQUETTES_MAX = 500;
    static final long TAILLE_MAX_PHOTO_OCTETS = 5L * 1024 * 1024;

    /** L'adresse du site, sans chemin : celle que voit le navigateur qui demande les étiquettes. */
    private static final Pattern ORIGINE = Pattern.compile("https?://[A-Za-z0-9.\\-]+(:\\d{1,5})?");
    private static final Pattern ADRESSE_FICHE = Pattern.compile("/materiel/(\\d+)/?(?:[?#].*)?$");

    /**
     * Une étiquette : le QR code est rendu par l'écran, ligne par ligne
     * ({@code modules}, « 1 » = carré noir), sans marge autour.
     */
    public record EtiquetteVue(Long equipementId, String typeLibelle, String reference, String ancienneReference,
                               String adresse, List<String> modules) {}

    private final EquipementRepository equipements;

    public QrCodeMaterielService(EquipementRepository equipements) {
        this.equipements = equipements;
    }

    @Transactional(readOnly = true)
    public List<EtiquetteVue> etiquettes(List<Long> ids, String origine) {
        if (origine == null || !ORIGINE.matcher(origine.trim()).matches()) {
            throw new RegleMetierException("Adresse du site non reconnue : les QR codes ne peuvent pas être fabriqués.");
        }
        if (ids == null || ids.isEmpty()) {
            throw new RegleMetierException("Choisissez au moins un équipement.");
        }
        if (ids.size() > ETIQUETTES_MAX) {
            throw new RegleMetierException("Pas plus de " + ETIQUETTES_MAX + " étiquettes à la fois.");
        }
        String base = origine.trim();
        Map<Long, Equipement> parId = new HashMap<>();
        for (Equipement e : equipements.findAllById(ids)) parId.put(e.getId(), e);
        List<EtiquetteVue> resultat = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            Equipement e = parId.get(id);
            if (e == null) continue;
            String adresse = base + "/materiel/" + e.getId();
            resultat.add(new EtiquetteVue(e.getId(), e.getType().libelle(), e.getReference(),
                    e.getAncienneReference(), adresse, modules(adresse)));
        }
        return resultat;
    }

    /** Le texte lu dans un QR code (par le téléphone) : l'adresse d'une fiche, ou une référence du club. */
    @Transactional(readOnly = true)
    public Long retrouver(String contenu) {
        String texte = contenu == null ? "" : contenu.trim();
        if (texte.isEmpty()) throw new RegleMetierException("Le QR code est vide.");
        Matcher m = ADRESSE_FICHE.matcher(texte);
        if (m.find()) {
            Long id = Long.valueOf(m.group(1));
            if (equipements.existsById(id)) return id;
            throw new RegleMetierException("Cet équipement n'existe plus dans l'inventaire (supprimé ?).");
        }
        return equipements.findFirstByReferenceIgnoreCase(texte).map(Equipement::getId)
                .orElseThrow(() -> new RegleMetierException(
                        "Ce QR code ne correspond à aucun équipement du club : « " + abreger(texte) + " »."));
    }

    /** Pour les navigateurs qui ne savent pas lire un QR code eux-mêmes (iPhone) : une photo de l'étiquette. */
    @Transactional(readOnly = true)
    public Long retrouverSurPhoto(byte[] contenu) {
        if (contenu == null || contenu.length == 0) throw new RegleMetierException("La photo est vide.");
        if (contenu.length > TAILLE_MAX_PHOTO_OCTETS) throw new RegleMetierException("La photo est trop lourde (5 Mo au plus).");
        return retrouver(lire(contenu));
    }

    /** Le texte du QR code présent sur l'image. */
    static String lire(byte[] contenu) {
        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(contenu));
        } catch (IOException e) {
            image = null;
        }
        if (image == null) throw new RegleMetierException("La photo n'a pas pu être lue (JPEG ou PNG attendu).");
        int largeur = image.getWidth();
        int hauteur = image.getHeight();
        int[] pixels = image.getRGB(0, 0, largeur, hauteur, null, 0, largeur);
        LuminanceSource source = new RGBLuminanceSource(largeur, hauteur, pixels);
        Map<DecodeHintType, Object> indices = Map.of(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        // Deux façons de séparer le noir du blanc : la seconde rattrape parfois une photo mal éclairée.
        for (BinaryBitmap image01 : List.of(new BinaryBitmap(new HybridBinarizer(source)),
                new BinaryBitmap(new GlobalHistogramBinarizer(source)))) {
            try {
                return new QRCodeReader().decode(image01, indices).getText();
            } catch (ReaderException e) {
                // essai suivant
            }
        }
        throw new RegleMetierException(
                "Aucun QR code lisible sur la photo. Rapprochez-vous de l'étiquette, bien à plat et nette.");
    }

    /** Correction d'erreur moyenne (15 %) : une étiquette un peu rayée ou mouillée reste lisible. */
    static List<String> modules(String texte) {
        QRCode qr;
        try {
            qr = Encoder.encode(texte, ErrorCorrectionLevel.M, Map.of(EncodeHintType.CHARACTER_SET, "UTF-8"));
        } catch (WriterException e) {
            throw new IllegalStateException("QR code impossible pour « " + texte + " »", e);
        }
        ByteMatrix matrice = qr.getMatrix();
        List<String> lignes = new ArrayList<>(matrice.getHeight());
        for (int y = 0; y < matrice.getHeight(); y++) {
            StringBuilder ligne = new StringBuilder(matrice.getWidth());
            for (int x = 0; x < matrice.getWidth(); x++) ligne.append(matrice.get(x, y) == 1 ? '1' : '0');
            lignes.add(ligne.toString());
        }
        return lignes;
    }

    private static String abreger(String texte) {
        return texte.length() <= 60 ? texte : texte.substring(0, 57) + "…";
    }
}
