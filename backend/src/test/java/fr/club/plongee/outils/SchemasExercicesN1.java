package fr.club.plongee.outils;

import fr.club.plongee.outils.SchemasExercicesN2.Schema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Outil, pas un test : dessine les schémas des exercices du N1 PE20 que le
 * document du club n'illustrait pas (compétences 9 et 10 entières, et les
 * autres exercices sans schéma), avec les éléments de dessin du N2
 * ({@link SchemasExercicesN2.Schema}). Les 29 schémas du document restent
 * ceux de V53.
 *
 * <p>Ignoré par {@code mvn test} ; lancement à la demande, depuis {@code backend/} :
 * {@code mvn test -Dtest=SchemasExercicesN1 -Dschemas.n1=src/main/resources/db/schemas/n1}
 *
 * <p>Les images produites sont chargées en base par la migration
 * V66__schemas_exercices_n1_complements ; une fois celle-ci appliquée, les
 * schémas se remplacent depuis /admin/exercices et non en relançant cet outil.
 */
class SchemasExercicesN1 {

    @Test
    @EnabledIfSystemProperty(named = "schemas.n1", matches = ".+")
    void generer() throws Exception {
        System.setProperty("java.awt.headless", "true");
        SchemasExercicesN2.chargerPolices();
        SchemasExercicesN2.ecrire(schemas(), new File(System.getProperty("schemas.n1")));
    }

    static List<Schema> schemas() {
        List<Schema> liste = new ArrayList<>();
        Schema s;

        // ---------- 1. S'équiper et se déséquiper ----------
        s = new Schema("1.3", "Sécurité et hygiène du matériel");
        s.quai(8, 642, 300);
        s.blocAuSol(170, 300, true);
        s.plongeur(225, 196, -90, true, 0.95);
        s.etiquette(100, 92, "debout = tenu");
        s.coche(250, 108);
        s.blocAuSol(430, 300, false);
        s.etiquette(370, 200, "sinon couché");
        s.coche(530, 216);
        s.legende("Bloc debout = bloc tenu, sinon couché ; porté à deux mains.",
                "Rinçage, embout désinfecté, anomalie signalée au moniteur.");
        liste.add(s);

        s = new Schema("1.6", "Équipement en conditions réelles");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(150, 168, -90, true, 0.85);
        s.plongeur(250, 168, -90, true, 0.85);
        s.plongeur(470, 168, -90, false, 0.85);
        s.etiquette(330, 96, "DP : « prêts dans 5 min »");
        s.cadre(105, 150, 190, 108, "binôme");
        s.legende("Espace réduit, matériel rangé : gréage et vérification croisée,",
                "prêt à l'heure donnée par le DP, sans rappel.");
        liste.add(s);

        s = new Schema("1.7", "Gréage avec anomalie cachée");
        s.quai(8, 642, 300);
        s.blocAuSol(200, 300, true);
        s.etiquette(250, 96, "robinet fermé ?");
        s.etiquette(250, 146, "inflateur débranché ?");
        s.etiquette(250, 196, "joint absent ?");
        s.plongeur(520, 196, -90, false, 0.95);
        s.texte(470, 108, "observe");
        s.legende("Le moniteur cache une anomalie : robinet, inflateur ou joint.",
                "L'élève grée seul et la signale avant la mise à l'eau.");
        liste.add(s);

        s = new Schema("1.8", "Déséquipement et rééquipement en surface");
        s.eau(180, 0);
        s.plongeur(170, 186, -90, true, 0.8);
        s.blocFlottant(300, 182);
        s.plongeur(430, 186, -90, false, 0.8);
        s.fleche(330, 205, 405, 205, true);
        s.courbe(410, 240, 330, 300, 200, 250, true);
        s.texte(150, 140, "1. décapelage");
        s.texte(360, 140, "2. bloc passé");
        s.texte(230, 322, "3. récupéré, recapelage");
        s.legende("Grand fond, gilet gonflé : une main reste toujours sur le gilet.",
                "Le bloc passe à l'équipier, revient, puis recapelage sans aide.");
        liste.add(s);

        s = new Schema("1.9", "Matériel personnel et lestage adapté");
        s.eau(170, 0);
        s.plongeur(170, 175, -90, true, 0.85);
        s.etiquette(60, 96, "eau de mer : + 1 à 2 kg");
        s.plongeur(470, 175, -90, true, 0.85);
        s.etiquette(360, 96, "combinaison plus épaisse : + lest");
        s.carnet(220, 230, 200, "Carnet : 6 kg, 7 mm,", "mer, bloc 12 L");
        s.legende("Lestage ajusté à chaque changement d'eau ou de combinaison,",
                "vérifié par le test en surface, noté au carnet.");
        liste.add(s);

        // ---------- 2. Se mettre à l'eau et sortir de l'eau ----------
        s = new Schema("2.1", "Entrées en PMT");
        s.eau(200, 0);
        s.quai(8, 190, 170);
        s.nageur(110, 104, -90, true, 0.75);
        s.courbe(140, 110, 220, 120, 240, 205, false);
        s.texte(200, 105, "saut droit");
        s.nageur(330, 205, -90, true, 0.75);
        s.etiquette(360, 160, "signe OK");
        s.texte(250, 310, "puis bascule arrière, accroupi au bord");
        s.legende("Saut droit puis bascule arrière depuis le bord, en PMT.",
                "Masque tenu, signe OK aussitôt en surface.");
        liste.add(s);

        s = new Schema("2.4", "Entrées depuis une hauteur réelle");
        s.eau(220, 0);
        s.quai(8, 170, 130);
        s.plongeur(100, 62 + 40, -90, true, 0.6);
        s.courbe(125, 100, 220, 90, 240, 225, false);
        s.cote(185, 130, 185, 220, "hauteur");
        s.plongeur(380, 226, -90, true, 0.7);
        s.plongeur(430, 226, -90, true, 0.7);
        s.point(520, 222, "");
        s.cadre(345, 205, 200, 90, "regroupement");
        s.legende("Bascule depuis un plot, saut depuis une barge ou un plongeoir bas.",
                "Regroupement immédiat au point désigné.");
        liste.add(s);

        s = new Schema("2.7", "Mise à l'eau sur consignes du DP");
        s.eau(180, 0);
        s.bateau(30, 260, 180);
        s.plongeur(110, 110, -90, false, 0.55);
        s.etiquette(370, 96, "DP : « palanquée 1, à l'eau »");
        s.plongeur(225, 110, -90, true, 0.55);
        s.courbe(245, 105, 310, 110, 315, 200, false);
        s.plongeur(420, 188, -90, false, 0.7);
        s.plongeur(470, 188, -90, true, 0.7);
        s.plongeur(520, 188, -90, true, 0.7);
        s.cadre(390, 160, 165, 110, "palanquée 1");
        s.legende("Briefing du DP, palanquées constituées, ordre de passage.",
                "Chacun entre à son tour, technique imposée, sans rappel.");
        liste.add(s);

        s = new Schema("2.8", "Mise à l'eau avec contrainte");
        s.eau(180, 0);
        s.bateau(30, 230, 180);
        s.bout(440, 180, 330);
        s.plongeur(400, 190, -90, true, 0.7);
        s.plongeur(480, 190, -90, true, 0.7);
        s.plongeur(300, 190, -90, false, 0.7);
        s.fleche(250, 300, 560, 300, true);
        s.texte(380, 290, "courant simulé");
        s.etiquette(380, 110, "regroupement à la bouée");
        s.legende("Entrée rapide à l'annonce, palanquée après palanquée,",
                "regroupement immédiat au bout, comme face à un courant.");
        liste.add(s);

        s = new Schema("2.9", "Sortie complète en fin de plongée");
        s.eau(200, 0);
        s.bateau(400, 642, 200);
        s.echelle(420, 150, 320);
        s.plongeur(370, 208, -90, true, 0.7);
        s.blocFlottant(300, 205);
        s.plongeur(520, 110, -90, false, 0.5);
        s.courbe(300, 190, 360, 100, 495, 120, true);
        s.texte(90, 150, "1. tour d'horizon");
        s.texte(90, 250, "2. lest, puis bloc passés");
        s.texte(90, 290, "3. palmes, montée, zone dégagée");
        s.legende("Lest puis bloc passés, palmes retirées en tenant l'échelle,",
                "montée, puis attente hors de l'axe de l'échelle.");
        liste.add(s);

        // ---------- 3. S'immerger ----------
        s = new Schema("3.1", "Équilibrage des oreilles");
        s.echelleProfondeur(110, 80);
        s.eau(110, s.y(2.6));
        s.bout(330, 110, s.y(2.6));
        s.nageur(300, s.y(1.4), 90, true, 0.8);
        s.etiquette(380, 140, "Valsalva doux dès 1 m");
        s.etiquette(380, 210, "gêne : remonter un peu");
        s.reperes(1, 2);
        s.legende("En PMT, le long d'un bout jusqu'à 2 m : équilibrer tôt,",
                "à chaque gêne ; jamais forcer, on remonte si ça bloque.");
        liste.add(s);

        s = new Schema("3.4", "Canard en scaphandre");
        s.eau(130, 330);
        s.plongeur(300, 205, 90, true, 0.9);
        s.fleche(370, 140, 370, 300, true);
        s.texte(390, 170, "jambes hors de l'eau");
        s.texte(390, 250, "glisse, puis palmage");
        s.croix(70, 112);
        s.texte(90, 117, "moulinet en surface");
        s.legende("Gilet vidé, buste plié, jambes à la verticale hors de l'eau :",
                "la glisse immerge, on palme seulement ensuite.");
        liste.add(s);

        s = new Schema("3.5", "Phoque sans repère et arrêt à 3 m");
        s.echelleProfondeur(110, 50);
        s.eau(110, s.y(4.2));
        s.bande(2, 4, "± 1 m");
        s.plongeur(200, 120, -90, true, 0.7);
        s.fleche(250, 140, 250, s.y(2.6), true);
        s.plongeur(420, s.y(3), 0, true, 0.8);
        s.etiquette(330, 120, "profondeur lue sur l'instrument");
        s.reperes(3, 4);
        s.legende("Pleine eau, sans bout : descente en phoque,",
                "arrêt et stabilisation à 3 m, à ± 1 m.");
        liste.add(s);

        s = new Schema("3.6", "Phoque ou canard sur consigne");
        s.eau(130, 320);
        s.plongeur(110, 138, -90, false, 0.7);
        s.etiquette(30, 86, "« phoque ! »");
        s.plongeur(280, 190, -90, true, 0.75);
        s.fleche(320, 150, 320, 290, true);
        s.plongeur(460, 210, 90, true, 0.75);
        s.fleche(500, 150, 500, 290, true);
        s.etiquette(420, 86, "« canard ! »");
        s.legende("Le moniteur annonce la technique en surface, au hasard ;",
                "l'élève s'immerge, revient, et l'on alterne.");
        liste.add(s);

        s = new Schema("3.8", "Enchaînement mise à l'eau et immersion");
        s.eau(180, 330);
        s.quai(8, 150, 150);
        s.plongeur(95, 84, -90, true, 0.55);
        s.courbe(115, 90, 180, 95, 190, 175, false);
        s.plongeur(260, 188, -90, true, 0.6);
        s.plongeur(340, 188, -90, false, 0.6);
        s.etiquette(300, 100, "signe « descendre »");
        s.fleche(450, 200, 450, 290, true);
        s.plongeur(570, 260, 0, true, 0.55);
        s.texte(165, 305, "1 entrée · 2 regroupement · 3 signe · 4 immersion");
        s.legende("Bascule ou saut, regroupement, signe du GP,",
                "immersion sans attendre : un enchaînement fluide.");
        liste.add(s);

        s = new Schema("3.9", "Descente en milieu naturel");
        s.echelleProfondeur(110, 10);
        s.eau(110, s.y(20));
        s.bateau(30, 230, 110);
        s.bout(240, 110, s.y(20));
        s.plongeur(300, s.y(9), -90, false, 0.6);
        s.plongeur(350, s.y(10), -90, true, 0.6);
        s.plongeur(395, s.y(9.5), -90, true, 0.6);
        s.fleche(450, s.y(4), 450, s.y(16), true);
        s.texte(465, s.y(10), "lentement");
        s.reperes(5, 10, 20);
        s.legende("Le long du mouillage, derrière le GP, palanquée groupée :",
                "oreilles équilibrées, arrêt au moindre signe de gêne.");
        liste.add(s);

        // ---------- 4. Se propulser ----------
        s = new Schema("4.1", "Le geste au bord");
        s.eau(180, 0);
        s.quai(8, 160, 150);
        s.nageur(178, 182, 180, true, 1);
        s.courbe(290, 160, 320, 140, 330, 165, false);
        s.courbe(290, 205, 320, 225, 330, 200, false);
        s.etiquette(340, 100, "jambes tendues, depuis la hanche");
        s.croix(420, 275);
        s.texte(440, 280, "« vélo »");
        s.legende("Accroché au bord : jambes tendues, mouvement depuis la hanche,",
                "chevilles souples, palmes sous la surface.");
        liste.add(s);

        s = new Schema("4.4", "Costal et enchaînement sur 100 m");
        s.vueDeDessus();
        s.trait(false);
        s.g.drawLine(60, 120, 590, 120);
        s.g.drawLine(60, 300, 590, 300);
        s.chemin(true, 80, 160, 560, 160, 560, 210, 80, 210, 80, 260, 560, 260);
        s.texte(260, 150, "ventral");
        s.texte(260, 200, "dorsal");
        s.texte(260, 250, "costal");
        s.texte(70, 320, "une position par longueur, 100 m");
        s.legende("Ajout du palmage costal, bras en avant pour l'équilibre,",
                "puis 100 m en changeant de position à chaque longueur.");
        liste.add(s);

        s = new Schema("4.7", "Parcours de surface en PMT");
        s.eau(170, 0);
        s.nageur(170, 172, 0, true, 0.75);
        s.fleche(190, 165, 330, 165, true);
        s.nageur(380, 172, 180, true, 0.75);
        s.texte(150, 140, "~100 m, positions variées");
        s.nageur(520, 175, -90, true, 0.85);
        s.etiquette(440, 96, "1 min mains hors de l'eau");
        s.legende("Environ 100 m en changeant de position,",
                "terminé par 1 min de sustentation mains hors de l'eau.");
        liste.add(s);

        s = new Schema("4.8", "Retour au bateau en capelé");
        s.eau(180, 0);
        s.bateau(470, 642, 180);
        s.plongeur(120, 182, 180, true, 0.8);
        s.fleche(210, 200, 450, 200, true);
        s.cote(140, 130, 450, 130, "50 m environ");
        s.etiquette(160, 250, "à l'arrivée : l'élève peut parler");
        s.legende("Environ 50 m en scaphandre vers un point désigné,",
                "léger effort, ventilation contrôlée à l'arrivée.");
        liste.add(s);

        s = new Schema("4.9", "Exploration derrière le GP");
        s.eau(80, 320);
        s.gorgone(160, 320);
        s.gorgone(470, 320);
        s.plongeur(430, 200, 0, false, 0.85);
        s.plongeur(300, 225, 0, true, 0.85);
        s.cote(310, 170, 420, 170, "moins de 2 m");
        s.fleche(450, 260, 600, 260, true);
        s.legende("Milieu naturel : l'élève suit le GP, profondeur et distance tenues,",
                "palmage sans contact avec le fond.");
        liste.add(s);

        // ---------- 5. Se ventiler ----------
        s = new Schema("5.7", "Gestes en pleine eau et en déplacement");
        s.eau(80, 0);
        s.plongeur(480, 190, 0, false, 0.85);
        s.plongeur(300, 210, 0, true, 0.85);
        s.bulles(310, 160);
        s.etiquette(160, 110, "vidage de masque, reprise d'embout");
        s.fleche(330, 260, 560, 260, true);
        s.texte(360, 290, "sans arrêter la palanquée");
        s.legende("Vidage de masque et lâcher-reprise d'embout stabilisé en pleine eau,",
                "puis en palmant derrière le moniteur.");
        liste.add(s);

        s = new Schema("5.8", "Ventilation sous effort modéré");
        s.eau(80, 0);
        s.plongeur(300, 210, 0, true, 0.9);
        s.plongeur(335, 210, 180, false, 0.9);
        s.texte(270, 265, "retenu par le gilet");
        s.fleche(560, 150, 420, 150, true);
        s.texte(440, 140, "résistance");
        s.etiquette(120, 110, "puis arrêt, expiration longue");
        s.legende("Le moniteur retient l'élève par le gilet : palmage contre résistance,",
                "puis récupération ; rythme retrouvé, aucun essoufflement.");
        liste.add(s);

        s = new Schema("5.9", "Demandes du GP au cours d'une évolution");
        s.eau(80, 0);
        s.chemin(true, 80, 230, 560, 230);
        s.plongeur(520, 210, 0, false, 0.75);
        s.plongeur(400, 225, 0, true, 0.75);
        s.etiquette(90, 110, "VDM");
        s.etiquette(220, 140, "reprise d'embout");
        s.etiquette(400, 110, "apnée courte");
        s.legende("En évolution, le GP demande un vidage, une reprise d'embout,",
                "une courte apnée, à des moments variés : réponse sereine.");
        liste.add(s);

        // ---------- 6. S'équilibrer ----------
        s = new Schema("6.1", "Flottabilité positive, négative, neutre");
        s.eau(120, 320);
        s.plongeur(150, 122, -90, true, 0.65);
        s.texte(100, 250, "positive");
        s.fleche(150, 240, 150, 200, false);
        s.plongeur(320, 210, 0, true, 0.75);
        s.texte(270, 270, "neutre");
        s.plongeur(520, 252, -90, true, 0.65);
        s.texte(470, 140, "négative");
        s.fleche(520, 150, 520, 200, false);
        s.legende("Gilet vide ou gonflé, poumons pleins ou vides : l'élève ressent",
                "et nomme les trois états, puis les relie à la ventilation.");
        liste.add(s);

        s = new Schema("6.4", "Gilet en pleine eau");
        s.echelleProfondeur(110, 40);
        s.eau(110, 0);
        s.bande(3, 5, "± 1 m");
        s.plongeur(340, s.y(4), 0, true, 1);
        s.etiquette(130, 118, "pas de repère : instrument");
        s.reperes(4);
        s.legende("Sans bout ni repère : petites injections, attendre, affiner",
                "au poumon ballast ; 1 min à ± 1 m.");
        liste.add(s);

        s = new Schema("6.7", "Équilibre à la demande");
        s.echelleProfondeur(105, 35);
        s.eau(105, 0);
        s.bande(2, 4, "± 1 m");
        s.bande(4.5, 6.5, "± 1 m");
        s.plongeur(160, s.y(4.2), 0, false, 0.7);
        s.etiquette(100, 112, "« 5 m »");
        s.chemin(true, 250, 120, 280, s.y(3), 340, s.y(3), 380, s.y(5.5), 470, s.y(5.5));
        s.plongeur(330, s.y(3), 0, true, 0.6);
        s.plongeur(460, s.y(5.5), 0, true, 0.6);
        s.reperes(3, 5);
        s.legende("Le GP indique une profondeur, l'élève s'y stabilise seul ;",
                "on répète à plusieurs profondeurs, chaque arrêt à ± 1 m.");
        liste.add(s);

        s = new Schema("6.8", "Stabilisation en palanquée");
        s.echelleProfondeur(110, 40);
        s.eau(110, 0);
        s.bande(2, 4, "palier");
        s.plongeur(220, s.y(3) - 30, 0, true, 0.75);
        s.plongeur(230, s.y(3) + 5, 0, true, 0.75);
        s.plongeur(220, s.y(3) + 40, 0, true, 0.75);
        s.plongeur(400, s.y(3), 180, false, 0.75);
        s.texte(380, s.y(3) + 60, "GP");
        s.reperes(3);
        s.legende("Palier simulé à 3 m, sans repère, élèves côte à côte face au GP :",
                "± 1 m tenu sans gêner les équipiers.");
        liste.add(s);

        s = new Schema("6.9", "Exploration avec variations de profondeur");
        s.echelleProfondeur(110, 11);
        s.eau(110, 0);
        s.relief(8, 260, 150, 240, 250, 290, 360, 300, 450, 220, 560, 200, 642, 230);
        s.chemin(true, 60, 200, 160, 190, 260, 245, 360, 255, 450, 175, 560, 160);
        s.plongeur(250, 238, 20, true, 0.6);
        s.plongeur(450, 168, -20, true, 0.6);
        s.texte(150, 140, "injecter en descendant, purger en remontant");
        s.reperes(10, 15);
        s.legende("Milieu naturel, parcours qui monte et descend :",
                "l'élève ajuste son gilet seul, ni contact ni palmage forcé.");
        liste.add(s);

        // ---------- 7. Respecter le milieu et l'environnement ----------
        s = new Schema("7.1", "Charte, impacts et dangers du milieu");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 260, "Charte du plongeur :", "je regarde, je ne touche pas", "je ne nourris pas",
                "je ne prélève rien");
        s.carnet(340, 96, 260, "Dangers du milieu :", "froid, courant", "faune piquante, urticante",
                "bateaux en surface");
        s.gorgone(320, 300);
        s.legende("Au bord, 15 min : la Charte du plongeur responsable,",
                "l'impact sur la faune et le fond, le froid et les dangers.");
        liste.add(s);

        s = new Schema("7.3", "Palmage qui ne touche pas le fond");
        s.eau(80, 320);
        s.plongeur(400, 262, 12, true, 1);
        s.etiquette(160, 120, "palmes au-dessus du buste");
        s.coche(250, 300);
        s.texte(270, 305, "aucun nuage de sédiment");
        s.fleche(440, 220, 600, 220, true);
        s.texte(430, 205, "grenouille ou réduit");
        s.legende("Près du fond : tête un peu plus basse que les palmes,",
                "palmage en grenouille ou réduit, aucun choc sur le fond.");
        liste.add(s);

        s = new Schema("7.4", "Stabilisation au-dessus d'un fond de sable");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.plongeur(360, s.y(6) - 32, 0, true, 1);
        s.cote(470, s.y(6) - 28, 470, s.y(6) - 2, "50 cm");
        s.fleche(380, s.y(6) - 75, 560, s.y(6) - 75, true);
        s.texte(400, s.y(6) - 85, "puis déplacement lent");
        s.reperes(3, 6);
        s.legende("Milieu naturel, 6 m environ : stabilisé à 50 cm du sable,",
                "puis déplacement lent, aucun nuage derrière l'élève.");
        liste.add(s);

        s = new Schema("7.6", "Reconnaissance et carnet");
        s.quai(8, 642, 310);
        s.carnet(60, 100, 250, "Vu aujourd'hui :", "sar, girelle, poulpe", "posidonie");
        s.carnet(340, 100, 250, "À éviter :", "vive (piquante)", "méduse (urticante)");
        s.legende("Après la plongée : espèces vues et espèces à risque du site,",
                "identifiées puis notées au carnet de plongée.");
        liste.add(s);

        s = new Schema("7.7", "Plongée d'exploration évaluée");
        s.eau(80, 320);
        s.rocher(470, 320, 160, 70);
        s.gorgone(470, 250);
        s.plongeur(330, 210, 0, true, 0.85);
        s.plongeur(170, 170, 0, false, 0.75);
        s.texte(110, 135, "le GP observe");
        s.etiquette(250, 100, "ni appui, ni contact, distance");
        s.legende("Le GP observe l'élève sur toute la plongée :",
                "appuis, contacts et distance à la faune.");
        liste.add(s);

        s = new Schema("7.8", "Évolution près d'un tombant ou d'un herbier");
        s.eau(80, 0);
        s.paroi(520);
        s.gorgone(530, 250);
        s.plongeur(405, 180, 0, true, 1);
        s.cote(418, 230, 515, 230, "1 m");
        s.fleche(380, 210, 380, 310, true);
        s.texte(200, 260, "le long de la zone fragile");
        s.legende("Le long d'un tombant ou d'un herbier : stabilisation adaptée,",
                "un mètre au moins, attention aux palmes au demi-tour.");
        liste.add(s);

        s = new Schema("7.9", "Débriefing et comportement sur site");
        s.eau(260, 0);
        s.bateau(40, 600, 260);
        s.plongeur(170, 140, -90, true, 0.8);
        s.plongeur(280, 140, -90, false, 0.8);
        s.etiquette(330, 92, "déchets rapportés");
        s.etiquette(330, 136, "matériel rangé");
        s.etiquette(330, 180, "pas d'ancre sur l'herbier");
        s.legende("L'élève raconte sa plongée et évalue son impact ;",
                "sur le site : déchets, matériel et zones protégées respectés.");
        liste.add(s);

        // ---------- 8. Communiquer ----------
        s = new Schema("8.2", "Signes en surface");
        s.eau(180, 0);
        s.quai(8, 140, 150);
        s.plongeur(80, 100, -90, false, 0.5);
        s.nageur(300, 186, -90, true, 0.8);
        s.etiquette(210, 100, "OK : bras en couronne");
        s.nageur(500, 186, -90, true, 0.8);
        s.etiquette(420, 100, "à l'aide : bras agité");
        s.legende("Dans l'eau : OK de surface visible de loin, appel à l'aide ;",
                "réponse immédiate et juste aux signes du moniteur.");
        liste.add(s);

        s = new Schema("8.3", "Signes en immersion statique");
        s.echelleProfondeur(110, 60);
        s.eau(110, s.y(3.4));
        s.plongeur(220, Schema.teteAuFond(s.y(3.4), 0.85), -90, false, 0.85);
        s.plongeur(420, Schema.teteAuFond(s.y(3.4), 0.85), -90, true, 0.85);
        s.etiquette(110, 120, "signe");
        s.etiquette(380, 120, "même signe, puis réponse");
        s.reperes(3);
        s.legende("À 3 m, face à face : le moniteur fait un signe, l'élève",
                "le reproduit puis donne la réponse attendue.");
        liste.add(s);

        s = new Schema("8.5", "Communication dans la palanquée");
        s.eau(80, 0);
        s.plongeur(150, 210, 0, false, 0.8);
        s.plongeur(330, 210, 0, true, 0.8);
        s.plongeur(510, 210, 0, true, 0.8);
        s.fleche(170, 170, 250, 170, false);
        s.fleche(350, 170, 430, 170, false);
        s.etiquette(160, 110, "signe");
        s.etiquette(330, 110, "transmis");
        s.etiquette(480, 260, "réaction");
        s.legende("Un élève reçoit un signe du moniteur et le transmet",
                "à son équipier, qui réagit : sans déformation.");
        liste.add(s);

        s = new Schema("8.7", "Évaluation de la compréhension");
        s.eau(80, 0);
        s.plongeur(220, 210, 0, false, 0.9);
        s.plongeur(450, 210, 180, true, 0.9);
        s.carnet(40, 96, 230, "10 signes, au hasard :", "OK, monter, descendre…");
        s.etiquette(370, 120, "réponse ou réaction");
        s.fleche(240, 270, 560, 270, true);
        s.texte(300, 300, "en statique, puis en déplacement");
        s.legende("Le GP fait les 10 signes dans un ordre aléatoire ;",
                "l'élève répond ou réagit à chacun.");
        liste.add(s);

        s = new Schema("8.8", "Évaluation de la réalisation");
        s.eau(80, 0);
        s.plongeur(470, 200, 0, false, 0.85);
        s.plongeur(300, 220, 0, true, 0.85);
        s.carte(150, 120, "100 bar");
        s.etiquette(250, 110, "« mi-pression ! »");
        s.fleche(320, 270, 560, 270, true);
        s.legende("Au cours d'une plongée, l'élève annonce de lui-même",
                "mi-pression, réserve ou froid, au bon moment.");
        liste.add(s);

        s = new Schema("8.9", "Communication en situation d'incident");
        s.eau(80, 0);
        s.plongeur(250, 210, 0, true, 1);
        s.etiquette(130, 120, "signe : panne d'air");
        s.plongeur(400, 210, 180, false, 1);
        s.octopus(375, 214, 268, 212);
        s.texte(380, 270, "GP");
        s.legende("Scénario annoncé au briefing : l'élève signale une panne d'air",
                "ou un essoufflement, puis suit la procédure du GP.");
        liste.add(s);

        // ---------- « 9 » du document : Retourner en surface ----------
        s = new Schema("9.1", "Comprendre la remontée");
        s.echelleProfondeur(110, 20);
        s.eau(110, 0);
        s.ballon(260, s.y(10), 20, "2 bars : 1 L");
        s.ballon(260, 150, 30, "1 bar : 2 L");
        s.fleche(220, s.y(9), 220, 175, false);
        s.etiquette(390, 200, "ne jamais bloquer sa respiration");
        s.reperes(10);
        s.legende("Entre 10 m et la surface, le volume d'air double :",
                "on expire en remontant, on ne bloque jamais sa respiration.");
        liste.add(s);

        s = new Schema("9.2", "Remontée contrôlée avec repère");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bout(320, 110, s.y(6));
        s.plongeur(295, s.y(4), -90, true, 0.6);
        s.fleche(250, s.y(5.5), 250, 130, true);
        s.plongeur(400, s.y(4), -90, false, 0.6);
        s.etiquette(380, 120, "regard vers la surface");
        s.etiquette(380, 160, "main sur la purge");
        s.reperes(3, 6);
        s.legende("Le long d'un bout de 6 m, moniteur en face : palmage doux,",
                "purges courtes et régulières, sans accélérer près de la surface.");
        liste.add(s);

        s = new Schema("9.3", "Tour d'horizon et gonflage du gilet");
        s.eau(190, 0);
        s.plongeur(300, 236, -90, true, 0.8);
        s.etiquette(30, 250, "1. bras levé, tour sur soi");
        s.courbe(250, 210, 300, 180, 350, 210, false);
        s.plongeur(450, 190, -90, true, 0.8);
        s.etiquette(390, 110, "2. gilet gonflé, signe OK");
        s.legende("Dans les derniers mètres : bras levé, tour complet sur soi ;",
                "en surface : gilet gonflé, puis signe OK.");
        liste.add(s);

        s = new Schema("9.4", "Remontée sans repère");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, 0);
        s.plongeur(300, s.y(4.5), -90, true, 0.65);
        s.fleche(250, s.y(6), 250, 130, true);
        s.bulles(330, s.y(3));
        s.bulles(345, s.y(2));
        s.plongeur(400, s.y(4.5), -90, false, 0.65);
        s.etiquette(370, 120, "vitesse : ordinateur ou petites bulles");
        s.reperes(3, 6);
        s.legende("Pleine eau, sans repère visuel : vitesse contrôlée",
                "sur l'ordinateur ou les plus petites bulles.");
        liste.add(s);

        s = new Schema("9.5", "Palier en pleine eau");
        s.echelleProfondeur(110, 30);
        s.eau(110, 0);
        s.bande(2, 4, "± 1 m");
        s.plongeur(330, s.y(3), 0, true, 1);
        s.etiquette(140, 250, "profondeur lue régulièrement");
        s.reperes(3, 6);
        s.legende("Palier simulé à 3 m, sans bout : profondeur lue sur l'instrument,",
                "± 1 m pendant toute la durée annoncée.");
        liste.add(s);

        s = new Schema("9.6", "REC depuis 2 m puis 4 m");
        s.echelleProfondeur(110, 45);
        s.eau(110, s.y(4.4));
        s.paire(300, Schema.teteAuFond(s.y(4.4), 0.8), 0.8);
        s.fleche(240, Schema.teteAuFond(s.y(4.4), 0.8), 240, 125, true);
        s.bulles(330, 160);
        s.bulles(330, 210);
        s.etiquette(380, 140, "« ouuu » : expiration continue");
        s.texte(370, 260, "mains sur ses sangles");
        s.reperes(2, 4);
        s.legende("Moniteur face à l'élève, mains sur ses sangles : inspiration normale,",
                "départ en palmant, expiration continue et modérée.");
        liste.add(s);

        s = new Schema("9.7", "REC depuis 6 m");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.plongeur(290, Schema.teteAuFond(s.y(6), 0.8), -90, true, 0.8);
        s.fleche(250, Schema.teteAuFond(s.y(6), 0.8), 250, 125, true);
        s.bulles(270, 150);
        s.bulles(270, 200);
        s.plongeur(400, s.y(3), -90, false, 0.8);
        s.texte(380, 150, "encadrant à côté");
        s.reperes(3, 6);
        s.legende("Départ du fond, 6 m au plus, inspiration normale, expiration",
                "continue, tour d'horizon ; aucun critère de temps.");
        liste.add(s);

        s = new Schema("9.8", "Remontée complète en palanquée");
        s.echelleProfondeur(140, 30);
        s.eau(140, 0);
        s.bande(2.5, 3.5, "palier");
        s.bateau(470, 642, 140);
        s.plongeur(200, s.y(3), 0, false, 0.7);
        s.plongeur(290, s.y(3) - 18, 0, true, 0.7);
        s.plongeur(300, s.y(3) + 18, 0, true, 0.7);
        s.fleche(340, s.y(3), 410, 160, true);
        s.texte(150, 125, "tour d'horizon, OK au bateau");
        s.reperes(3, 6);
        s.legende("Signe du GP, remontée groupée, palier simulé,",
                "tour d'horizon, gilet gonflé, OK au bateau.");
        liste.add(s);

        s = new Schema("9.9", "Perte de palanquée");
        s.echelleProfondeur(110, 25);
        s.eau(110, s.y(8));
        s.rocher(470, s.y(8), 180, 110);
        s.plongeur(520, s.y(8) - 40, 0, false, 0.6);
        s.plongeur(250, s.y(6.5), 0, true, 0.7);
        s.etiquette(100, 210, "recherche brève, sans descendre");
        s.fleche(250, s.y(5.5), 250, 125, true);
        s.etiquette(270, 120, "remontée contrôlée, signal en surface");
        s.reperes(3, 8);
        s.legende("Procédure briefée : l'élève cherche brièvement, remonte seul",
                "à vitesse contrôlée et se signale en surface.");
        liste.add(s);

        // ---------- « 10 » du document : Évoluer en sécurité ----------
        s = new Schema("10.1", "Procédures au sec");
        s.quai(8, 642, 310);
        s.plongeur(180, 206, -90, false, 0.95);
        s.octopus(200, 230, 260, 250);
        s.texte(270, 255, "octopus du GP");
        s.plongeur(450, 206, -90, true, 0.95);
        s.etiquette(300, 92, "panne d'air · essoufflement · froid");
        s.etiquette(330, 140, "perte de palanquée : la règle");
        s.legende("Au bord : signes et procédures, emplacement de l'octopus du GP,",
                "tenue par le gilet, règle en cas de perte de palanquée.");
        liste.add(s);

        s = new Schema("10.2", "Panne d'air en statique");
        s.echelleProfondeur(110, 60);
        s.eau(110, s.y(3.4));
        s.plongeur(240, Schema.teteAuFond(s.y(3.4), 0.85), -90, false, 0.85);
        s.plongeur(390, Schema.teteAuFond(s.y(3.4), 0.85), -90, true, 0.85);
        s.octopus(255, 245, 378, 230);
        s.etiquette(380, 120, "signe : panne d'air");
        s.texte(40, 160, "tenue mutuelle par le gilet");
        s.reperes(3);
        s.legende("À genoux à 3 m : signe « panne d'air », prise de l'octopus",
                "présenté par le moniteur, ventilation calme ensuite.");
        liste.add(s);

        s = new Schema("10.3", "Essoufflement, crampe, malaise");
        s.eau(80, 320);
        s.paire(130, 200, 0.75);
        s.etiquette(30, 100, "essoufflement : arrêt");
        s.texte(40, 300, "expiration longue");
        s.plongeur(340, 230, 0, true, 0.75);
        s.etiquette(240, 140, "crampe : tirer la palme");
        s.plongeur(520, 200, -90, true, 0.75);
        s.etiquette(440, 100, "« ça ne va pas »");
        s.legende("À 3 m, incident annoncé : l'élève fait le bon signe",
                "et accepte l'action du GP, sans s'y opposer.");
        liste.add(s);

        s = new Schema("10.4", "Panne d'air : rejoindre le GP");
        s.echelleProfondeur(110, 40);
        s.eau(110, s.y(4.5));
        s.plongeur(170, s.y(3), 0, true, 0.75);
        s.plongeur(190, s.y(3) + 40, 0, false, 0.65);
        s.texte(60, s.y(3) - 40, "encadrant de sécurité dessous");
        s.fleche(200, s.y(3) - 20, 430, s.y(3) - 20, true);
        s.cote(200, 130, 470, 130, "3 m, puis 6 m, puis 10 m");
        s.plongeur(480, s.y(3), 180, false, 0.75);
        s.texte(470, s.y(3) + 45, "GP");
        s.reperes(3);
        s.legende("Après une expiration normale, l'élève rejoint le GP à l'horizontale,",
                "prend son octopus ; distance augmentée peu à peu.");
        liste.add(s);

        s = new Schema("10.5", "Intervention en relais");
        s.eau(80, 0);
        s.plongeur(250, 210, 0, false, 1);
        s.texte(170, 260, "A");
        s.plongeur(390, 210, 180, true, 1);
        s.octopus(370, 214, 262, 212);
        s.texte(330, 260, "B");
        s.etiquette(150, 120, "A : panne d'air");
        s.etiquette(400, 120, "B alerte le GP");
        s.legende("A signale une panne d'air ; B lui donne son octopus,",
                "le tient par le gilet et alerte le GP.");
        liste.add(s);

        s = new Schema("10.6", "Mi-pression, réserve, froid");
        s.eau(80, 0);
        s.plongeur(300, 220, 0, true, 0.85);
        s.carte(150, 120, "50 bar");
        s.etiquette(250, 110, "« réserve »");
        s.plongeur(470, 200, 180, false, 0.85);
        s.chemin(true, 470, 250, 560, 250, 600, 100);
        s.texte(470, 290, "le GP organise le retour");
        s.legende("Parcours avec cartes-consignes : l'élève signale de lui-même,",
                "le GP organise le retour, la palanquée remonte groupée.");
        liste.add(s);

        s = new Schema("10.7", "Panne d'air sur 10 m");
        s.echelleProfondeur(110, 40);
        s.eau(110, s.y(4.5));
        s.plongeur(140, s.y(3), 0, true, 0.75);
        s.fleche(170, s.y(3) - 20, 420, s.y(3) - 20, true);
        s.cote(170, 130, 470, 130, "10 m à l'horizontale");
        s.plongeur(480, s.y(3), 180, false, 0.75);
        s.texte(470, s.y(3) + 45, "GP");
        s.etiquette(40, 150, "expiration normale, encadrant à côté");
        s.reperes(3);
        s.legende("Apnée expiratoire de 10 m vers le GP, prise de son octopus,",
                "remontée tenue : procédure automatique et sans erreur.");
        liste.add(s);

        s = new Schema("10.8", "Incidents tirés au sort");
        s.eau(80, 0);
        s.plongeur(300, 210, 0, true, 0.9);
        s.plongeur(460, 210, 180, false, 0.9);
        s.etiquette(40, 100, "essoufflement");
        s.etiquette(200, 100, "crampe");
        s.etiquette(320, 100, "malaise");
        s.etiquette(60, 280, "froid");
        s.etiquette(460, 280, "réserve");
        s.legende("Plusieurs incidents dans la même séance, en statique",
                "et en déplacement : bonne réaction à chacun, calme gardé.");
        liste.add(s);

        s = new Schema("10.9", "Scénario de palanquée");
        s.eau(80, 0);
        s.plongeur(220, 200, 0, false, 0.85);
        s.texte(140, 250, "équipier en difficulté");
        s.plongeur(360, 205, 180, true, 0.85);
        s.octopus(345, 208, 230, 205);
        s.plongeur(530, 170, 180, false, 0.75);
        s.texte(520, 215, "GP");
        s.etiquette(380, 100, "élève : air, puis appel au GP");
        s.legende("Un équipier signale une difficulté : l'élève apporte de l'air",
                "ou de l'aide, puis sollicite le GP.");
        liste.add(s);

        return liste;
    }
}
