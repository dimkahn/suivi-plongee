package fr.club.plongee.identite;

import fr.club.plongee.commun.RegleMetierException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Identité de la structure qui utilise l'appli (une installation par club ou
 * centre) : nom, nom court, texte d'accueil, trois couleurs et logo, réglés
 * par un ADMIN (table {@code identite_structure}, une ligne, V74).
 * <p>
 * Un champ vide reprend l'identité d'origine, celle du club pour qui l'appli
 * a été écrite : logo embarqué ({@code documents/logo-club.png}), couleurs de
 * {@code styles.css}, nom de la variable {@code CLUB_NOM}. Une installation
 * existante ne change donc pas tant que rien n'est saisi.
 * <p>
 * Lu par les exports (en-tête de la fiche de sécurité, compte rendu TIV,
 * courriels de fin de séjour) et, sans connexion, par l'écran.
 */
@Service
public class IdentiteStructureService {

    /** {@code null} : valeur d'origine. {@code versionLogo} change à chaque dépôt (cache des navigateurs). */
    public record IdentiteVue(String nom, String nomCourt, String presentation,
                              String couleurPrincipale, String couleurFoncee, String couleurAccent,
                              boolean logoPersonnalise, long version) {}

    public record DemandeIdentite(String nom, String nomCourt, String presentation,
                                  String couleurPrincipale, String couleurFoncee, String couleurAccent) {}

    /** Couleur foncée d'origine (styles.css, --profond-fonce) : fond des icônes « maskable ». */
    static final String FONCEE_ORIGINE = "#0C3547";
    /** Plus grand côté du logo gardé : assez pour l'icône de 512 px. */
    static final int COTE_LOGO = 512;
    private static final Pattern COULEUR = Pattern.compile("#[0-9A-Fa-f]{6}");

    private final JdbcTemplate jdbc;
    private final String nomParDefaut;
    private final byte[] logoOrigine;

    public IdentiteStructureService(JdbcTemplate jdbc, @Value("${app.club.nom}") String nomParDefaut) {
        this.jdbc = jdbc;
        this.nomParDefaut = nomParDefaut;
        try (InputStream entree = new ClassPathResource("documents/logo-club.png").getInputStream()) {
            this.logoOrigine = entree.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Logo d'origine introuvable (documents/logo-club.png)", e);
        }
    }

    @Transactional(readOnly = true)
    public IdentiteVue lire() {
        return jdbc.queryForObject("""
                SELECT nom, nom_court, presentation, couleur_principale, couleur_foncee, couleur_accent,
                       logo IS NOT NULL, mise_a_jour_le
                  FROM identite_structure WHERE id = 1""",
                (rs, i) -> new IdentiteVue(rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getBoolean(7),
                        rs.getTimestamp(8).getTime()));
    }

    /** Le nom imprimé sur les documents (en-tête obligatoire de la fiche de sécurité, A322-72). */
    @Transactional(readOnly = true)
    public String nom() {
        String nom = lire().nom();
        return nom != null ? nom : nomParDefaut;
    }

    /** Le logo en PNG : celui déposé, sinon celui d'origine. */
    @Transactional(readOnly = true)
    public byte[] logoPng() {
        List<byte[]> logo = jdbc.query("SELECT logo FROM identite_structure WHERE id = 1 AND logo IS NOT NULL",
                (rs, i) -> rs.getBytes(1));
        return logo.isEmpty() ? logoOrigine : logo.getFirst();
    }

    /** Le logo embarqué dans l'appli, quand aucun n'a été déposé. */
    public byte[] logoOrigine() {
        return logoOrigine;
    }

    /** Pour une balise img dans le HTML converti en PDF. */
    public String logoDataUri() {
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(logoPng());
    }

    @Transactional
    public IdentiteVue modifier(DemandeIdentite d) {
        String nom = texte(d.nom(), 200, "Le nom");
        String nomCourt = texte(d.nomCourt(), 60, "Le nom court");
        String presentation = texte(d.presentation(), 1000, "Le texte d'accueil");
        jdbc.update("""
                UPDATE identite_structure
                   SET nom = ?, nom_court = ?, presentation = ?,
                       couleur_principale = ?, couleur_foncee = ?, couleur_accent = ?, mise_a_jour_le = ?
                 WHERE id = 1""",
                nom, nomCourt, presentation,
                couleur(d.couleurPrincipale(), "principale"), couleur(d.couleurFoncee(), "foncée"),
                couleur(d.couleurAccent(), "d'accent"), Timestamp.from(Instant.now()));
        return lire();
    }

    /** PNG ou JPEG ; gardé en PNG, réduit à {@value #COTE_LOGO} px de côté au plus. */
    @Transactional
    public IdentiteVue deposerLogo(byte[] contenu) {
        BufferedImage image = lireImage(contenu);
        if (image == null) {
            throw new RegleMetierException("Le logo doit être une image PNG ou JPEG.");
        }
        jdbc.update("UPDATE identite_structure SET logo = ?, mise_a_jour_le = ? WHERE id = 1",
                png(reduire(image, COTE_LOGO)), Timestamp.from(Instant.now()));
        return lire();
    }

    /** Retour au logo d'origine. */
    @Transactional
    public IdentiteVue supprimerLogo() {
        jdbc.update("UPDATE identite_structure SET logo = NULL, mise_a_jour_le = ? WHERE id = 1",
                Timestamp.from(Instant.now()));
        return lire();
    }

    /**
     * Icône carrée de l'appli installée sur un téléphone, tirée du logo.
     * {@code masquable} : fond de la couleur foncée et logo dans la zone sûre
     * (Android découpe en cercle) ; {@code fondBlanc} : iOS noircit la
     * transparence.
     */
    @Transactional(readOnly = true)
    public byte[] icone(int taille, boolean masquable, boolean fondBlanc) {
        BufferedImage logo = lireImage(logoPng());
        BufferedImage icone = new BufferedImage(taille, taille, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = icone.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        if (masquable || fondBlanc) {
            String foncee = lire().couleurFoncee();
            g.setColor(fondBlanc ? Color.WHITE : Color.decode(foncee != null ? foncee : FONCEE_ORIGINE));
            g.fillRect(0, 0, taille, taille);
        }
        // Zone sûre d'une icône « maskable » : un cercle de 80 % ; le logo en occupe 60 %.
        int cote = masquable ? taille * 3 / 5 : fondBlanc ? taille * 9 / 10 : taille;
        double echelle = Math.min((double) cote / logo.getWidth(), (double) cote / logo.getHeight());
        int l = (int) Math.round(logo.getWidth() * echelle);
        int h = (int) Math.round(logo.getHeight() * echelle);
        g.drawImage(logo, (taille - l) / 2, (taille - h) / 2, l, h, null);
        g.dispose();
        return png(icone);
    }

    /** Manifeste de l'appli installable, aux nom, couleur et icônes de la structure. */
    @Transactional(readOnly = true)
    public Map<String, Object> manifeste() {
        IdentiteVue v = lire();
        String nom = v.nom() != null ? "Suivi des formations – " + v.nom() : "Suivi des formations de plongée";
        String court = v.nomCourt() != null ? v.nomCourt() : "Suivi plongée";
        String version = "?v=" + v.version();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", "/");
        m.put("name", nom);
        m.put("short_name", court);
        m.put("description", "Suivi des compétences MFT des plongeurs N1, N2 et N3");
        m.put("start_url", "/");
        m.put("scope", "/");
        m.put("display", "standalone");
        m.put("background_color", "#F8FAFC");
        m.put("theme_color", v.couleurFoncee() != null ? v.couleurFoncee() : FONCEE_ORIGINE);
        m.put("lang", "fr");
        m.put("orientation", "portrait");
        m.put("icons", List.of(
                        Map.of("src", "/api/identite/icone/192.png" + version, "sizes", "192x192",
                                "type", "image/png", "purpose", "any"),
                        Map.of("src", "/api/identite/icone/512.png" + version, "sizes", "512x512",
                                "type", "image/png", "purpose", "any"),
                        Map.of("src", "/api/identite/icone/512.png" + version + "&masquable=true",
                                "sizes", "512x512", "type", "image/png", "purpose", "maskable")));
        return m;
    }

    private static String texte(String valeur, int max, String quoi) {
        if (valeur == null || valeur.isBlank()) return null;
        String t = valeur.trim();
        if (t.length() > max) {
            throw new RegleMetierException(quoi + " dépasse " + max + " caractères.");
        }
        return t;
    }

    private static String couleur(String valeur, String quoi) {
        if (valeur == null || valeur.isBlank()) return null;
        if (!COULEUR.matcher(valeur.trim()).matches()) {
            throw new RegleMetierException("La couleur " + quoi + " doit s'écrire #RRVVBB, par exemple #0891B2.");
        }
        return valeur.trim().toUpperCase();
    }

    private static BufferedImage lireImage(byte[] contenu) {
        if (contenu == null || contenu.length == 0) return null;
        try {
            return ImageIO.read(new ByteArrayInputStream(contenu));
        } catch (IOException e) {
            return null;
        }
    }

    private static BufferedImage reduire(BufferedImage image, int cote) {
        double echelle = Math.min(1.0, Math.min((double) cote / image.getWidth(), (double) cote / image.getHeight()));
        int l = Math.max(1, (int) Math.round(image.getWidth() * echelle));
        int h = Math.max(1, (int) Math.round(image.getHeight() * echelle));
        BufferedImage reduite = new BufferedImage(l, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = reduite.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.drawImage(image, 0, 0, l, h, null);
        g.dispose();
        return reduite;
    }

    private static byte[] png(BufferedImage image) {
        try {
            ByteArrayOutputStream sortie = new ByteArrayOutputStream();
            ImageIO.write(image, "png", sortie);
            return sortie.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
