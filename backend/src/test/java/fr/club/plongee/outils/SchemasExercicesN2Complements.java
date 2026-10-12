package fr.club.plongee.outils;

import fr.club.plongee.outils.SchemasExercicesN2.Schema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.awt.Color;
import java.awt.geom.Rectangle2D;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Outil, pas un test : dessine les schémas des 68 exercices du N2 PA20 | PE40
 * que {@link SchemasExercicesN2} n'illustrait pas, pour que chaque exercice
 * ait le sien, avec les mêmes éléments de dessin.
 *
 * <p>Ignoré par {@code mvn test} ; lancement à la demande, depuis {@code backend/} :
 * {@code mvn test -Dtest=SchemasExercicesN2Complements -Dschemas.n2c=src/main/resources/db/schemas/n2}
 *
 * <p>Les images produites sont chargées en base par la migration
 * V68__schemas_exercices_n2_complements ; une fois celle-ci appliquée, les
 * schémas se remplacent depuis /admin/exercices et non en relançant cet outil.
 */
class SchemasExercicesN2Complements {

    @Test
    @EnabledIfSystemProperty(named = "schemas.n2c", matches = ".+")
    void generer() throws Exception {
        System.setProperty("java.awt.headless", "true");
        SchemasExercicesN2.chargerPolices();
        SchemasExercicesN2.ecrire(schemas(), new File(System.getProperty("schemas.n2c")));
    }

    /** Zone de visibilité réduite : un voile gris sur une partie de l'eau. */
    static void voile(Schema s, double x, double y, double l, double h, String libelle) {
        s.g.setColor(new Color(0x8E, 0x8C, 0x84, 60));
        s.g.fill(new Rectangle2D.Double(x, y, l, h));
        s.texte(x + 10, y + 22, libelle);
    }

    static List<Schema> schemas() {
        List<Schema> liste = new ArrayList<>();
        Schema s;

        // ---------- 1. S'équiper - se mettre à l'eau et en sortir ----------
        s = new Schema("1.1", "Choisir et gréer son matériel");
        s.quai(8, 642, 300);
        s.carnet(40, 96, 230, "Plongée annoncée :", "20 m, 40 min", "eau à 16 °C");
        s.blocAuSol(360, 300, true);
        s.plongeur(420, 196, -90, true, 0.95);
        s.etiquette(450, 96, "combinaison 7 mm");
        s.etiquette(450, 140, "octopus, ordinateur");
        s.etiquette(450, 184, "parachute");
        s.legende("Matériel choisi selon la plongée annoncée, gréé seul,",
                "contrôlé par le moniteur ; rinçage et embout désinfecté après.");
        liste.add(s);

        s = new Schema("1.2", "Capelage et réglages en surface");
        s.eau(180, 0);
        s.plongeur(240, 186, -90, true, 0.85);
        s.plongeur(400, 186, -90, true, 0.85);
        s.etiquette(130, 96, "air ouvert · gilet · lest · octopus · ordinateur");
        s.texte(250, 320, "vérification croisée");
        s.legende("Capelage, sangles et lest réglés, inflateur et purges essayés,",
                "puis vérification croisée complète avec l'équipier.");
        liste.add(s);

        s = new Schema("1.4", "S'équiper en temps limité");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(140, 168, -90, true, 0.85);
        s.plongeur(240, 168, -90, true, 0.85);
        s.plongeur(340, 168, -90, true, 0.85);
        s.plongeur(500, 168, -90, false, 0.85);
        s.etiquette(380, 96, "DP : « à l'eau dans 10 min »");
        s.cadre(95, 150, 290, 108, "chacun vérifie son équipier");
        s.legende("Consignes du DP données : la palanquée s'équipe à l'heure,",
                "et chacun contrôle aussi l'équipement de son équipier.");
        liste.add(s);

        s = new Schema("1.7", "Autonome du gréage à la sortie");
        s.eau(200, 0);
        s.bateau(30, 300, 200);
        s.plongeur(120, 132, -90, true, 0.6);
        s.plongeur(250, 132, -90, false, 0.5);
        s.texte(50, 100, "1. gréer, contrôler l'équipier");
        s.courbe(140, 128, 340, 120, 360, 220, false);
        s.plongeur(400, 210, -90, true, 0.7);
        s.texte(380, 160, "2. mise à l'eau");
        s.echelle(290, 160, 320);
        s.texte(330, 310, "3. sortie, déséquipement, rangement");
        s.legende("Sur une plongée réelle, l'élève fait tout seul, du gréage au rangement ;",
                "le moniteur observe sans intervenir.");
        liste.add(s);

        s = new Schema("1.8", "Anomalie sur le matériel de la palanquée");
        s.quai(8, 642, 300);
        s.blocAuSol(140, 300, true);
        s.blocAuSol(220, 300, true);
        s.etiquette(270, 96, "robinet entrouvert ?");
        s.etiquette(270, 146, "inflateur débranché ?");
        s.etiquette(270, 196, "sangle mal fermée ?");
        s.plongeur(540, 196, -90, false, 0.95);
        s.texte(500, 108, "observe");
        s.legende("Une anomalie glissée dans le matériel de l'élève ou de l'équipier :",
                "trouvée et corrigée avant la mise à l'eau.");
        liste.add(s);

        s = new Schema("1.9", "Mises à l'eau et sorties en milieux variés");
        s.eau(200, 0);
        s.quai(8, 150, 170);
        s.plongeur(90, 104, -90, true, 0.55);
        s.texte(30, 160, "bord");
        s.bateau(220, 380, 200);
        s.plongeur(330, 130, -90, true, 0.5);
        s.texte(270, 245, "embarcation");
        s.relief(430, 330, 642, 190);
        s.plongeur(560, 206, -90, true, 0.55);
        s.texte(480, 300, "plage");
        s.legende("Sur au moins deux sites différents : technique choisie",
                "selon le lieu et les conditions, avec le souci de la palanquée.");
        liste.add(s);

        // ---------- 2. S'immerger - se propulser - se ventiler ----------
        s = new Schema("2.2", "Palmages de surface");
        s.vueDeDessus();
        s.trait(false);
        s.g.drawLine(60, 120, 590, 120);
        s.g.drawLine(60, 300, 590, 300);
        s.chemin(true, 80, 160, 560, 160, 560, 210, 80, 210, 80, 260, 560, 260);
        s.texte(260, 150, "ventral");
        s.texte(260, 200, "dorsal");
        s.texte(260, 250, "costal");
        s.texte(70, 320, "en PMT puis capelé, 100 à 200 m");
        s.legende("Palmage ventral, dorsal et costal, en PMT puis capelé,",
                "à allure régulière, sans chronomètre.");
        liste.add(s);

        s = new Schema("2.5", "Palmage économique en immersion");
        s.echelleProfondeur(110, 11);
        s.eau(110, 0);
        s.relief(8, 300, 200, 290, 380, 270, 642, 290);
        s.plongeur(330, 245, 0, true, 0.8);
        s.fleche(600, 150, 420, 150, true);
        s.texte(450, 140, "léger courant");
        s.etiquette(60, 130, "palmage lent et ample, près du fond");
        s.reperes(10, 15);
        s.legende("Parcours à 10-20 m, puis contre un léger courant :",
                "l'élève règle son allure sur sa ventilation, sans s'essouffler.");
        liste.add(s);

        s = new Schema("2.6", "REC depuis 10 m le long d'un bout");
        s.echelleProfondeur(110, 20);
        s.eau(110, s.y(10));
        s.bout(330, 110, s.y(10));
        s.plongeur(295, Schema.teteAuFond(s.y(10), 0.8), -90, true, 0.8);
        s.fleche(250, Schema.teteAuFond(s.y(10), 0.8), 250, 125, true);
        s.bulles(270, 160);
        s.bulles(270, 210);
        s.plongeur(410, s.y(6), -90, false, 0.8);
        s.texte(380, 160, "moniteur en face");
        s.reperes(5, 10);
        s.legende("Départ du fond stabilisé à 10 m, inspiration normale,",
                "rejet d'air tout au long ; en fosse, la note va à l'entraînement.");
        liste.add(s);

        s = new Schema("2.7", "Immersion et descente sur consigne du GP");
        s.echelleProfondeur(110, 10);
        s.eau(110, s.y(20));
        s.bateau(30, 200, 110);
        s.bout(220, 110, s.y(20));
        s.plongeur(300, 112, -90, false, 0.55);
        s.plongeur(350, 112, -90, true, 0.55);
        s.plongeur(400, 112, -90, true, 0.55);
        s.etiquette(420, 84, "GP : « phoque »");
        s.fleche(450, 180, 450, s.y(18), true);
        s.plongeur(380, s.y(18), 0, true, 0.55);
        s.plongeur(330, s.y(19), 0, true, 0.55);
        s.reperes(10, 20);
        s.legende("Technique annoncée par le GP, immersion ensemble,",
                "descente équilibrée jusqu'au fond, cohésion gardée.");
        liste.add(s);

        s = new Schema("2.8", "Nages de surface : 250 m PMT, 100 m capelé");
        s.eau(180, 0);
        s.nageur(150, 182, 0, true, 0.75);
        s.fleche(170, 175, 330, 175, true);
        s.texte(150, 150, "250 m en PMT");
        s.plongeur(450, 182, 0, true, 0.75);
        s.fleche(470, 175, 600, 175, true);
        s.texte(430, 150, "puis 100 m capelé");
        s.etiquette(160, 250, "pas de chronomètre : arrivée en forme");
        s.legende("Milieu naturel : 250 m environ en PMT, puis 100 m capelé ;",
                "on évalue l'efficacité des gestes, pas le temps.");
        liste.add(s);

        // ---------- 3. Respecter le milieu et l'environnement ----------
        s = new Schema("3.2", "Palmer sans soulever le sable");
        s.eau(80, 320);
        s.plongeur(400, 230, 12, true, 1);
        s.cote(470, 250, 470, 318, "1 m");
        s.etiquette(130, 110, "palmes hautes, grenouille ou recul");
        s.coche(200, 300);
        s.texte(220, 305, "aucun nuage derrière l'élève");
        s.legende("À 1 m d'un fond sableux : palmage de grenouille et recul,",
                "palmes hautes, sans soulever le moindre sédiment.");
        liste.add(s);

        s = new Schema("3.3", "Charte et espèces du site");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 260, "Charte du plongeur :", "ne pas toucher, ne pas nourrir", "éclairage limité, discrétion");
        s.carnet(340, 96, 260, "Espèces du site :", "sar, girelle, poulpe,", "castagnole, étoile de mer");
        s.gorgone(320, 300);
        s.legende("Au sec : la Charte internationale du plongeur responsable",
                "et les espèces courantes du site, avec fiches ou photos.");
        liste.add(s);

        s = new Schema("3.5", "Observer sans déranger");
        s.eau(80, 320);
        s.rocher(470, 320, 170, 70);
        s.gorgone(470, 250);
        s.plongeur(330, 200, 0, true, 0.85);
        s.plongeur(250, 250, 0, true, 0.75);
        s.etiquette(60, 110, "lampe à côté de l'animal, pas dessus");
        s.cote(345, 175, 430, 175, "distance");
        s.legende("L'élève cherche et montre 5 espèces à son équipier,",
                "sans les toucher ni les poursuivre.");
        liste.add(s);

        s = new Schema("3.7", "Plongée d'observation");
        s.eau(110, 320);
        s.rocher(160, 320, 160, 60);
        s.gorgone(160, 260);
        s.rocher(500, 320, 180, 80);
        s.gorgone(470, 240);
        s.plongeur(380, 200, 0, true, 0.7);
        s.plongeur(330, 230, 0, true, 0.7);
        s.chemin(true, 80, 180, 260, 190, 560, 180);
        s.etiquette(380, 70 + 50, "en surface : 5 espèces nommées");
        s.legende("Plongée consacrée à l'observation, sans contact ;",
                "en surface, l'élève nomme et décrit les espèces vues.");
        liste.add(s);

        s = new Schema("3.8", "Plongée dans un milieu fragile");
        s.echelleProfondeur(110, 11);
        s.eau(110, s.y(18));
        s.bande(2.5, 3.5, "palier");
        for (int x = 60; x < 560; x += 70) s.gorgone(x, s.y(18));
        s.plongeur(300, s.y(11.5), 0, true, 0.75);
        s.plongeur(450, s.y(3), 0, true, 0.6);
        s.etiquette(330, 160, "au fond comme au palier");
        s.reperes(3, 10);
        s.legende("Herbier, coralligène ou fond vaseux : évolution sur toute la plongée,",
                "sans dégradation ni nuage de sédiment, palier compris.");
        liste.add(s);

        s = new Schema("3.9", "Comportement sur toutes les plongées");
        s.eau(80, 320);
        s.carnet(40, 100, 260, "Observé à chaque plongée :", "discrétion", "ni nourrissage ni prélèvement",
                "éclairage limité");
        s.coche(320, 154);
        s.coche(320, 178);
        s.coche(320, 202);
        s.plongeur(500, 230, 0, true, 0.85);
        s.gorgone(560, 320);
        s.legende("Tout au long de la formation, le moniteur observe le comportement ;",
                "bilan au débriefing.");
        liste.add(s);

        // ---------- 4. Être attentif au matériel de ses équipiers ----------
        s = new Schema("4.1", "Le détendeur expliqué");
        s.quai(8, 642, 320);
        s.blocAuSol(90, 320, true);
        s.carnet(140, 150, 180, "1er étage :", "détente à moyenne", "pression");
        s.trait(false);
        s.g.drawLine(110, 225, 140, 225);
        s.g.drawLine(320, 200, 380, 200);
        s.carnet(380, 150, 220, "2e étage :", "à la demande", "(asservissement)");
        s.etiquette(250, 96, "débit continu : causes et réaction");
        s.legende("Au sec, sur un détendeur ou un schéma : premier et second étage,",
                "détente, asservissement, débit continu et ses causes.");
        liste.add(s);

        s = new Schema("4.3", "Présenter son matériel");
        s.quai(8, 642, 300);
        s.plongeur(200, 196, -90, true, 0.95);
        s.plongeur(450, 196, -90, true, 0.95);
        s.etiquette(250, 96, "ordinateur : réglages");
        s.etiquette(250, 136, "inflateur, purges");
        s.etiquette(250, 176, "octopus : où ?");
        s.etiquette(250, 216, "manomètre");
        s.legende("Chacun présente son matériel à son équipier :",
                "ordinateur, gilet, emplacement de l'octopus, manomètre.");
        liste.add(s);

        s = new Schema("4.4", "Découvrir le matériel d'un autre");
        s.quai(8, 642, 300);
        s.blocAuSol(180, 300, true);
        s.etiquette(230, 96, "purges ?");
        s.etiquette(230, 140, "inflateur ?");
        s.etiquette(230, 184, "octopus ?");
        s.etiquette(360, 140, "ordinateur ?");
        s.plongeur(530, 196, -90, true, 0.95);
        s.legende("Avec un matériel inconnu : purges, inflateur, octopus,",
                "manomètre et ordinateur trouvés et compris sans aide.");
        liste.add(s);

        s = new Schema("4.5", "Contrôles avant l'immersion");
        s.eau(180, 0);
        s.plongeur(200, 186, -90, true, 0.8);
        s.plongeur(320, 186, -90, true, 0.8);
        s.plongeur(440, 186, -90, true, 0.8);
        s.etiquette(130, 96, "air · gilet · octopus · ordinateur · lest");
        s.texte(190, 320, "toute anomalie annoncée à la palanquée");
        s.legende("En surface, avant l'immersion : contrôle croisé sans rappel,",
                "et toute anomalie annoncée aux équipiers.");
        liste.add(s);

        s = new Schema("4.6", "Matériel obligatoire en autonomie");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 300, "En plongée autonome :", "moyen de désaturation", "gilet, détendeur de secours",
                "contrôle de la pression", "parachute de palanquée");
        s.blocAuSol(440, 310, true);
        s.blocAuSol(520, 310, true);
        s.etiquette(400, 110, "que manque-t-il ?");
        s.legende("Au sec : l'élève vérifie le matériel obligatoire en autonomie",
                "sur le matériel de la palanquée et dit ce qui manque.");
        liste.add(s);

        s = new Schema("4.7", "Briefing matériel de la palanquée");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(160, 168, -90, true, 0.85);
        s.plongeur(260, 168, -90, true, 0.85);
        s.plongeur(360, 168, -90, true, 0.85);
        s.etiquette(380, 92, "ton ordinateur ? ton octopus ?");
        s.etiquette(380, 136, "pression ? gilet ?");
        s.legende("Avant une plongée en autonomie, chacun présente son matériel",
                "et se renseigne sur celui de ses équipiers, spontanément.");
        liste.add(s);

        s = new Schema("4.9", "Restituer le fonctionnement du détendeur");
        s.quai(8, 642, 310);
        s.plongeur(140, 206, -90, true, 0.95);
        s.etiquette(200, 96, "détente, asservissement");
        s.etiquette(200, 140, "différences entre les modèles");
        s.blocAuSol(470, 310, true);
        s.blocAuSol(540, 310, true);
        s.texte(430, 200, "matériel des équipiers");
        s.legende("Oral au bord, avec le matériel des équipiers : détente,",
                "asservissement et différences entre les modèles.");
        liste.add(s);

        // ---------- 5. Évoluer en autonomie ----------
        s = new Schema("5.1", "Lire son ordinateur");
        s.vueDeDessus();
        s.ordinateur(70, 110, "18,4 m   max 21,0", "0:32   sans palier 8'", "remontée 3'");
        s.etiquette(290, 110, "profondeur, durée");
        s.etiquette(290, 154, "durée sans palier, paliers");
        s.etiquette(290, 198, "indicateur de vitesse, alarmes");
        s.etiquette(290, 242, "planification, carnet, conservatisme");
        s.legende("Au sec : chaque affichage lu et expliqué sur son propre ordinateur,",
                "puis le mode planification et le réglage du conservatisme.");
        liste.add(s);

        s = new Schema("5.2", "Ordinateurs différents dans la palanquée");
        s.vueDeDessus();
        s.ordinateur(60, 120, "PLAN 20 m", "sans palier 14'");
        s.ordinateur(330, 120, "PLAN 20 m", "sans palier 9'");
        s.coche(560, 150);
        s.texte(300, 270, "la palanquée suit le plus conservateur");
        s.legende("On compare les ordinateurs en mode planification :",
                "la palanquée suit le plus conservateur.");
        liste.add(s);

        s = new Schema("5.4", "Autonomie surveillée");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.limite(20, "20 m au plus");
        s.plongeur(380, s.y(14), 0, true, 0.7);
        s.plongeur(400, s.y(16), 0, true, 0.7);
        s.plongeur(160, s.y(11), 0, false, 0.6);
        s.texte(70, s.y(11) - 25, "moniteur en retrait");
        s.fleche(420, s.y(15), 580, s.y(15), true);
        s.reperes(10, 20);
        s.legende("Binôme ou trinôme autonome, moniteur en retrait :",
                "paramètres et équipiers contrôlés, communication constante.");
        liste.add(s);

        s = new Schema("5.6", "Problème de table");
        s.quai(8, 642, 320);
        s.carnet(60, 96, 300, "Plongée simple à l'air :", "profondeur, durée", "donnent paliers et remontée",
                "puis raisonnement expliqué");
        s.carnet(400, 96, 200, "Pas au N2 :", "lecture inverse", "altitude, mélanges");
        s.legende("Au sec : un problème simple de table fédérale,",
                "dans le cadre du MFT, raisonnement expliqué.");
        liste.add(s);

        s = new Schema("5.7", "Plongée en autonomie");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.bateau(30, 200, 110);
        s.limite(20, "20 m au plus");
        s.bande(2.5, 3.5, "palier");
        s.chemin(true, 210, 130, 250, s.y(17), 450, s.y(17), 510, s.y(3), 560, s.y(3));
        s.plongeur(380, s.y(17), 0, true, 0.6);
        s.plongeur(330, s.y(18.2), 0, true, 0.6);
        s.plongeur(220, s.y(12), 0, false, 0.5);
        s.texte(70, s.y(12) + 40, "moniteur observateur");
        s.reperes(3, 10, 20);
        s.legende("Palanquée de 2 ou 3 autonomes, 0 à 20 m, moniteur observateur :",
                "consignes du DP, vitesse, paliers et cohésion.");
        liste.add(s);

        s = new Schema("5.9", "Autonomie en conditions variées");
        s.eau(80, 320);
        voile(s, 330, 80, 304, 240, "visibilité réduite");
        s.plongeur(250, 200, 0, true, 0.75);
        s.plongeur(270, 240, 0, true, 0.75);
        s.fleche(600, 300, 420, 300, true);
        s.texte(440, 290, "courant");
        s.etiquette(40, 110, "site nouveau : que faites-vous si… ?");
        s.legende("Visibilité réduite, courant, site nouveau : désaturation partagée",
                "dans la palanquée, décisions adaptées.");
        liste.add(s);

        // ---------- 6. Planifier la plongée ----------
        s = new Schema("6.1", "Comprendre les consignes du DP");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 300, "Consignes du DP :", "20 m maximum, 45 min", "retour à 50 bar",
                "remontée totale 10 min au plus");
        s.plongeur(470, 206, -90, true, 0.95);
        s.etiquette(400, 100, "je reformule");
        s.legende("À partir d'un briefing de DP, l'élève reformule profondeur,",
                "durée, pression de retour, paliers et durée de remontée.");
        liste.add(s);

        s = new Schema("6.2", "Le compas à terre");
        s.vueDeDessus();
        s.compas(140, 200, 60);
        s.point(280, 200, "départ");
        s.fleche(300, 185, 560, 185, true);
        s.fleche(560, 215, 300, 215, true);
        s.texte(360, 175, "aller : cap");
        s.texte(330, 245, "retour : cap inverse");
        s.cote(280, 290, 560, 290, "20 à 30 m à pied");
        s.legende("Réglage d'un cap, visée bras tendu, compas à plat,",
                "aller-retour à pied jusqu'au point de départ.");
        liste.add(s);

        s = new Schema("6.3", "Calculer sa consommation");
        s.vueDeDessus();
        s.carnet(60, 100, 330, "En surface : 20 L/min", "À 20 m (3 bar) : 60 L/min", "Bloc de 12 L : 5 bar/min",
                "Réserve de sécurité gardée");
        s.ballon(500, 160, 22, "");
        s.ballon(500, 250, 38, "");
        s.texte(440, 125, "air respiré par minute :");
        s.texte(530, 165, "en surface");
        s.texte(545, 255, "à 20 m");
        s.legende("Consommation en litres et en bars par minute, au fond et au palier,",
                "réserve de sécurité : des calculs pour comprendre.");
        liste.add(s);

        s = new Schema("6.4", "Briefing de palanquée");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(160, 168, -90, true, 0.85);
        s.plongeur(260, 168, -90, true, 0.85);
        s.plongeur(360, 168, -90, true, 0.85);
        s.etiquette(380, 88, "profil dans le cadre du DP");
        s.etiquette(380, 132, "ordinateurs comparés");
        s.etiquette(380, 176, "annonces à 100 et 50 bar");
        s.legende("La palanquée fixe son profil, compare ses ordinateurs",
                "et décide du contrôle des consommations.");
        liste.add(s);

        s = new Schema("6.6", "Repères du site");
        s.vueDeDessus();
        s.point(110, 150, "mouillage");
        s.roche(300, 120, "A");
        s.roche(470, 230, "B");
        s.trait(false);
        s.g.drawLine(560, 100, 600, 320);
        s.texte(510, 300, "tombant");
        s.texte(260, 165, "12 m");
        s.texte(430, 275, "18 m");
        s.chemin(true, 125, 145, 285, 120, 455, 220, 130, 162);
        s.legende("Sur la carte ou le croquis du site : mouillage, tombant, roches,",
                "profondeurs ; puis repères reconnus sous l'eau.");
        liste.add(s);

        s = new Schema("6.7", "Proposer une planification");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.chemin(false, 40, 112, 120, s.y(18), 360, s.y(18), 460, s.y(3), 540, s.y(3), 560, 112);
        s.texte(40, s.y(10), "descente");
        s.texte(170, s.y(18) - 12, "évolution, annonces 100 / 50 bar");
        s.texte(400, s.y(11), "retour");
        s.texte(470, s.y(3) + 32, "palier, sortie");
        s.reperes(3, 10, 20);
        s.legende("L'élève présente la planification et les procédures de chaque étape :",
                "descente, évolution, consommations, retour, palier, sortie.");
        liste.add(s);

        s = new Schema("6.9", "Plongée planifiée en autonomie");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.chemin(true, 40, 112, 120, s.y(18), 360, s.y(18), 460, s.y(3), 540, s.y(3), 560, 112);
        s.chemin(false, 40, 112, 130, s.y(19), 340, s.y(17.5), 470, s.y(3), 550, s.y(3), 570, 112);
        s.texte(200, s.y(19) + 30, "pointillé : prévu · trait plein : réalisé");
        s.reperes(3, 10, 20);
        s.legende("La palanquée réalise la plongée qu'elle a planifiée :",
                "profondeur, durée, pression de retour ; écarts débriefés.");
        liste.add(s);

        // ---------- 7. Intervenir et porter assistance ----------
        s = new Schema("7.1", "Reconnaître une difficulté");
        s.eau(80, 320);
        s.plongeur(170, 200, -90, false, 0.75);
        s.bulles(190, 150);
        s.bulles(200, 120);
        s.etiquette(60, 280, "ventilation rapide");
        s.plongeur(330, 200, -90, false, 0.75);
        s.etiquette(285, 280, "agitation");
        s.plongeur(490, 200, -90, false, 0.75);
        s.bulles(510, 150);
        s.bulles(520, 110);
        s.bulles(500, 130);
        s.etiquette(435, 280, "débit continu");
        s.legende("Signes conventionnels rappelés, puis situations simulées sans signe :",
                "ventilation anormale, agitation, inconscience, débit continu.");
        liste.add(s);

        s = new Schema("7.3", "Passage d'octopus et remontée");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.paire(300, Schema.teteAuFond(s.y(6), 0.85), 0.85);
        s.octopus(300, 220, 285, 200);
        s.fleche(240, Schema.teteAuFond(s.y(6), 0.85), 240, 125, true);
        s.etiquette(360, 130, "octopus donné, puis tenue au gilet");
        s.reperes(3, 6);
        s.legende("Panne d'air simulée : l'élève donne son octopus,",
                "tient l'assisté par le gilet et remonte avec lui.");
        liste.add(s);

        s = new Schema("7.5", "Intervention en évolution");
        s.eau(80, 0);
        s.chemin(true, 60, 230, 320, 230);
        s.plongeur(250, 225, 0, true, 0.8);
        s.plongeur(450, 220, -90, false, 0.8);
        s.etiquette(400, 120, "difficulté en plein déplacement");
        s.fleche(270, 260, 420, 260, false);
        s.texte(60, 305, "rejoindre, stabiliser, prendre en charge");
        s.legende("La difficulté survient pendant le déplacement : l'élève rejoint",
                "l'équipier, le stabilise et le prend en charge, sans brutalité.");
        liste.add(s);

        s = new Schema("7.6", "En surface jusqu'à la sortie");
        s.eau(180, 0);
        s.bateau(470, 642, 180);
        s.plongeur(170, 182, 0, false, 0.8);
        s.plongeur(240, 182, 0, true, 0.8);
        s.fleche(260, 210, 450, 210, true);
        s.etiquette(60, 96, "gilets gonflés, signe de détresse");
        s.texte(260, 250, "remorquage jusqu'au bateau");
        s.legende("En surface : gilets gonflés, signe de détresse, remorquage",
                "jusqu'au bateau ou au bord, aide au déséquipement.");
        liste.add(s);

        s = new Schema("7.8", "Seconde situation : panne d'air");
        s.echelleProfondeur(100, 10);
        s.eau(100, s.y(20));
        s.bande(3, 5, "arrêt marqué");
        s.bateau(520, 642, 100);
        s.paire(130, Schema.teteAuFond(s.y(20), 0.7), 0.7);
        s.octopus(130, s.y(17), 120, s.y(15.6));
        s.chemin(true, 170, s.y(18), 290, s.y(4), 360, s.y(4), 430, 108);
        s.paire(320, s.y(4) - 10, 0.7);
        s.paire(470, 112, 0.7);
        s.reperes(3, 5, 10, 20);
        s.legende("Panne d'air simulée : passage de l'octopus, remontée assistée,",
                "arrêt marqué, jusqu'à la sortie de l'eau.");
        liste.add(s);

        s = new Schema("7.9", "Étude de cas d'accidents");
        s.vueDeDessus();
        s.carnet(40, 100, 270, "Pour chaque cas :", "causes", "symptômes", "prévention", "conduite à tenir");
        s.carnet(340, 100, 270, "Désaturation :", "facteurs favorisants", "profils à risque",
                "plongée de réadaptation");
        s.legende("Oral, à partir de cas pratiques : causes, symptômes, prévention",
                "et conduite à tenir pour chaque accident.");
        liste.add(s);

        // ---------- 8. Se ventiler - s'équilibrer ----------
        s = new Schema("8.1", "Passages tuba-embout et lâcher d'embout");
        s.eau(170, 320);
        s.plongeur(170, 176, 0, true, 0.75);
        s.etiquette(60, 96, "surface : tuba, puis embout");
        s.plongeur(420, 260, 0, true, 0.75);
        s.bulles(440, 220);
        s.etiquette(330, 120, "immersion : lâcher-reprise d'embout");
        s.legende("Passage tuba-embout en surface, lâcher et reprise d'embout",
                "en immersion, expiration à la remontée.");
        liste.add(s);

        s = new Schema("8.3", "Stabilisation au poumon ballast");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bande(2.5, 4.5, "± 1 m");
        s.plongeur(330, s.y(3.5), 0, true, 1);
        s.fleche(400, s.y(3.3), 400, s.y(2.6), false);
        s.fleche(430, s.y(3.7), 430, s.y(4.4), false);
        s.texte(450, s.y(2.8), "inspirer : monter");
        s.texte(450, s.y(4.4), "expirer : descendre");
        s.reperes(3, 6);
        s.legende("Gilet réglé, palmes immobiles : l'élève monte et descend",
                "d'un mètre au seul poumon ballast, sans apnée.");
        liste.add(s);

        s = new Schema("8.4", "Ventiler à l'effort");
        s.eau(80, 320);
        s.plongeur(300, 210, 0, true, 0.9);
        s.fleche(600, 150, 420, 150, true);
        s.fleche(600, 270, 420, 270, true);
        s.texte(450, 140, "courant");
        s.etiquette(60, 110, "expiration marquée");
        s.etiquette(60, 280, "début d'essoufflement : signalé");
        s.legende("Déplacement soutenu ou contre un léger courant :",
                "ventilation ample, expiration marquée, essoufflement signalé.");
        liste.add(s);

        s = new Schema("8.5", "VDM en pleine eau à 10-15 m");
        s.echelleProfondeur(100, 13);
        s.eau(100, 0);
        s.bande(10, 15, "");
        s.plongeur(320, s.y(12.5), 0, true, 1);
        s.etiquette(220, s.y(12.5) - 90, "VDM complet");
        s.texte(40, s.y(12.5) + 5, "ni descente ni remontée");
        s.reperes(10, 15);
        s.legende("Pleine eau, sans repère, entre 10 et 15 m : VDM complet,",
                "profondeur gardée, puis reprise de l'évolution.");
        liste.add(s);

        s = new Schema("8.8", "Ventilation en profondeur");
        s.echelleProfondeur(100, 5.2);
        s.eau(100, 0);
        s.limite(40, "40 m");
        s.chemin(true, 60, 110, 160, s.y(20), 260, s.y(20), 330, s.y(30), 420, s.y(30), 480, s.y(37), 560, s.y(37));
        s.plongeur(250, s.y(20), 0, true, 0.55);
        s.plongeur(410, s.y(30), 0, true, 0.55);
        s.plongeur(550, s.y(37), 0, true, 0.55);
        s.texte(60, s.y(30), "progressivement, avec un E3");
        s.reperes(20, 30, 40);
        s.legende("Plongée progressive dans l'espace 0-40 m, sous la responsabilité",
                "d'un E3 : ventilation adaptée, lâcher et reprise d'embout.");
        liste.add(s);

        s = new Schema("8.9", "Stable sur toute la plongée");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.chemin(true, 60, 112, 130, s.y(18), 330, s.y(18), 420, s.y(3), 540, s.y(3));
        s.plongeur(200, s.y(18), 0, true, 0.55);
        s.plongeur(380, s.y(10), -30, true, 0.55);
        s.plongeur(520, s.y(3), 0, true, 0.55);
        s.texte(150, s.y(18) + 30, "fond, observation");
        s.texte(400, s.y(13), "remontée");
        s.reperes(3, 10, 20);
        s.legende("Stabilisation sans appui à toutes les étapes :",
                "fond, observation, remontée, palier tenu sans effort.");
        liste.add(s);

        // ---------- 9. Communiquer avec le guide de palanquée ----------
        s = new Schema("9.1", "Tous les signes");
        s.vueDeDessus();
        s.carnet(40, 100, 260, "Révision du N1 :", "OK, monter, descendre", "panne d'air, essoufflement");
        s.carnet(340, 100, 260, "Plongée profonde :", "narcose", "pression, consommation", "paliers");
        s.legende("Au sec : révision des signes du N1 et signes de la plongée",
                "profonde, faits et compris par tous.");
        liste.add(s);

        s = new Schema("9.3", "Briefing avec le GP");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(150, 168, -90, false, 0.85);
        s.plongeur(300, 168, -90, true, 0.85);
        s.plongeur(400, 168, -90, true, 0.85);
        s.etiquette(60, 88, "GP : 20 m, 40 min, annonces à 100 bar");
        s.etiquette(440, 92, "je reformule");
        s.legende("Le GP donne ses consignes ; l'élève les reformule",
                "et dit ce qu'il annoncera en plongée.");
        liste.add(s);

        s = new Schema("9.5", "Annonces spontanées");
        s.eau(80, 0);
        s.plongeur(480, 200, 0, false, 0.85);
        s.plongeur(300, 220, 0, true, 0.85);
        s.carte(130, 110, "100 bar");
        s.etiquette(230, 110, "« mi-pression »");
        s.etiquette(230, 270, "« un palier apparaît »");
        s.legende("Mi-pression, réserve, palier qui apparaît : l'élève prévient",
                "le GP sans attendre d'être sollicité.");
        liste.add(s);

        s = new Schema("9.6", "Dire son ressenti");
        s.echelleProfondeur(100, 7);
        s.eau(100, 0);
        s.plongeur(300, s.y(30), 0, true, 0.85);
        s.plongeur(450, s.y(29), 180, false, 0.85);
        s.etiquette(130, s.y(30) - 90, "narcose ? froid ? essoufflement ?");
        s.reperes(20, 30);
        s.legende("Après une descente plus profonde, l'élève analyse et signale",
                "son ressenti au GP : narcose, froid, essoufflement.");
        liste.add(s);

        s = new Schema("9.7", "Plongée profonde encadrée");
        s.echelleProfondeur(100, 5.2);
        s.eau(100, 0);
        s.bateau(30, 180, 100);
        s.limite(40, "40 m");
        s.chemin(true, 200, 120, 300, s.y(35), 480, s.y(35), 560, s.y(10));
        s.plongeur(410, s.y(33), 0, false, 0.55);
        s.plongeur(340, s.y(36.5), 0, true, 0.55);
        s.plongeur(470, s.y(36.5), 0, true, 0.55);
        s.texte(300, s.y(16), "E3 responsable, peu à peu");
        s.reperes(20, 30, 40);
        s.legende("Plongée progressive jusqu'à 40 m sous la responsabilité d'un E3 :",
                "toutes les situations de communication évaluées.");
        liste.add(s);

        s = new Schema("9.8", "Consignes inattendues du GP");
        s.eau(80, 0);
        s.chemin(true, 80, 200, 420, 200, 460, 230, 420, 260, 120, 260);
        s.plongeur(500, 210, 180, false, 0.8);
        s.etiquette(420, 110, "GP : « demi-tour »");
        s.plongeur(360, 205, 0, true, 0.7);
        s.texte(150, 300, "consigne comprise et suivie sans délai");
        s.legende("Le GP change la consigne en plongée : demi-tour, remontée,",
                "profondeur limitée ; l'élève suit sans délai.");
        liste.add(s);

        s = new Schema("9.9", "Débriefing avec le GP");
        s.quai(8, 642, 310);
        s.plongeur(140, 206, -90, true, 0.95);
        s.plongeur(500, 206, -90, false, 0.95);
        s.carnet(200, 96, 240, "Profondeur max, durée", "paliers, pression finale", "ressenti");
        s.legende("En surface puis à terre : l'élève restitue au GP",
                "ses paramètres et son ressenti.");
        liste.add(s);

        // ---------- 10. Retourner en surface ----------
        s = new Schema("10.1", "Paramètres de désaturation");
        s.vueDeDessus();
        s.ordinateur(70, 110, "SIMULATION 25 m", "sans palier 6'", "remontée totale 4'");
        s.etiquette(290, 110, "profondeur, temps");
        s.etiquette(290, 154, "durée sans palier");
        s.etiquette(290, 198, "durée totale de remontée");
        s.etiquette(290, 242, "paliers");
        s.legende("Au sec, ordinateur en simulation : chaque paramètre",
                "de désaturation trouvé et expliqué.");
        liste.add(s);

        s = new Schema("10.2", "Principes de la table fédérale");
        s.vueDeDessus();
        s.carnet(40, 100, 380, "Vitesse : 15 à 17 m/min jusqu'au palier", "Entre paliers et vers la surface : 6 m/min",
                "Paliers à 3 m, 6 m…", "Plongées simple, successive, consécutive");
        s.legende("Oral ou écrit : palier, vitesse de remontée, types de plongée,",
                "sans exercice de calcul de table.");
        liste.add(s);

        s = new Schema("10.4", "Paramètres annoncés au GP");
        s.eau(80, 0);
        s.plongeur(300, 220, 0, true, 0.85);
        s.ordinateur(60, 100, "sans palier 5'");
        s.plongeur(480, 210, 180, false, 0.85);
        s.etiquette(250, 110, "annonce au GP, puis consignes suivies");
        s.legende("L'élève annonce au GP sa durée sans palier restante",
                "et ses paliers, puis suit ses consignes.");
        liste.add(s);

        s = new Schema("10.6", "Plongée avec paliers");
        s.echelleProfondeur(110, 8);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.chemin(true, 60, 112, 140, s.y(25), 320, s.y(25), 430, s.y(3), 560, s.y(3));
        s.plongeur(500, s.y(3), 0, true, 0.6);
        s.ordinateur(160, 170, "PALIER 3 m  3'");
        s.reperes(3, 10, 25);
        s.legende("Plongée qui demande un palier obligatoire, avec le GP :",
                "l'élève suit ses paramètres et fait ses paliers selon son ordinateur.");
        liste.add(s);

        s = new Schema("10.8", "Gérer sa désaturation sur la plongée");
        s.echelleProfondeur(110, 10);
        s.eau(110, 0);
        s.chemin(true, 60, 112, 130, s.y(18), 400, s.y(18), 480, s.y(3), 570, s.y(3));
        s.etiquette(130, s.y(18) - 70, "contrôle");
        s.etiquette(260, s.y(18) - 70, "contrôle");
        s.etiquette(380, s.y(18) - 110, "annonce au GP");
        s.plongeur(330, s.y(18), 0, true, 0.6);
        s.reperes(3, 10, 20);
        s.legende("Instruments contrôlés à une fréquence adaptée à la profondeur,",
                "paramètres communiqués au GP sans être sollicité.");
        liste.add(s);

        s = new Schema("10.9", "Restituer sa plongée au DP");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(160, 168, -90, true, 0.85);
        s.plongeur(460, 168, -90, false, 0.85);
        s.carnet(200, 90, 230, "Max 18,6 m · 42 min", "palier 3 m · 3 min");
        s.texte(440, 110, "DP");
        s.legende("Après la plongée : profondeur maximale, durée et paliers",
                "donnés au DP ; question orale sur la table fédérale.");
        liste.add(s);

        // ---------- 11. Intervenir en relais sur un équipier ----------
        s = new Schema("11.2", "Maintenir la profondeur à deux");
        s.echelleProfondeur(110, 31.5);
        s.eau(110, s.y(6));
        s.bande(3, 5, "± 1 m");
        s.plongeur(280, s.y(4) - 15, 0, false, 0.8);
        s.plongeur(290, s.y(4) + 20, 0, true, 0.8);
        s.octopus(282, s.y(4) + 24, 278, s.y(4) - 10);
        s.etiquette(370, 130, "stabilisés au gilet, pas de descente");
        s.reperes(4, 6);
        s.legende("Binôme relié par l'octopus : stabilisation au gilet,",
                "profondeur tenue, sans descendre.");
        liste.add(s);

        s = new Schema("11.4", "Relais en panne d'air à 10-15 m");
        s.echelleProfondeur(100, 13);
        s.eau(100, 0);
        s.bande(10, 15, "");
        s.plongeur(250, s.y(12.5), 0, false, 1);
        s.plongeur(390, s.y(12.5), 180, true, 1);
        s.octopus(370, s.y(12.5) + 4, 262, s.y(12.5) + 2);
        s.etiquette(120, 120, "panne d'air simulée : deuxième détendeur");
        s.reperes(10, 15);
        s.legende("Entre 10 et 15 m : deuxième détendeur donné aussitôt,",
                "prise en charge, confort de l'équipier.");
        liste.add(s);

        s = new Schema("11.5", "Relais sur essoufflement ou narcose");
        s.eau(80, 0);
        s.paire(250, 170, 0.9);
        s.etiquette(60, 290, "stabiliser, rassurer, empêcher de descendre");
        s.plongeur(520, 200, 180, false, 0.8);
        s.texte(510, 245, "GP prévenu");
        s.fleche(320, 220, 420, 220, false);
        s.legende("Essoufflement ou narcose simulés : l'élève stabilise l'équipier,",
                "le rassure, l'empêche de descendre et prévient le GP.");
        liste.add(s);

        s = new Schema("11.6", "Relais pendant l'évolution");
        s.echelleProfondeur(100, 13);
        s.eau(100, 0);
        s.bande(11, 13, "");
        s.chemin(true, 60, s.y(12), 300, s.y(12));
        s.plongeur(250, s.y(12), 0, true, 0.75);
        s.plongeur(420, s.y(12), -90, false, 0.75);
        s.etiquette(370, 110, "signe pendant le déplacement");
        s.texte(40, s.y(12) + 50, "intervention sans perdre la profondeur");
        s.reperes(10, 15);
        s.legende("L'équipier fait un signe pendant le déplacement :",
                "l'élève intervient vite, sans perdre la profondeur.");
        liste.add(s);

        s = new Schema("11.8", "Situations variées");
        s.eau(80, 0);
        s.plongeur(300, 210, 0, true, 0.9);
        s.plongeur(460, 210, 180, false, 0.9);
        s.etiquette(40, 100, "panne d'air");
        s.etiquette(200, 100, "essoufflement");
        s.etiquette(370, 100, "narcose");
        s.etiquette(60, 280, "crampe");
        s.texte(380, 300, "intervenir avant le GP");
        s.legende("Plusieurs situations tirées au sort, à traiter avant le GP :",
                "une action adaptée à chacune.");
        liste.add(s);

        s = new Schema("11.9", "Relais en zone profonde");
        s.echelleProfondeur(100, 5.2);
        s.eau(100, 0);
        s.limite(40, "40 m");
        s.paire(280, s.y(30) - 50, 0.75);
        s.plongeur(500, s.y(28), 180, false, 0.75);
        s.texte(490, s.y(28) + 45, "GP qui arrive");
        s.etiquette(60, 120, "pas plus profond, flottabilité assurée");
        s.reperes(20, 30, 40);
        s.legende("Dans l'espace 0-40 m, sous la responsabilité d'un E3 :",
                "relais en profondeur jusqu'à l'arrivée du GP.");
        liste.add(s);

        return liste;
    }
}
