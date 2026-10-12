package fr.club.plongee.outils;

import fr.club.plongee.outils.SchemasExercicesN2.Schema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.awt.Color;
import java.awt.geom.Path2D;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Outil, pas un test : dessine les schémas des 43 exercices du N3 PA40 | PE60
 * que {@link SchemasExercicesN3} n'illustrait pas, pour que chaque exercice
 * ait le sien, avec les éléments de dessin du N2.
 *
 * <p>Ignoré par {@code mvn test} ; lancement à la demande, depuis {@code backend/} :
 * {@code mvn test -Dtest=SchemasExercicesN3Complements -Dschemas.n3c=src/main/resources/db/schemas/n3}
 *
 * <p>Les images produites sont chargées en base par la migration
 * V70__schemas_exercices_n3_complements ; une fois celle-ci appliquée, les
 * schémas se remplacent depuis /admin/exercices et non en relançant cet outil.
 */
class SchemasExercicesN3Complements {

    @Test
    @EnabledIfSystemProperty(named = "schemas.n3c", matches = ".+")
    void generer() throws Exception {
        System.setProperty("java.awt.headless", "true");
        SchemasExercicesN2.chargerPolices();
        SchemasExercicesN2.ecrire(schemas(), new File(System.getProperty("schemas.n3c")));
    }

    /** Faisceau de lampe, de (x, y) vers (x2, y2). */
    static void faisceau(Schema s, double x, double y, double x2, double y2) {
        Path2D p = new Path2D.Double();
        p.moveTo(x, y);
        p.lineTo(x2, y2 - 30);
        p.lineTo(x2, y2 + 30);
        p.closePath();
        s.g.setColor(new Color(0xE8, 0xB3, 0x23, 70));
        s.g.fill(p);
    }

    static List<Schema> schemas() {
        List<Schema> liste = new ArrayList<>();
        Schema s;

        // ---------- 1. Planifier la plongée (PA40) ----------
        s = new Schema("1.1", "Lire les consignes du DP");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 310, "Consignes du DP :", "35 m maximum, 25 min", "paliers selon l'ordinateur",
                "retour à 70 bar", "site : tombant, courant d'ouest");
        s.plongeur(500, 206, -90, true, 0.95);
        s.etiquette(420, 100, "je reformule");
        s.legende("Briefing pour la zone 20-40 m : l'élève reformule profondeur, temps,",
                "paliers, retour en surface et informations sur le site.");
        liste.add(s);

        s = new Schema("1.2", "Étudier le site");
        s.vueDeDessus();
        s.point(100, 220, "mouillage");
        s.trait(false);
        s.g.drawLine(330, 90, 300, 320);
        s.texte(220, 110, "tombant");
        s.texte(340, 200, "15 m");
        s.texte(220, 200, "35 m");
        s.fleche(600, 280, 470, 280, true);
        s.texte(480, 270, "courant");
        s.compas(530, 190, 40);
        s.legende("Sur la carte ou le croquis : relief, courant, profondeurs, mouillage ;",
                "orientation choisie : instrument et repères naturels.");
        liste.add(s);

        s = new Schema("1.3", "Calculs pour la zone 20-40 m");
        s.vueDeDessus();
        s.carnet(40, 100, 360, "En surface : 20 L/min", "À 40 m (5 bar) : 100 L/min", "Bloc de 15 L : près de 7 bar/min",
                "Réserve gardée pour la remontée");
        s.ballon(500, 150, 18, "");
        s.ballon(500, 250, 42, "");
        s.texte(530, 155, "surface");
        s.texte(550, 255, "40 m");
        s.legende("Consommation au fond et au palier, autonomie et réserve ;",
                "incidence des GF sur les paliers : des calculs pour comprendre.");
        liste.add(s);

        s = new Schema("1.4", "Profil avec des ordinateurs différents");
        s.vueDeDessus();
        s.ordinateur(40, 120, "PLAN 35 m", "palier 3 m  3'");
        s.ordinateur(240, 120, "PLAN 35 m", "palier 3 m  5'");
        s.ordinateur(440, 120, "PLAN 35 m", "palier 3 m  8'");
        s.coche(520, 245);
        s.texte(200, 280, "la palanquée suit le plus contraignant");
        s.legende("Les ordinateurs de la palanquée en mode planification pour le profil",
                "prévu : paliers comparés, procédure commune retenue.");
        liste.add(s);

        s = new Schema("1.5", "Protocole de consommation et de retour");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(140, 168, -90, true, 0.85);
        s.plongeur(240, 168, -90, true, 0.85);
        s.plongeur(340, 168, -90, true, 0.85);
        s.etiquette(380, 88, "annonces : mi-pression, 70 bar");
        s.etiquette(380, 132, "retour : sous parachute");
        s.etiquette(380, 176, "si panne d'air : …");
        s.legende("La palanquée fixe ses annonces et son retour en surface,",
                "ordinaire ou avec incident, puis les applique en plongée.");
        liste.add(s);

        s = new Schema("1.7", "Présenter et argumenter une planification");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(170, 168, -90, true, 0.85);
        s.plongeur(470, 168, -90, false, 0.85);
        s.carnet(220, 86, 210, "profil, paramètres", "orientation, procédures", "retour");
        s.etiquette(440, 100, "et si… ?");
        s.legende("Avant la mise à l'eau, l'élève présente au moniteur la planification",
                "de la palanquée et la justifie, dans le cadre du DP.");
        liste.add(s);

        s = new Schema("1.8", "Consignes changées par le DP");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 250, "Prévu : 35 m, 25 min");
        s.croix(310, 120);
        s.carnet(40, 170, 250, "DP : 25 m, 20 min", "courant : parcours inversé");
        s.coche(310, 205);
        s.plongeur(480, 206, -90, true, 0.95);
        s.etiquette(380, 100, "on replanifie");
        s.legende("Le DP modifie ses consignes avant la plongée :",
                "la palanquée replanifie vite et l'expose.");
        liste.add(s);

        s = new Schema("1.9", "Planification sur un site inconnu");
        s.vueDeDessus();
        s.point(100, 220, "mouillage");
        s.roche(280, 130, "?");
        s.roche(430, 250, "?");
        s.compas(540, 170, 45);
        s.carnet(150, 260, 230, "Infos du site : profondeurs,", "courant, repères");
        s.legende("Site nouveau : recherche d'informations, orientation choisie,",
                "consommation calculée pour la zone d'évolution.");
        liste.add(s);

        // ---------- 2. Évoluer en autonomie (PA40) ----------
        s = new Schema("2.1", "Orientation : instrument et milieu");
        s.vueDeDessus();
        s.point(90, 200, "départ");
        s.fleche(110, 190, 500, 190, true);
        s.fleche(500, 215, 110, 215, true);
        s.compas(560, 140, 36);
        s.texte(170, 150, "rides du sable, relief, lumière");
        s.texte(200, 250, "retour : cap inverse et repères");
        s.legende("Parcours aller-retour à 10-20 m en combinant le compas,",
                "le relief, le courant et la lumière ; retour au départ.");
        liste.add(s);

        s = new Schema("2.2", "Surveillance mutuelle");
        s.eau(80, 0);
        s.plongeur(250, 170, 0, true, 0.8);
        s.plongeur(250, 250, 0, true, 0.8);
        s.plongeur(420, 210, 0, true, 0.8);
        s.courbe(270, 180, 330, 200, 390, 205, true);
        s.courbe(270, 245, 330, 230, 390, 215, true);
        s.etiquette(60, 100, "place de chacun, contrôle visuel régulier");
        s.legende("Codes de communication, place de chacun, contrôle visuel",
                "régulier des équipiers et de leurs paramètres.");
        liste.add(s);

        s = new Schema("2.3", "Ordinateur : cas concrets");
        s.echelleProfondeur(110, 6.5);
        s.eau(110, 0);
        s.trait(false);
        s.g.drawLine(320, 90, 320, 330);
        s.chemin(false, 30, 112, 70, s.y(25), 110, s.y(12), 150, s.y(28), 190, s.y(10), 230, s.y(26), 300, 112);
        s.texte(40, 320, "yoyo");
        s.croix(130, 315);
        s.chemin(false, 340, 112, 380, s.y(15), 460, s.y(15), 490, s.y(32), 540, s.y(32), 560, 112);
        s.texte(350, 320, "profil inversé");
        s.croix(480, 315);
        s.legende("Sur des captures d'écran : paramètres lus, profils à risque repérés",
                "(yoyo, profil inversé, successives) et commentés.");
        liste.add(s);

        s = new Schema("2.5", "Faire face à un imprévu");
        s.eau(80, 320);
        SchemasExercicesN2Complements.voile(s, 380, 80, 254, 240, "visibilité réduite");
        s.plongeur(250, 190, 0, true, 0.75);
        s.plongeur(240, 240, 0, true, 0.75);
        s.etiquette(40, 100, "« l'équipier a froid »");
        s.chemin(true, 270, 280, 140, 280, 140, 120);
        s.texte(160, 310, "décision partagée : on écourte");
        s.legende("Imprévu annoncé : froid, visibilité réduite, matériel défaillant ;",
                "la palanquée adapte la plongée, décision rapide et partagée.");
        liste.add(s);

        s = new Schema("2.8", "Désaturation dans une palanquée mixte");
        s.echelleProfondeur(110, 30);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.plongeur(200, s.y(3) - 18, 0, true, 0.65);
        s.plongeur(270, s.y(3) + 18, 0, true, 0.65);
        s.plongeur(330, s.y(3) - 5, 0, true, 0.65);
        s.parachute(420, 110, 338, s.y(3) - 12);
        s.ordinateur(110, 250, "3 m  2'");
        s.ordinateur(330, 250, "3 m  6'");
        s.coche(540, 280);
        s.reperes(3, 6);
        s.legende("Moyens de désaturation différents : vitesse et paliers du plus",
                "contraignant, cohésion jusqu'en surface, parachute au palier.");
        liste.add(s);

        s = new Schema("2.9", "Analyse de captures d'ordinateur");
        s.vueDeDessus();
        s.ordinateur(60, 120, "38,2 m   max 41,5", "remontée totale 14'");
        s.ordinateur(340, 120, "ALARME VITESSE", "palier 6 m  2'");
        s.etiquette(200, 260, "que faites-vous dans ce cas ?");
        s.legende("Oral, à partir de captures d'écran : l'élève dit ce qu'il ferait",
                "dans chaque situation, et pourquoi.");
        liste.add(s);

        // ---------- 3. Intervenir et porter assistance (PA40) ----------
        s = new Schema("3.1", "Reconnaître une difficulté en profondeur");
        s.echelleProfondeur(100, 5);
        s.eau(100, 0);
        s.plongeur(170, s.y(30), -90, false, 0.7);
        s.etiquette(40, 110, "ventilation anormale");
        s.plongeur(330, s.y(30), -90, false, 0.7);
        s.etiquette(250, 160, "agitation");
        s.plongeur(490, s.y(30), -60, false, 0.7);
        s.etiquette(400, 110, "perte de vigilance");
        s.reperes(30);
        s.legende("Signes conventionnels et manifestations sans signe : ventilation",
                "anormale, agitation, perte de vigilance, inconscience.");
        liste.add(s);

        s = new Schema("3.3", "Nage capelée progressive");
        s.eau(180, 0);
        s.plongeur(170, 182, 180, true, 0.8);
        s.fleche(260, 205, 560, 205, true);
        s.cote(260, 140, 560, 140, "150 à 200 m");
        s.etiquette(160, 260, "allure régulière, sans chronomètre");
        s.legende("En surface, capelé : 150 à 200 m à allure régulière,",
                "en préparation de la nage de 300 m.");
        liste.add(s);

        s = new Schema("3.4", "Assistance depuis 30 m");
        s.echelleProfondeur(100, 7);
        s.eau(100, s.y(30));
        s.bande(3, 5, "arrêt marqué");
        s.paire(130, Schema.teteAuFond(s.y(30), 0.7), 0.7);
        s.chemin(true, 170, s.y(27), 290, s.y(4), 360, s.y(4), 430, 108);
        s.paire(320, s.y(4) - 10, 0.7);
        s.paire(470, 112, 0.7);
        s.reperes(5, 10, 20, 30);
        s.legende("Remontée assistée depuis 30 m, vitesse adaptée aux moyens",
                "de désaturation, arrêt marqué entre 5 et 3 m, surface.");
        liste.add(s);

        s = new Schema("3.6", "Panne d'air à 30 m");
        s.echelleProfondeur(100, 7);
        s.eau(100, 0);
        s.plongeur(250, s.y(29), 0, false, 0.9);
        s.plongeur(390, s.y(29), 180, true, 0.9);
        s.octopus(370, s.y(29) + 4, 262, s.y(29) + 2);
        s.fleche(320, s.y(25), 320, s.y(10), true);
        s.texte(340, s.y(18), "puis remontée assistée");
        s.etiquette(100, 120, "octopus donné, stabilisation");
        s.reperes(10, 20, 30);
        s.legende("À 30 m : passage de l'octopus aussitôt, stabilisation,",
                "puis remontée assistée maîtrisée.");
        liste.add(s);

        s = new Schema("3.8", "Assistance à 40 m : seconde situation");
        s.echelleProfondeur(100, 5.2);
        s.eau(100, s.y(40));
        s.bande(3, 5, "arrêt marqué");
        s.paire(130, Schema.teteAuFond(s.y(40), 0.65), 0.65);
        s.chemin(true, 170, s.y(37), 290, s.y(4), 360, s.y(4), 430, 108);
        s.paire(320, s.y(4) - 8, 0.65);
        s.paire(470, 112, 0.65);
        s.reperes(5, 20, 40);
        s.legende("Situation différente de 3.7 (panne d'air, perte de vigilance),",
                "réalisée en entier : arrêt marqué, sortie d'eau sécurisée.");
        liste.add(s);

        // ---------- 4. S'adapter à la profondeur (PE60) ----------
        s = new Schema("4.2", "Réviser les techniques du PE40");
        s.echelleProfondeur(100, 8);
        s.eau(100, 0);
        s.plongeur(320, s.y(25), 0, true, 1);
        s.etiquette(60, 110, "ventilation");
        s.etiquette(200, 110, "vidage de masque");
        s.etiquette(380, 110, "lâcher d'embout");
        s.etiquette(60, 290, "communication");
        s.etiquette(380, 290, "relais");
        s.reperes(20, 30);
        s.legende("À 20-30 m : ventilation, vidage de masque, lâcher et reprise",
                "d'embout, communication, relais, sans stress.");
        liste.add(s);

        s = new Schema("4.3", "Sensations en profondeur");
        s.echelleProfondeur(100, 6);
        s.eau(100, 0);
        s.chemin(true, 60, 110, 200, s.y(20), 280, s.y(20), 400, s.y(35));
        s.plongeur(420, s.y(35), 0, true, 0.75);
        s.plongeur(530, s.y(31), 0, false, 0.65);
        s.etiquette(320, 130, "narcose ? froid ? essoufflement ?");
        s.reperes(20, 35);
        s.legende("Descente progressive vers 35 m avec le guide :",
                "l'élève analyse et signale son ressenti.");
        liste.add(s);

        s = new Schema("4.5", "Communiquer en zone profonde");
        s.echelleProfondeur(100, 5.6);
        s.eau(100, 0);
        s.bande(35, 40, "");
        s.plongeur(250, s.y(37), 0, true, 0.85);
        s.plongeur(450, s.y(37), 180, false, 0.85);
        s.carte(120, 140, "120 bar");
        s.etiquette(220, 140, "réponse, puis seuils annoncés");
        s.reperes(20, 35, 40);
        s.legende("Entre 35 et 40 m : le guide demande pression, paliers, état ;",
                "l'élève répond et annonce ses seuils sans être sollicité.");
        liste.add(s);

        s = new Schema("4.9", "Consommation et désaturation en zone profonde");
        s.echelleProfondeur(100, 3.7);
        s.eau(100, 0);
        s.bande(40, 60, "40-60 m : sous un E4");
        s.plongeur(330, s.y(48), 0, true, 0.75);
        s.plongeur(450, s.y(46), 180, false, 0.65);
        s.ordinateur(60, 120, "48 m   remontée 12'");
        s.carte(330, 128, "110 bar");
        s.etiquette(430, 128, "seuil annoncé");
        s.reperes(20, 40, 60);
        s.legende("En plongée encadrée, l'élève suit sa consommation et sa désaturation,",
                "annonce chaque seuil au guide et respecte le retour prévu.");
        liste.add(s);

        // ---------- 5. Organiser la plongée (N3) ----------
        s = new Schema("5.1", "Météo et choix du site");
        s.vueDeDessus();
        s.carnet(40, 100, 250, "Bulletin :", "vent nord-ouest 3 à 4", "houle 1 m", "marée : jusant à 14 h");
        s.roche(380, 150, "A");
        s.texte(410, 157, "abrité");
        s.coche(500, 150);
        s.roche(380, 250, "B");
        s.texte(410, 257, "exposé au vent");
        s.croix(560, 250);
        s.legende("Bulletin (vent, houle, courant, marée) et carte : restrictions,",
                "zones protégées ; site retenu ou écarté avec de bonnes raisons.");
        liste.add(s);

        s = new Schema("5.2", "Matériel de secours");
        s.quai(8, 642, 310);
        s.blocAuSol(90, 310, true);
        s.texte(60, 200, "oxygène");
        s.carnet(170, 96, 310, "Oxygène : pression, masques", "Trousse de secours", "Téléphone, VHF",
                "Fiche d'évacuation");
        s.coche(500, 136);
        s.coche(500, 160);
        s.legende("Matériel de secours, d'oxygénothérapie et de communication",
                "vérifié, en lien avec le RIFA Plongée ; tout manque signalé.");
        liste.add(s);

        s = new Schema("5.3", "Rédiger une fiche de sécurité");
        s.vueDeDessus();
        s.carnet(40, 116, 560, "Palanquée 1 : GP, 3 plongeurs, 35 m, 25 min, immersion 10 h 05",
                "Palanquée 2 : 2 autonomes N3, 30 m, 30 min, immersion 10 h 15",
                "Heures de sortie, paramètres réalisés", "Alerte : 196 (secours en mer), VHF canal 16");
        s.legende("Fiche de sécurité d'une sortie fictive : palanquées, paramètres prévus,",
                "heures, moyens d'alerte ; complète et lisible.");
        liste.add(s);

        s = new Schema("5.4", "Comparer deux sites");
        s.vueDeDessus();
        s.relief(8, 330, 160, 250, 260, 300, 340, 220, 460, 260, 642, 200);
        s.point(240, 230, "A : anse abritée");
        s.point(520, 160, "B : pointe");
        s.fleche(620, 140, 530, 155, false);
        s.texte(580, 130, "vent");
        s.legende("Sur le terrain, deux sites selon la météo du jour : courant,",
                "abri, mouillage, profondeurs ; choix argumenté et prudent.");
        liste.add(s);

        s = new Schema("5.6", "Plan de secours");
        s.vueDeDessus();
        s.carnet(40, 96, 300, "1. Alerte : 196 ou VHF 16", "2. Oxygène à la victime", "3. Surveillance, bilan",
                "4. Évacuation organisée");
        s.etiquette(380, 110, "qui fait quoi ?");
        s.etiquette(380, 160, "délais réels chronométrés");
        s.legende("Scénario d'accident joué à blanc : alerte, oxygène,",
                "communication, évacuation ; le rôle de chacun est clair.");
        liste.add(s);

        s = new Schema("5.7", "Organiser une plongée du bord");
        s.eau(200, 0);
        s.quai(8, 260, 170);
        s.plongeur(80, 104, -90, true, 0.6);
        s.blocAuSol(170, 170, false);
        s.texte(140, 130, "oxygène");
        s.carnet(290, 90, 170, "fiche de sécurité", "oxygène prêt");
        s.plongeur(360, 210, 0, true, 0.6);
        s.plongeur(420, 230, 0, true, 0.6);
        s.plongeur(500, 260, 0, true, 0.6);
        s.texte(360, 300, "palanquées dans la zone 0-40 m");
        s.legende("Organisation complète d'une plongée du bord, sans DP : site,",
                "conditions, fiche de sécurité, matériel de secours.");
        liste.add(s);

        s = new Schema("5.8", "Organiser une plongée en bateau");
        s.eau(180, 0);
        s.bateau(30, 300, 180);
        s.pavillon(160, 140, 70 + 20);
        s.plongeur(240, 112, -90, false, 0.55);
        s.texte(220, 230, "surveillance de surface");
        s.bout(330, 180, 320);
        s.plongeur(420, 250, 0, true, 0.6);
        s.plongeur(470, 270, 0, true, 0.6);
        s.texte(380, 220, "rotation des palanquées");
        s.legende("Depuis une embarcation : mouillage, pavillon alpha,",
                "surveillance de surface, rotation des palanquées.");
        liste.add(s);

        s = new Schema("5.9", "Conditions qui changent");
        s.eau(200, 0);
        s.bateau(60, 330, 200);
        s.fleche(620, 130, 420, 150, false);
        s.texte(470, 120, "vent qui forcit");
        s.courbe(380, 200, 400, 185, 420, 200, false);
        s.courbe(440, 200, 460, 185, 480, 200, false);
        s.etiquette(330, 260, "on adapte, ou on renonce");
        s.legende("Vent, houle ou courant évoluent : l'élève adapte l'organisation",
                "ou renonce, et explique sa décision.");
        liste.add(s);

        // ---------- 6. Évoluer en autonomie 0-60 m (N3) ----------
        s = new Schema("6.1", "Orientation sur parcours variés");
        s.vueDeDessus();
        s.point(90, 260, "départ");
        s.roche(250, 130, "A");
        s.roche(470, 140, "B");
        s.roche(500, 280, "C");
        s.chemin(true, 105, 250, 235, 145, 455, 150, 490, 265, 115, 270);
        s.compas(330, 230, 36);
        s.texte(150, 180, "cap 1");
        s.texte(500, 210, "cap 2");
        s.legende("Parcours à plusieurs caps, à 20-30 m, avec instrument",
                "et repères naturels ; retour au point prévu.");
        liste.add(s);

        s = new Schema("6.2", "Préparer une plongée profonde");
        s.vueDeDessus();
        s.ordinateur(60, 120, "PLAN 40 m", "GF 85 / 85");
        s.carnet(320, 110, 280, "Consommation au fond", "et au palier", "Réserve pour une assistance");
        s.legende("Consommation au fond et au palier, mode planification,",
                "conservatisme adapté à l'air ; paramètres et réserve justes.");
        liste.add(s);

        s = new Schema("6.3", "Co-gestion de la palanquée");
        s.eau(300, 0);
        s.bateau(40, 600, 300);
        s.plongeur(160, 168, -90, true, 0.85);
        s.plongeur(260, 168, -90, true, 0.85);
        s.plongeur(360, 168, -90, true, 0.85);
        s.etiquette(400, 88, "rôles de chacun");
        s.etiquette(400, 132, "signes convenus");
        s.etiquette(400, 176, "si imprévu : …");
        s.legende("Briefing entre équipiers : rôles, signes, surveillance,",
                "conduite en cas d'imprévu ; chacun connaît son rôle.");
        liste.add(s);

        s = new Schema("6.5", "Désaturation après une plongée à 40 m");
        s.echelleProfondeur(115, 5);
        s.eau(115, 0);
        s.bande(5.5, 6.5, "");
        s.bande(2.5, 3.5, "");
        s.chemin(true, 40, 117, 100, s.y(39), 240, s.y(39), 330, s.y(6), 400, s.y(6), 430, s.y(3), 500, s.y(3));
        s.plongeur(380, s.y(6), 0, true, 0.5);
        s.plongeur(490, s.y(3), 0, true, 0.5);
        s.parachute(540, 115, 498, s.y(3) - 6);
        s.texte(260, s.y(20), "paliers du plus contraignant");
        s.reperes(3, 6, 20, 40);
        s.legende("Après une plongée près de 40 m, palanquée aux moyens différents :",
                "paliers du plus contraignant, parachute, cohésion.");
        liste.add(s);

        s = new Schema("6.6", "Risques accrus en profondeur");
        s.echelleProfondeur(100, 4.5);
        s.eau(100, 0);
        s.plongeur(250, s.y(38), 0, false, 0.75);
        s.plongeur(330, s.y(36), 0, true, 0.75);
        s.plongeur(400, s.y(39), 0, true, 0.75);
        s.etiquette(100, s.y(38) - 70, "narcose simulée");
        s.fleche(470, s.y(38), 470, s.y(30), false);
        s.texte(300, s.y(27), "on remonte de quelques mètres");
        s.reperes(20, 30, 40);
        s.legende("Un équipier simule narcose, froid ou essoufflement :",
                "la palanquée réagit et adapte la plongée.");
        liste.add(s);

        // ---------- 7. Respecter le milieu et l'environnement ----------
        s = new Schema("7.1", "Stabilisation fine en profondeur");
        s.echelleProfondeur(100, 8.5);
        s.eau(100, s.y(27));
        for (int x = 230; x < 520; x += 70) s.gorgone(x, s.y(27));
        s.plongeur(380, s.y(27) - 75, 0, true, 0.9);
        s.etiquette(60, 120, "palmes immobiles, sans appui");
        s.reperes(20);
        s.legende("À 20-30 m, au-dessus d'un fond fragile : stabilisation fine,",
                "sans appui ni contact, malgré l'écrasement de la combinaison.");
        liste.add(s);

        s = new Schema("7.2", "Espèces et dangers du milieu");
        s.quai(8, 642, 310);
        s.carnet(40, 96, 260, "Espèces du site :", "courantes et protégées", "(mérou, grande nacre…)");
        s.carnet(340, 96, 260, "Dangers :", "courant, faune piquante", "filets, bateaux");
        s.gorgone(320, 300);
        s.legende("Au sec : espèces courantes et protégées, dangers du milieu,",
                "rappel de la Charte du plongeur responsable.");
        liste.add(s);

        s = new Schema("7.3", "Éclairage et discrétion");
        s.eau(80, 320);
        s.rocher(470, 320, 180, 80);
        s.gorgone(450, 240);
        faisceau(s, 360, 205, 560, 200);
        s.plongeur(350, 205, 0, true, 0.85);
        s.etiquette(60, 110, "lampe à côté de l'animal, pas dessus");
        s.legende("Lampe orientée à côté des animaux, déplacements lents",
                "et silencieux, aucun nourrissage.");
        liste.add(s);

        s = new Schema("7.5", "Observer en palanquée autonome");
        s.eau(80, 320);
        s.rocher(480, 320, 170, 80);
        s.gorgone(480, 240);
        s.plongeur(360, 190, 0, true, 0.75);
        s.plongeur(300, 230, 0, true, 0.75);
        s.plongeur(240, 180, 0, true, 0.75);
        s.etiquette(60, 110, "un seul montre, les autres regardent");
        s.legende("La palanquée autonome montre des espèces sans les poursuivre",
                "ni les toucher, et reste groupée.");
        liste.add(s);

        s = new Schema("7.6", "Palmage adapté au milieu");
        s.eau(80, 320);
        s.plongeur(400, 240, 12, true, 1);
        s.etiquette(130, 110, "grenouille et recul, palmes hautes");
        s.coche(200, 300);
        s.texte(220, 305, "aucun nuage de sédiment");
        s.legende("Près des fonds sensibles et des sédiments : palmage de grenouille",
                "et recul, sans rien soulever.");
        liste.add(s);

        s = new Schema("7.7", "Plongée d'observation");
        s.eau(110, 320);
        s.rocher(170, 320, 170, 70);
        s.gorgone(170, 250);
        s.rocher(500, 320, 190, 90);
        s.gorgone(470, 230);
        s.plongeur(380, 190, 0, true, 0.7);
        s.plongeur(330, 220, 0, true, 0.7);
        s.chemin(true, 80, 170, 260, 180, 560, 170);
        s.etiquette(380, 120, "en surface : espèces nommées");
        s.legende("Plongée consacrée à l'observation, sans contact ;",
                "en surface, l'élève décrit et nomme les espèces vues.");
        liste.add(s);

        s = new Schema("7.9", "Comportement sur toutes les plongées");
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

        return liste;
    }
}
