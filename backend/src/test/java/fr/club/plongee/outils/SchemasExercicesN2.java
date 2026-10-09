package fr.club.plongee.outils;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Outil, pas un test : dessine les schémas des exercices du N2 PA20 | PE40
 * (base d'exercices, V59) dans le style de ceux du N1 : une carte de
 * 650 × 450, le titre de l'exercice, une coupe de l'eau (élève en bleu,
 * moniteur ou équipier en gris, repères de profondeur, bande grisée pour
 * une tolérance, flèches pour les trajectoires) et deux lignes de légende.
 *
 * <p>Ignoré par {@code mvn test} ; lancement à la demande, depuis {@code backend/} :
 * {@code mvn test -Dtest=SchemasExercicesN2 -Dschemas.n2=src/main/resources/db/schemas/n2}
 *
 * <p>Les images produites sont chargées en base par la migration
 * V60__schemas_exercices_n2 ; une fois celle-ci appliquée, les schémas se
 * remplacent depuis /admin/exercices et non en relançant cet outil.
 */
class SchemasExercicesN2 {

    @Test
    @EnabledIfSystemProperty(named = "schemas.n2", matches = ".+")
    void generer() throws Exception {
        System.setProperty("java.awt.headless", "true");
        main(new String[] {System.getProperty("schemas.n2")});
    }

    static final Color BLEU = new Color(0x2F7BD8);
    static final Color BLEU_CLAIR = new Color(0xCFE0F7);
    static final Color GRIS = new Color(0x8E8C84);
    static final Color GRIS_CLAIR = new Color(0xE4E3DE);
    static final Color GRIS_TRAIT = new Color(0xC8C6BC);
    static final Color EAU = new Color(0xEEF3FA);
    static final Color TEXTE = new Color(0x1E1E1E);
    static final Color TEXTE_DOUX = new Color(0x6B6A64);
    static final Color CORAIL = new Color(0xF26B5B);
    static final Color JAUNE = new Color(0xE8B323);

    static Font police;
    static Font policeGrasse;

    public static void main(String[] args) throws Exception {
        chargerPolices();
        ecrire(schemas(), new File(args.length > 0 ? args[0] : "schemas-n2"));
    }

    /** Écrit chaque schéma en {@code <numéro>.png} ; partagé avec {@link SchemasExercicesN3}. */
    static void ecrire(List<Schema> liste, File dossier) throws Exception {
        dossier.mkdirs();
        for (Schema s : liste) {
            ImageIO.write(s.image, "png", new File(dossier, s.numero + ".png"));
            System.out.println("Schéma " + s.numero);
        }
    }

    /** À appeler avant de créer un schéma. */
    static void chargerPolices() {
        if (police != null) return;
        police = charger("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", Font.PLAIN);
        policeGrasse = charger("/usr/share/fonts/truetype/noto/NotoSans-SemiBold.ttf", Font.BOLD);
    }

    static Font charger(String chemin, int style) {
        try {
            return Font.createFont(Font.TRUETYPE_FONT, new File(chemin));
        } catch (Exception e) {
            return new Font(Font.SANS_SERIF, style, 12);
        }
    }

    // =====================================================================
    //  Les schémas, compétence par compétence
    // =====================================================================

    static List<Schema> schemas() {
        List<Schema> liste = new ArrayList<>();
        Schema s;

        // ---------- 1. S'équiper - se mettre à l'eau et en sortir ----------
        s = new Schema("1.3", "Mises à l'eau et sortie par l'échelle");
        s.eau(200, 0);
        s.quai(8, 190, 170);
        s.quai(560, 642, 150);
        s.echelle(545, 150, 320);
        s.plongeur(120, 104, -90, true, 0.75);
        s.courbe(150, 110, 230, 120, 250, 205, false);
        s.texte(215, 105, "saut droit");
        s.plongeur(300, 212, -90, true, 0.75);
        s.etiquette(330, 175, "signe OK");
        s.plongeur(505, 214, -90, true, 0.75);
        s.courbe(525, 200, 540, 120, 600, 128, false);
        s.texte(320, 315, "palmes retirées dans l'eau");
        s.legende("Zone vérifiée, une main sur masque et détendeur, signe OK.",
                "À l'échelle : palmes retirées dans l'eau, détendeur en bouche.");
        liste.add(s);

        s = new Schema("1.5", "Décapelage et recapelage dans l'eau");
        s.eau(180, 0);
        s.plongeur(170, 186, -90, true, 0.8);
        s.blocFlottant(300, 182);
        s.plongeur(430, 186, -90, false, 0.8);
        s.fleche(330, 205, 405, 205, true);
        s.courbe(410, 240, 330, 300, 200, 250, true);
        s.texte(255, 140, "1. décapelage");
        s.texte(385, 140, "2. bloc passé");
        s.texte(255, 320, "3. récupéré, recapelage");
        s.legende("Gilet gonflé, détendeur en bouche, une main sur le gilet.",
                "Le bloc passe à l'équipier, revient, puis recapelage.");
        liste.add(s);

        s = new Schema("1.6", "Mise à l'eau d'une embarcation");
        s.eau(180, 0);
        s.bateau(30, 250, 180);
        s.plongeur(215, 110, -90, true, 0.6);
        s.courbe(235, 105, 300, 110, 300, 200, false);
        s.texte(255, 98, "bascule arrière au signal");
        s.plongeur(410, 188, -90, false, 0.7);
        s.plongeur(460, 188, -90, true, 0.7);
        s.plongeur(510, 188, -90, true, 0.7);
        s.cadre(380, 160, 165, 110, "regroupement");
        s.legende("Bascule arrière au signal du DP, dos libre, masque tenu.",
                "La palanquée se regroupe aussitôt en surface.");
        liste.add(s);

        // ---------- 2. S'immerger - se propulser - se ventiler ----------
        s = new Schema("2.1", "Canard et phoque en palanquée");
        s.eau(120, 320);
        s.plongeur(100, 128, -90, false, 0.7);
        s.texte(70, 108, "signal");
        s.plongeur(260, 190, -90, true, 0.75);
        s.fleche(300, 140, 300, 290, true);
        s.texte(232, 108, "phoque");
        s.plongeur(440, 200, 90, true, 0.75);
        s.fleche(480, 140, 480, 290, true);
        s.texte(412, 108, "canard");
        s.texte(540, 312, "fond");
        s.legende("Au signal, toute la palanquée s'immerge, sans palmer en surface.",
                "Phoque : gilet vidé, expiration. Canard : capelé, jambes à la verticale.");
        liste.add(s);

        s = new Schema("2.3", "REC guidée sur 5 à 6 m");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bout(330, 110, s.y(6));
        s.plongeur(290, Schema.teteAuFond(s.y(6), 0.8), -90, true, 0.8);
        s.fleche(250, Schema.teteAuFond(s.y(6), 0.8), 250, 125, true);
        s.bulles(270, 150);
        s.bulles(270, 200);
        s.plongeur(400, s.y(3), -90, false, 0.8);
        s.texte(380, 150, "moniteur face à l'élève");
        s.reperes(3, 6);
        s.legende("Départ du fond stabilisé, inspiration normale, embout en bouche.",
                "Expiration continue jusqu'en surface, sans précipitation.");
        liste.add(s);

        s = new Schema("2.4", "Descente et remontée contrôlées");
        s.echelleProfondeur(105, 10.5);
        s.eau(105, 0);
        s.bande(9, 11, "± 1 m");
        s.bande(14, 16, "");
        s.chemin(true, 60, 105, 190, s.y(10), 270, s.y(10), 330, s.y(15), 400, s.y(15), 520, s.y(3));
        s.plongeur(250, s.y(10), 0, true, 0.6);
        s.plongeur(385, s.y(15), 0, true, 0.6);
        s.plongeur(545, s.y(3), -45, true, 0.6);
        s.reperes(3, 10, 15, 20);
        s.legende("Arrêts aux profondeurs annoncées, tenus à ± 1 m,",
                "au gilet et au poumon ballast ; remontée jusqu'au palier de 3 m.");
        liste.add(s);

        s = new Schema("2.9", "REC sur 10 m");
        s.echelleProfondeur(110, 20);
        s.eau(110, s.y(10));
        s.plongeur(310, Schema.teteAuFond(s.y(10), 0.8), -90, true, 0.8);
        s.fleche(265, Schema.teteAuFond(s.y(10), 0.8), 265, 125, true);
        s.bulles(285, 160);
        s.bulles(285, 210);
        s.plongeur(400, s.y(5), -90, false, 0.8);
        s.cote(150, 110, 150, s.y(10), "10 m au plus");
        s.reperes(5, 10);
        s.legende("Milieu naturel. Départ du fond stabilisé, inspiration normale.",
                "Rejet d'air continu, vitesse correcte, aucun critère de temps.");
        liste.add(s);

        // ---------- 3. Respecter le milieu et l'environnement ----------
        s = new Schema("3.1", "Stabilisation sans appui");
        s.eau(80, 320);
        s.cerceauAuSol(330);
        s.plongeur(380, 262, 0, true, 1);
        s.cote(470, 278, 470, 318, "50 cm");
        s.fleche(410, 210, 560, 210, true);
        s.texte(430, 200, "puis palmage de grenouille");
        s.legende("Palmes immobiles au-dessus du fond fragile, sans le toucher.",
                "Puis départ en palmage de grenouille, sans soulever le sable.");
        liste.add(s);

        s = new Schema("3.4", "Évoluer près d'une paroi ou d'une épave");
        s.eau(80, 0);
        s.paroi(520);
        s.plongeur(405, 180, 0, true, 1);
        s.cote(418, 230, 515, 230, "1 m");
        s.fleche(380, 210, 380, 310, true);
        s.texte(220, 260, "le long du tombant");
        s.legende("À 1 m de la paroi ou de l'épave, trajectoire stable, sans contact.",
                "Lampe orientée à côté de l'animal, palmes hautes.");
        liste.add(s);

        s = new Schema("3.6", "Parcours d'obstacles sans contact");
        s.eau(80, 320);
        s.cerceauDebout(260, 220);
        s.cerceauDebout(390, 220);
        s.cerceauDebout(520, 220);
        s.plongeur(170, 220, 0, true, 0.9);
        s.fleche(185, 220, 610, 220, true);
        s.legende("Passage lent dans les cerceaux, sans les toucher ni s'appuyer.",
                "Équilibre gardé au gilet et au poumon ballast.");
        liste.add(s);

        // ---------- 4. Être attentif au matériel de ses équipiers ----------
        s = new Schema("4.2", "Ajuster son lestage");
        s.eau(170, 0);
        s.plongeur(230, 172, -90, true, 0.85);
        s.texte(120, 130, "poumons pleins : eau aux yeux");
        s.plongeur(450, 205, -90, true, 0.85);
        s.fleche(500, 200, 500, 260, true);
        s.texte(390, 130, "à l'expiration : descente lente");
        s.legende("Gilet vide, vertical, sans palmer : test avec l'équipement complet.",
                "Ajouter ou retirer 1 kg, puis noter le lestage au carnet.");
        liste.add(s);

        s = new Schema("4.8", "Lestage adapté au changement d'équipement");
        s.echelleProfondeur(120, 30);
        s.eau(120, 0);
        s.bande(2.5, 3.5, "palier");
        s.plongeur(300, s.y(3), 0, true, 1);
        s.plongeur(450, s.y(3), 180, false, 1);
        s.texte(230, s.y(3) + 55, "fin de plongée, bloc presque vide");
        s.reperes(3, 6);
        s.legende("Après un changement de combinaison, de bloc ou d'eau,",
                "le lestage ajusté se confirme au palier de 3 m, tenu sans effort.");
        liste.add(s);

        // ---------- 5. Évoluer en autonomie ----------
        s = new Schema("5.3", "Lancer un parachute");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.plongeur(260, s.y(5), 0, true, 1);
        s.parachute(330, 110, 268, s.y(5) - 10);
        s.texte(360, 200, "gonflé à l'octopus");
        s.texte(360, 225, "dévidoir tenu en main");
        s.reperes(3, 6);
        s.legende("Stabilisé, l'élève déroule, gonfle et lâche le parachute.",
                "Le parachute monte seul : l'élève reste à sa profondeur.");
        liste.add(s);

        s = new Schema("5.5", "Parachute en pleine eau");
        s.echelleProfondeur(110, 30);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.plongeur(200, s.y(5.5), 0, true, 0.9);
        s.parachute(420, 110, 208, s.y(5.5) - 10);
        s.fleche(240, s.y(5.5) + 25, 360, s.y(3) + 20, true);
        s.plongeur(400, s.y(3), 0, true, 0.9);
        s.reperes(3, 5);
        s.legende("Lancement stabilisé à 5-6 m, puis remontée le long du bout.",
                "Vitesse donnée par l'ordinateur, palier tenu à 3 m.");
        liste.add(s);

        s = new Schema("5.8", "Parachute et sortie de l'eau");
        s.echelleProfondeur(140, 30);
        s.eau(140, 0);
        s.bande(2.5, 3.5, "palier");
        s.bateau(470, 642, 140);
        s.plongeur(150, s.y(3), 0, true, 0.8);
        s.plongeur(240, s.y(3) + 18, 0, true, 0.8);
        s.parachute(300, 140, 248, s.y(3) + 8);
        s.fleche(330, s.y(3), 400, 150, true);
        s.texte(330, 115, "tour d'horizon");
        s.reperes(3, 6);
        s.legende("Parachute lancé au palier : le bateau repère la palanquée.",
                "Remontée groupée, tour d'horizon, sortie à l'écart de l'hélice.");
        liste.add(s);

        // ---------- 6. Planifier la plongée ----------
        s = new Schema("6.5", "Compas en immersion");
        s.eau(80, 320);
        s.plot(170, "départ");
        s.plongeur(240, 200, 0, true, 0.75);
        s.plongeur(240, 240, 0, true, 0.75);
        s.fleche(260, 195, 570, 195, true);
        s.fleche(570, 270, 200, 270, true);
        s.texte(390, 185, "aller : cap");
        s.texte(360, 292, "retour : cap inverse");
        s.cote(170, 120, 570, 120, "20 à 30 m");
        s.legende("En binôme : cap pris au départ, aller sur 20 à 30 m,",
                "demi-tour au cap inverse, retour près du point de départ.");
        liste.add(s);

        s = new Schema("6.8", "Aller-retour au compas et trajet prédéfini");
        s.vueDeDessus();
        s.point(90, 150, "départ");
        s.fleche(110, 140, 330, 140, true);
        s.fleche(330, 162, 110, 162, true);
        s.texte(140, 125, "aller-retour 20 à 30 m");
        s.roche(250, 275, "A");
        s.roche(420, 225, "B");
        s.roche(560, 150, "C");
        s.chemin(true, 100, 200, 228, 268, 398, 228, 538, 158);
        s.texte(290, 318, "trajet prédéfini");
        s.legende("Milieu naturel. Aller-retour au compas, retour au point de départ,",
                "puis court trajet d'un repère à l'autre.");
        liste.add(s);

        // ---------- 7. Intervenir et porter assistance ----------
        s = new Schema("7.2", "Remontée assistée au gilet");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.paire(300, Schema.teteAuFond(s.y(6), 0.85), 0.85);
        s.fleche(240, Schema.teteAuFond(s.y(6), 0.85), 240, 125, true);
        s.texte(360, 175, "main sur son inflateur");
        s.texte(360, 200, "main sur sa purge");
        s.reperes(3, 6);
        s.legende("Face à l'assisté : une main sur son inflateur, l'autre sur sa purge.",
                "Remontée au gilet, l'assisté garde son détendeur en bouche.");
        liste.add(s);

        s = new Schema("7.4", "Assistance depuis 10 m");
        s.echelleProfondeur(100, 20);
        s.eau(100, s.y(10));
        s.bande(3, 5, "arrêt marqué");
        s.paire(160, Schema.teteAuFond(s.y(10), 0.7), 0.7);
        s.chemin(true, 200, s.y(8), 320, s.y(4.2), 400, s.y(4.2), 470, 110);
        s.paire(360, s.y(4.2) - 10, 0.7);
        s.paire(510, 112, 0.7);
        s.reperes(3, 5, 10);
        s.legende("Remontée régulière au gilet depuis 10 m.",
                "Arrêt marqué entre 5 et 3 m, puis surface et signe de détresse.");
        liste.add(s);

        s = new Schema("7.7", "Assistance complète depuis le fond");
        s.echelleProfondeur(100, 10);
        s.eau(100, s.y(20));
        s.bande(3, 5, "arrêt marqué");
        s.bateau(520, 642, 100);
        s.paire(120, Schema.teteAuFond(s.y(20), 0.7), 0.7);
        s.chemin(true, 160, s.y(18), 280, s.y(4), 350, s.y(4), 420, 108);
        s.paire(310, s.y(4) - 10, 0.7);
        s.paire(460, 112, 0.7);
        s.reperes(3, 5, 10, 20);
        s.legende("Depuis 20 m : interprétation, prise en charge, vitesse adaptée,",
                "arrêt marqué entre 5 et 3 m, surface et sortie d'eau sécurisée.");
        liste.add(s);

        // ---------- 8. Se ventiler - s'équilibrer ----------
        s = new Schema("8.2", "VDM stabilisé");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bande(3.5, 4.5, "");
        s.plongeur(330, s.y(4), 0, true, 1);
        s.etiquette(360, 175, "masque retiré, remis, vidé");
        s.texte(220, s.y(6) - 15, "pas d'appui au fond");
        s.reperes(4, 6);
        s.legende("En pleine eau, sans toucher le fond : retrait, remise et vidage.",
                "Ventilation normale, profondeur gardée.");
        liste.add(s);

        s = new Schema("8.6", "Stabilisation aux profondeurs annoncées");
        s.echelleProfondeur(105, 13);
        s.eau(105, 0);
        s.bande(4, 6, "± 1 m");
        s.bande(9, 11, "± 1 m");
        s.plongeur(180, s.y(7.5), 0, false, 0.75);
        s.etiquette(110, s.y(7.5) - 50, "« 10 m »");
        s.chemin(true, 260, 115, 280, s.y(5), 340, s.y(5), 380, s.y(10), 460, s.y(10));
        s.plongeur(320, s.y(5), 0, true, 0.6);
        s.plongeur(450, s.y(10), 0, true, 0.6);
        s.reperes(5, 10, 15);
        s.legende("Le moniteur annonce une profondeur, l'élève s'y arrête au gilet.",
                "Affinage au poumon ballast : chaque arrêt tenu à ± 1 m.");
        liste.add(s);

        s = new Schema("8.7", "VDM à 20 m en situations variées");
        s.echelleProfondeur(100, 10);
        s.eau(100, 0);
        s.bande(19, 21, "");
        s.plongeur(250, s.y(20), 0, true, 0.9);
        s.etiquette(170, s.y(20) - 70, "VDM");
        s.fleche(270, s.y(20) + 25, 420, s.y(20) + 25, true);
        s.plongeur(470, s.y(20), 180, false, 0.9);
        s.reperes(10, 20);
        s.legende("Milieu naturel, 20 m : VDM stabilisé, en déplacement,",
                "puis après un lâcher d'embout ; sans stress, profondeur gardée.");
        liste.add(s);

        // ---------- 9. Communiquer avec le guide de palanquée ----------
        s = new Schema("9.2", "Annoncer ses paramètres");
        s.eau(80, 320);
        s.plongeur(200, 220, 0, false, 1);
        s.carte(230, 165, "100 bar");
        s.plongeur(460, 220, 180, true, 1);
        s.etiquette(400, 160, "signe : pression");
        s.legende("Le moniteur montre une carte : pression, palier, ressenti.",
                "L'élève répond par le signe correspondant, clair et visible.");
        liste.add(s);

        s = new Schema("9.4", "Répondre au GP en immersion");
        s.eau(80, 0);
        s.plongeur(200, 200, 0, false, 1);
        s.texte(130, 250, "GP");
        s.etiquette(140, 130, "pression ? paliers ?");
        s.plongeur(450, 190, 180, true, 1);
        s.plongeur(470, 250, 180, true, 1);
        s.etiquette(400, 120, "réponse par signe");
        s.legende("Milieu naturel. Le GP demande pression, paliers et état.",
                "Chacun répond face au GP, main bien visible, sans délai.");
        liste.add(s);

        // ---------- 10. Retourner en surface ----------
        s = new Schema("10.3", "Remontée le long d'un bout");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bout(320, 110, s.y(6));
        s.bande(2.5, 3.5, "palier");
        s.plongeur(295, s.y(4), -90, true, 0.6);
        s.fleche(250, s.y(5.5), 250, s.y(3), true);
        s.texte(360, s.y(5), "œil sur l'indicateur de vitesse");
        s.reperes(3, 6);
        s.legende("Une main sur le bout, vitesse donnée par l'ordinateur.",
                "Arrêt au palier simulé de 3 m, puis surface.");
        liste.add(s);

        s = new Schema("10.5", "Remontée en pleine eau sans repère");
        s.echelleProfondeur(100, 10);
        s.eau(100, 0);
        s.bande(2.5, 3.5, "palier");
        s.plongeur(150, s.y(17), -30, true, 0.8);
        s.plongeur(250, s.y(18), -30, false, 0.8);
        s.chemin(true, 165, s.y(15.5), 350, s.y(3), 430, s.y(3), 480, 108);
        s.plongeur(390, s.y(3), 0, true, 0.6);
        s.texte(440, 90, "tour d'horizon");
        s.reperes(3, 10, 20);
        s.legende("Sans repère : vitesse donnée par l'ordinateur, palier de 3 m tenu.",
                "Tour d'horizon avant la surface, moniteur à côté.");
        liste.add(s);

        s = new Schema("10.7", "Remontée isolée");
        s.echelleProfondeur(110, 10);
        s.eau(110, s.y(20));
        s.bande(2.5, 3.5, "palier");
        s.bateau(520, 642, 110);
        s.plongeur(120, s.y(20) - 40, -30, true, 0.8);
        s.plongeur(240, s.y(20) - 12, 0, false, 0.6);
        s.chemin(true, 140, s.y(17), 300, s.y(3), 380, s.y(3), 440, 118);
        s.plongeur(340, s.y(3), 0, true, 0.6);
        s.plongeur(470, 118, -90, true, 0.55);
        s.texte(400, 95, "signal");
        s.reperes(3, 10, 20);
        s.legende("Seul, moniteur à proximité : vitesse, palier, tour d'horizon.",
                "En surface : gilet gonflé, signal au bateau, sortie de l'eau.");
        liste.add(s);

        // ---------- 11. Intervenir en relais sur un équipier ----------
        s = new Schema("11.1", "Donner son deuxième détendeur");
        s.eau(80, 0);
        s.plongeur(250, 210, 0, false, 1);
        s.texte(160, 260, "équipier");
        s.plongeur(390, 210, 180, true, 1);
        s.octopus(370, 214, 262, 212);
        s.etiquette(170, 130, "signe : panne d'air");
        s.texte(330, 260, "élève");
        s.legende("Au signe « panne d'air », l'élève présente son deuxième détendeur,",
                "puis tient l'équipier par le gilet, face à face.");
        liste.add(s);

        s = new Schema("11.3", "Se déplacer jusqu'au GP");
        s.eau(80, 320);
        s.plongeur(170, 200, 0, false, 0.85);
        s.plongeur(180, 235, 0, true, 0.85);
        s.octopus(172, 240, 178, 206);
        s.fleche(210, 218, 440, 218, true);
        s.plongeur(500, 218, 180, false, 0.85);
        s.texte(490, 270, "GP");
        s.cote(200, 140, 480, 140, "10 m environ");
        s.legende("Reliés par l'octopus, l'élève et l'équipier rejoignent le GP.",
                "Déplacement calme, profondeur gardée.");
        liste.add(s);

        s = new Schema("11.7", "Relais complet en panne d'air");
        s.echelleProfondeur(100, 12);
        s.eau(100, 0);
        s.bande(14, 16, "± 1 m");
        s.plongeur(200, s.y(15) - 15, 0, false, 0.8);
        s.plongeur(210, s.y(15) + 20, 0, true, 0.8);
        s.octopus(202, s.y(15) + 24, 198, s.y(15) - 10);
        s.texte(100, 140, "1. prise en charge");
        s.texte(100, 165, "2. passage d'embout");
        s.fleche(245, s.y(15), 410, s.y(15), true);
        s.texte(240, s.y(15) - 25, "3. jusqu'au GP, sans descendre");
        s.plongeur(460, s.y(15), 180, false, 0.8);
        s.texte(450, s.y(15) + 45, "GP");
        s.reperes(10, 15);
        s.legende("Milieu naturel : prise en charge, passage d'embout,",
                "maintien de la profondeur, déplacement jusqu'au GP.");
        liste.add(s);

        return liste;
    }

    // =====================================================================
    //  Une carte de schéma et ses éléments de dessin
    // =====================================================================

    static class Schema {
        static final int L = 650, H = 450;
        static final int HAUT = 80, BAS = 335;
        final String numero;
        final BufferedImage image = new BufferedImage(L, H, BufferedImage.TYPE_INT_ARGB);
        final Graphics2D g = image.createGraphics();
        double surface = 110, pxParMetre = 10;

        Schema(String numero, String titre) {
            this.numero = numero;
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            g.setColor(Color.WHITE);
            g.fill(new RoundRectangle2D.Double(6, 6, L - 12, H - 12, 18, 18));
            g.setColor(TEXTE);
            g.setFont(policeGrasse.deriveFont(Font.BOLD, 21f));
            g.drawString(numero + " " + titre, 34, 52);
            g.setClip(new Rectangle(8, HAUT, L - 16, BAS - HAUT));
        }

        void legende(String ligne1, String ligne2) {
            g.setClip(null);
            g.setColor(new Color(0xDDDCD6));
            g.setStroke(new BasicStroke(2));
            g.draw(new RoundRectangle2D.Double(6, 6, L - 12, H - 12, 18, 18));
            g.setColor(TEXTE);
            g.setFont(police.deriveFont(18f));
            g.drawString(ligne1, 34, 385);
            g.drawString(ligne2, 34, 412);
            g.dispose();
        }

        // ---------- Eau, fond, profondeurs ----------

        void echelleProfondeur(double ySurface, double pxParMetre) {
            this.surface = ySurface;
            this.pxParMetre = pxParMetre;
        }

        double y(double metres) {
            return surface + metres * pxParMetre;
        }

        /** Hauteur de la tête d'un plongeur debout dont les palmes touchent le fond. */
        static double teteAuFond(double yFond, double echelle) {
            return yFond - 98 * echelle - 3;
        }

        /** Eau à partir de la surface ; fond en trait épais si yFond > 0. */
        void eau(double ySurface, double yFond) {
            this.surface = ySurface;
            double bas = yFond > 0 ? yFond : BAS;
            g.setColor(EAU);
            g.fill(new Rectangle2D.Double(8, ySurface, L - 16, bas - ySurface));
            if (ySurface > HAUT) {
                g.setColor(BLEU);
                g.setStroke(new BasicStroke(2.5f));
                g.draw(new Line2D.Double(8, ySurface, L - 8, ySurface));
            }
            if (yFond > 0) {
                g.setColor(GRIS_TRAIT);
                g.setStroke(new BasicStroke(4));
                g.draw(new Line2D.Double(8, yFond, L - 8, yFond));
            }
        }

        void vueDeDessus() {
            g.setColor(EAU);
            g.fill(new Rectangle2D.Double(8, HAUT, L - 16, BAS - HAUT));
            texteDoux(L - 140, HAUT + 22, "vue de dessus");
        }

        void reperes(double... metres) {
            g.setFont(police.deriveFont(15f));
            for (double m : metres) {
                double yy = y(m);
                g.setColor(GRIS);
                g.setStroke(new BasicStroke(1.5f));
                g.draw(new Line2D.Double(L - 70, yy, L - 58, yy));
                g.setColor(TEXTE_DOUX);
                g.drawString(entier(m) + " m", L - 52, (float) yy + 5);
            }
        }

        /** Bande grisée entre deux profondeurs : une tolérance, un palier. */
        void bande(double m1, double m2, String libelle) {
            g.setColor(new Color(0x8E, 0x8C, 0x84, 46));
            g.fill(new Rectangle2D.Double(8, y(m1), L - 90, y(m2) - y(m1)));
            if (!libelle.isEmpty()) texteDoux(20, (float) ((y(m1) + y(m2)) / 2 + 5), libelle);
        }

        // ---------- Plongeurs ----------

        /**
         * Plongeur vu de profil, tête en (x, y). Angle 0 : à l'horizontale
         * tête à droite ; -90 : debout ; 90 : tête en bas ; 180 : tête à gauche.
         */
        void plongeur(double x, double y, double angle, boolean eleve, double echelle) {
            AffineTransform avant = g.getTransform();
            g.translate(x, y);
            if (angle == 180) {
                g.scale(-echelle, echelle);
            } else {
                g.rotate(Math.toRadians(angle));
                g.scale(echelle, echelle);
            }
            Color trait = eleve ? BLEU : GRIS;
            Color fond = eleve ? BLEU_CLAIR : GRIS_CLAIR;
            g.setStroke(new BasicStroke(2.2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            Shape bloc = new RoundRectangle2D.Double(-44, -18, 30, 10, 6, 6);
            Shape corps = new RoundRectangle2D.Double(-50, -9, 42, 18, 9, 9);
            Shape tete = new Ellipse2D.Double(-9, -10, 20, 20);
            for (Shape forme : new Shape[] {bloc, corps, tete}) {
                g.setColor(forme == tete ? Color.WHITE : fond);
                g.fill(forme);
                g.setColor(trait);
                g.draw(forme);
            }
            g.draw(new Line2D.Double(-50, -4, -82, -7));
            g.draw(new Line2D.Double(-50, 4, -82, 7));
            for (int sens : new int[] {-1, 1}) {
                Path2D palme = new Path2D.Double();
                palme.moveTo(-82, sens * 3);
                palme.lineTo(-82, sens * 10);
                palme.lineTo(-98, sens * 15);
                palme.closePath();
                g.setColor(fond);
                g.fill(palme);
                g.setColor(trait);
                g.draw(palme);
            }
            g.setTransform(avant);
        }

        /** L'élève face à un équipier gris qu'il tient : assistance. */
        void paire(double x, double y, double echelle) {
            plongeur(x - 14 * echelle, y, -90, false, echelle);
            plongeur(x + 14 * echelle, y, -90, true, echelle);
        }

        void blocFlottant(double x, double y) {
            g.setStroke(new BasicStroke(2.2f));
            Shape gilet = new RoundRectangle2D.Double(x - 30, y - 12, 60, 24, 12, 12);
            g.setColor(BLEU_CLAIR);
            g.fill(gilet);
            g.setColor(BLEU);
            g.draw(gilet);
            Shape bloc = new RoundRectangle2D.Double(x - 24, y + 8, 48, 12, 6, 6);
            g.setColor(Color.WHITE);
            g.fill(bloc);
            g.setColor(BLEU);
            g.draw(bloc);
        }

        void octopus(double x1, double y1, double x2, double y2) {
            g.setColor(JAUNE);
            g.setStroke(new BasicStroke(3.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            boolean vertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
            double cx = vertical ? Math.max(x1, x2) + 28 : (x1 + x2) / 2;
            double cy = vertical ? (y1 + y2) / 2 : y1 + 40;
            g.draw(new QuadCurve2D.Double(x1, y1, cx, cy, x2, y2));
            g.fill(new Ellipse2D.Double(x2 - 6, y2 - 6, 12, 12));
        }

        // ---------- Décor ----------

        void quai(double x1, double x2, double yHaut) {
            g.setColor(GRIS_CLAIR);
            g.fill(new Rectangle2D.Double(x1, yHaut, x2 - x1, BAS - yHaut));
            g.setColor(GRIS_TRAIT);
            g.setStroke(new BasicStroke(4));
            g.draw(new Line2D.Double(x1, yHaut, x2, yHaut));
        }

        void echelle(double x, double yHaut, double yBas) {
            g.setColor(GRIS_TRAIT);
            g.setStroke(new BasicStroke(3));
            g.draw(new Line2D.Double(x - 14, yHaut, x - 14, yBas));
            g.draw(new Line2D.Double(x + 14, yHaut, x + 14, yBas));
            for (double yy = yHaut + 20; yy < yBas; yy += 34) g.draw(new Line2D.Double(x - 14, yy, x + 14, yy));
        }

        void bateau(double x1, double x2, double ySurface) {
            Path2D coque = new Path2D.Double();
            coque.moveTo(x1, ySurface - 42);
            coque.lineTo(x2, ySurface - 42);
            coque.lineTo(x2 - 25, ySurface + 14);
            coque.lineTo(x1 + 18, ySurface + 14);
            coque.closePath();
            g.setColor(GRIS_CLAIR);
            g.fill(coque);
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(2.2f));
            g.draw(coque);
        }

        void bout(double x, double yHaut, double yBas) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(2));
            g.draw(new Line2D.Double(x, yHaut, x, yBas - 12));
            g.setColor(CORAIL);
            g.fill(new Ellipse2D.Double(x - 10, yHaut - 12, 20, 16));
            g.setColor(GRIS);
            g.fill(new Rectangle2D.Double(x - 10, yBas - 14, 20, 12));
        }

        /** Parachute à la surface, relié au point (xMain, yMain). */
        void parachute(double x, double ySurface, double xMain, double yMain) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(1.8f));
            g.draw(new Line2D.Double(xMain, yMain, x, ySurface + 22));
            g.setColor(CORAIL);
            g.fill(new RoundRectangle2D.Double(x - 8, ySurface - 26, 16, 50, 14, 14));
            g.setColor(TEXTE_DOUX);
            g.draw(new Ellipse2D.Double(xMain - 6, yMain - 6, 12, 12));
        }

        void paroi(double x) {
            Path2D roche = new Path2D.Double();
            roche.moveTo(x, HAUT);
            double[] creux = {0, 18, 6, 24, 4, 16, 10, 0};
            for (int i = 0; i < creux.length; i++) roche.lineTo(x + creux[i], HAUT + i * 37);
            roche.lineTo(L, BAS);
            roche.lineTo(L, HAUT);
            roche.closePath();
            g.setColor(GRIS_CLAIR);
            g.fill(roche);
            g.setColor(GRIS_TRAIT);
            g.setStroke(new BasicStroke(4, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.draw(roche);
        }

        /** Ligne de profondeur à ne pas dépasser, en corail pointillé. */
        void limite(double metres, String libelle) {
            g.setColor(CORAIL);
            g.setStroke(new BasicStroke(2.2f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_ROUND, 1, new float[] {9, 6}, 0));
            g.draw(new Line2D.Double(8, y(metres), L - 80, y(metres)));
            g.setFont(police.deriveFont(15f));
            g.drawString(libelle, 20, (float) y(metres) + 20);
        }

        /** Pavillon alpha (blanc et bleu, à queue d'aronde) sur son mât. */
        void pavillon(double x, double yBas, double yHaut) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(3));
            g.draw(new Line2D.Double(x, yBas, x, yHaut));
            Shape blanc = new Rectangle2D.Double(x, yHaut, 26, 32);
            g.setColor(Color.WHITE);
            g.fill(blanc);
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(1.5f));
            g.draw(blanc);
            Path2D bleu = new Path2D.Double();
            bleu.moveTo(x + 26, yHaut);
            bleu.lineTo(x + 56, yHaut);
            bleu.lineTo(x + 44, yHaut + 16);
            bleu.lineTo(x + 56, yHaut + 32);
            bleu.lineTo(x + 26, yHaut + 32);
            bleu.closePath();
            g.setColor(BLEU);
            g.fill(bleu);
        }

        /** Gorgone posée sur le fond : un éventail de branches corail. */
        void gorgone(double x, double yFond) {
            g.setColor(CORAIL);
            g.setStroke(new BasicStroke(2.4f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g.draw(new Line2D.Double(x, yFond, x, yFond - 22));
            for (double a = -60; a <= 60; a += 20) {
                double r = Math.toRadians(a - 90);
                g.draw(new Line2D.Double(x, yFond - 22, x + 34 * Math.cos(r), yFond - 22 + 34 * Math.sin(r)));
            }
        }

        void cerceauAuSol(double x) {
            g.setColor(GRIS_TRAIT);
            g.setStroke(new BasicStroke(3));
            g.draw(new Ellipse2D.Double(x - 60, 308, 120, 20));
        }

        void cerceauDebout(double x, double y) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(4));
            g.draw(new Ellipse2D.Double(x - 18, y - 50, 36, 100));
        }

        void plot(double x, String libelle) {
            g.setColor(GRIS);
            g.fill(new Rectangle2D.Double(x - 8, 300, 16, 18));
            texte(x - 25, 295, libelle);
        }

        void point(double x, double y, String libelle) {
            g.setColor(CORAIL);
            g.fill(new Ellipse2D.Double(x - 8, y - 8, 16, 16));
            texte(x - 30, y + 35, libelle);
        }

        void roche(double x, double y, String nom) {
            g.setColor(GRIS_CLAIR);
            g.fill(new Ellipse2D.Double(x - 22, y - 16, 44, 32));
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(2));
            g.draw(new Ellipse2D.Double(x - 22, y - 16, 44, 32));
            g.setFont(policeGrasse.deriveFont(Font.BOLD, 15f));
            g.drawString(nom, (float) x - 5, (float) y + 6);
        }

        void carte(double x, double y, String texte) {
            g.setColor(Color.WHITE);
            g.fill(new RoundRectangle2D.Double(x, y, 80, 40, 6, 6));
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(2));
            g.draw(new RoundRectangle2D.Double(x, y, 80, 40, 6, 6));
            g.setColor(TEXTE);
            g.setFont(policeGrasse.deriveFont(Font.BOLD, 15f));
            g.drawString(texte, (float) x + 10, (float) y + 26);
        }

        void bulles(double x, double y) {
            g.setColor(BLEU);
            g.setStroke(new BasicStroke(1.5f));
            g.draw(new Ellipse2D.Double(x, y, 7, 7));
            g.draw(new Ellipse2D.Double(x + 6, y - 14, 9, 9));
            g.draw(new Ellipse2D.Double(x - 2, y - 30, 6, 6));
        }

        void cadre(double x, double y, double l, double h, String libelle) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(1.6f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_ROUND, 1, new float[] {6, 5}, 0));
            g.draw(new RoundRectangle2D.Double(x, y, l, h, 12, 12));
            texteDoux((float) x + 10, (float) y - 8, libelle);
        }

        // ---------- Flèches et textes ----------

        void fleche(double x1, double y1, double x2, double y2, boolean pointille) {
            trait(pointille);
            g.draw(new Line2D.Double(x1, y1, x2, y2));
            pointe(x2, y2, Math.atan2(y2 - y1, x2 - x1));
        }

        void courbe(double x1, double y1, double cx, double cy, double x2, double y2, boolean pointille) {
            trait(pointille);
            g.draw(new QuadCurve2D.Double(x1, y1, cx, cy, x2, y2));
            pointe(x2, y2, Math.atan2(y2 - cy, x2 - cx));
        }

        /** Trajectoire brisée : x1, y1, x2, y2, … ; pointe au bout. */
        void chemin(boolean pointille, double... points) {
            trait(pointille);
            Path2D p = new Path2D.Double();
            p.moveTo(points[0], points[1]);
            for (int i = 2; i < points.length; i += 2) p.lineTo(points[i], points[i + 1]);
            g.draw(p);
            int n = points.length;
            pointe(points[n - 2], points[n - 1], Math.atan2(points[n - 1] - points[n - 3], points[n - 2] - points[n - 4]));
        }

        /** Cote : double flèche et sa mesure. */
        void cote(double x1, double y1, double x2, double y2, String mesure) {
            g.setColor(GRIS);
            g.setStroke(new BasicStroke(1.6f));
            g.draw(new Line2D.Double(x1, y1, x2, y2));
            double a = Math.atan2(y2 - y1, x2 - x1);
            pointe(x2, y2, a);
            pointe(x1, y1, a + Math.PI);
            g.setColor(TEXTE_DOUX);
            g.setFont(police.deriveFont(15f));
            if (x1 == x2) g.drawString(mesure, (float) x1 + 10, (float) (y1 + y2) / 2 + 5);
            else g.drawString(mesure, (float) ((x1 + x2) / 2 - mesure.length() * 3.5), (float) y1 - 8);
        }

        void trait(boolean pointille) {
            g.setColor(GRIS);
            g.setStroke(pointille
                    ? new BasicStroke(2, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND, 1, new float[] {7, 7}, 0)
                    : new BasicStroke(2.2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        }

        void pointe(double x, double y, double angle) {
            Path2D p = new Path2D.Double();
            p.moveTo(x, y);
            p.lineTo(x - 13 * Math.cos(angle - 0.42), y - 13 * Math.sin(angle - 0.42));
            p.lineTo(x - 13 * Math.cos(angle + 0.42), y - 13 * Math.sin(angle + 0.42));
            p.closePath();
            g.setColor(GRIS);
            g.fill(p);
        }

        void texte(double x, double y, String s) {
            texteDoux((float) x, (float) y, s);
        }

        void texteDoux(float x, float y, String s) {
            g.setColor(TEXTE_DOUX);
            g.setFont(police.deriveFont(15f));
            g.drawString(s, x, y);
        }

        /** Bulle de texte (consigne, signe). */
        void etiquette(double x, double y, String s) {
            g.setFont(police.deriveFont(15f));
            double l = g.getFontMetrics().stringWidth(s) + 20;
            Shape bulle = new RoundRectangle2D.Double(x, y, l, 30, 14, 14);
            g.setColor(Color.WHITE);
            g.fill(bulle);
            g.setColor(GRIS_TRAIT);
            g.setStroke(new BasicStroke(1.6f));
            g.draw(bulle);
            g.setColor(TEXTE);
            g.drawString(s, (float) x + 10, (float) y + 20);
        }

        static String entier(double m) {
            return m == Math.rint(m) ? String.valueOf((int) m) : String.valueOf(m).replace('.', ',');
        }
    }
}
