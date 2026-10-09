package fr.club.plongee.outils;

import fr.club.plongee.outils.SchemasExercicesN2.Schema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Outil, pas un test : dessine les schémas des exercices du N3 PA40 | PE60
 * (base d'exercices, V61), avec les mêmes éléments de dessin que ceux du N2
 * ({@link SchemasExercicesN2.Schema}).
 *
 * <p>Ignoré par {@code mvn test} ; lancement à la demande, depuis {@code backend/} :
 * {@code mvn test -Dtest=SchemasExercicesN3 -Dschemas.n3=src/main/resources/db/schemas/n3}
 *
 * <p>Les images produites sont chargées en base par la migration
 * V62__schemas_exercices_n3 ; une fois celle-ci appliquée, les schémas se
 * remplacent depuis /admin/exercices et non en relançant cet outil.
 */
class SchemasExercicesN3 {

    @Test
    @EnabledIfSystemProperty(named = "schemas.n3", matches = ".+")
    void generer() throws Exception {
        System.setProperty("java.awt.headless", "true");
        SchemasExercicesN2.chargerPolices();
        SchemasExercicesN2.ecrire(schemas(), new File(System.getProperty("schemas.n3")));
    }

    static List<Schema> schemas() {
        List<Schema> liste = new ArrayList<>();
        Schema s;

        // ---------- 1. Planifier la plongée ----------
        s = new Schema("1.6", "Planifier un parcours orienté");
        s.vueDeDessus();
        s.point(100, 200, "mouillage");
        s.roche(270, 130, "A");
        s.roche(480, 150, "B");
        s.roche(430, 285, "C");
        s.chemin(true, 115, 190, 245, 137, 455, 152, 425, 262, 125, 212);
        s.texte(150, 150, "cap 1");
        s.texte(470, 215, "cap 2");
        s.texte(240, 262, "retour");
        s.legende("Parcours planifié : repères et caps choisis avant la plongée.",
                "Réalisé à 20-30 m, retour au mouillage, écarts débriefés.");
        liste.add(s);

        // ---------- 2. Évoluer en autonomie (PA40) ----------
        s = new Schema("2.4", "Parcours varié en autonomie");
        s.echelleProfondeur(110, 7);
        s.eau(110, s.y(27));
        s.bateau(30, 200, 110);
        s.bout(200, 110, s.y(27));
        s.plongeur(330, s.y(19), 0, true, 0.7);
        s.plongeur(305, s.y(21.5), 0, true, 0.7);
        s.plongeur(350, s.y(22.5), 0, true, 0.7);
        s.fleche(380, s.y(19), 570, s.y(19), true);
        s.fleche(570, s.y(24.5), 230, s.y(24.5), true);
        s.texte(400, s.y(24.5) - 10, "retour près du bateau");
        s.reperes(10, 20);
        s.legende("Autonomie à 20-30 m : points remarquables, palanquée groupée.",
                "Moniteur en retrait ; retour à proximité du bateau.");
        liste.add(s);

        s = new Schema("2.6", "Paliers en pleine eau sous parachute");
        s.echelleProfondeur(110, 30);
        s.eau(110, 0);
        s.bande(2.5, 3.5, "palier");
        s.plongeur(200, s.y(3), 0, true, 0.7);
        s.plongeur(270, s.y(3) - 20, 0, true, 0.7);
        s.plongeur(330, s.y(3) + 15, 0, true, 0.7);
        s.parachute(400, 110, 338, s.y(3) + 6);
        s.texte(300, 290, "arrêt et tour d'horizon à 3 m");
        s.reperes(3, 6);
        s.legende("Pleine eau : parachute, vitesse et paliers du plus contraignant.",
                "Arrêt et tour d'horizon à 3 m, palanquée groupée.");
        liste.add(s);

        s = new Schema("2.7", "Plongée autonome proche de 40 m");
        s.echelleProfondeur(100, 5);
        s.eau(100, 0);
        s.bateau(400, 560, 100);
        s.bande(36, 40, "près de 40 m");
        s.chemin(true, 420, 110, 330, s.y(37), 170, s.y(37), 280, s.y(3), 360, s.y(3), 410, 108);
        s.plongeur(200, s.y(36.5), 180, true, 0.6);
        s.plongeur(285, s.y(38.5), 180, true, 0.6);
        s.plongeur(250, s.y(35.5), 180, true, 0.6);
        s.reperes(3, 20, 40);
        s.legende("Au moins deux situations, près de 40 m : orientation, surveillance,",
                "désaturation et retour au bateau, sans le moniteur.");
        liste.add(s);

        // ---------- 3. Intervenir et porter assistance (PA40) ----------
        s = new Schema("3.2", "Assistance au gilet depuis 20 m");
        s.echelleProfondeur(100, 10);
        s.eau(100, s.y(20));
        s.bande(3, 5, "arrêt marqué");
        s.paire(150, Schema.teteAuFond(s.y(20), 0.7), 0.7);
        s.chemin(true, 190, s.y(17), 310, s.y(4), 380, s.y(4), 450, 108);
        s.paire(345, s.y(4) - 10, 0.7);
        s.paire(500, 112, 0.7);
        s.reperes(3, 5, 20);
        s.legende("Depuis 20 m : prise ferme, remontée au gilet à vitesse régulière,",
                "arrêt marqué entre 5 et 3 m.");
        liste.add(s);

        s = new Schema("3.5", "Sortir rapidement de la zone profonde");
        s.echelleProfondeur(100, 5);
        s.eau(100, s.y(42));
        s.bande(3, 5, "arrêt marqué entre 5 et 3 m");
        s.paire(130, Schema.teteAuFond(s.y(42), 0.6), 0.6);
        s.fleche(170, s.y(39), 250, s.y(30), false);
        s.texte(255, s.y(32), "rapide jusqu'à 30 m");
        s.chemin(true, 250, s.y(30), 400, s.y(5));
        s.texte(330, s.y(17), "puis vitesse régulée");
        s.paire(450, s.y(4) - 10, 0.6);
        s.reperes(5, 30, 40);
        s.legende("Sortie rapide de la zone profonde jusqu'à 30 m environ,",
                "puis vitesse régulée jusqu'à l'arrêt marqué entre 5 et 3 m.");
        liste.add(s);

        s = new Schema("3.7", "Assistance à 40 m : première situation");
        s.echelleProfondeur(100, 5);
        s.eau(100, s.y(42));
        s.bande(3, 5, "arrêt marqué entre 5 et 3 m");
        s.bateau(450, 570, 100);
        s.paire(120, Schema.teteAuFond(s.y(42), 0.6), 0.6);
        s.chemin(true, 160, s.y(38), 260, s.y(4), 310, s.y(4), 370, 108);
        s.paire(285, s.y(4) - 10, 0.6);
        s.paire(410, 112, 0.6);
        s.reperes(5, 20, 40);
        s.legende("À 40 m, deux situations, chacune au moins deux fois : prise en",
                "charge, remontée régulière, arrêt entre 5 et 3 m, sortie sûre.");
        liste.add(s);

        s = new Schema("3.9", "Nage capelée de 300 m");
        s.eau(180, 0);
        s.plongeur(200, 184, 0, true, 0.9);
        s.fleche(230, 230, 580, 230, true);
        s.cote(110, 135, 580, 135, "300 m");
        s.texte(300, 270, "capelé, sans chronomètre");
        s.legende("300 m en surface, capelé, à allure régulière.",
                "Pas d'épreuve chronométrée : bonnes conditions physiques.");
        liste.add(s);

        // ---------- 4. S'adapter à la profondeur (PE60) ----------
        s = new Schema("4.1", "Stabilisation à 30 m");
        s.echelleProfondeur(100, 7);
        s.eau(100, 0);
        s.bande(29, 31, "± 1 m");
        s.plongeur(320, s.y(30), 0, true, 1);
        s.plongeur(470, s.y(30), 180, false, 0.9);
        s.texte(250, s.y(30) - 40, "palmes immobiles");
        s.reperes(10, 20, 30);
        s.legende("À 30 m, au gilet puis au poumon ballast, palmes immobiles.",
                "La combinaison s'écrase : le gilet se règle plus souvent.");
        liste.add(s);

        s = new Schema("4.4", "Descente et remontée équilibrées jusqu'à 40 m");
        s.echelleProfondeur(100, 5);
        s.eau(100, 0);
        s.bande(19, 21, "± 1 m");
        s.bande(29, 31, "± 1 m");
        s.bande(39, 41, "± 1 m");
        s.chemin(true, 80, 100, 160, s.y(20), 230, s.y(20), 290, s.y(30), 360, s.y(30), 420, s.y(40), 480, s.y(40), 540, s.y(8));
        s.plongeur(205, s.y(20), 0, true, 0.5);
        s.plongeur(335, s.y(30), 0, true, 0.5);
        s.plongeur(465, s.y(40), 0, true, 0.5);
        s.reperes(20, 30, 40);
        s.legende("Jusqu'à 40 m au plus : arrêts aux profondeurs annoncées à ± 1 m,",
                "évolution équilibrée au fond, remontée et palier.");
        liste.add(s);

        s = new Schema("4.6", "Relais en zone profonde");
        s.echelleProfondeur(100, 4.5);
        s.eau(100, 0);
        s.bande(37, 39, "± 1 m");
        s.plongeur(200, s.y(38) - 15, 0, false, 0.8);
        s.plongeur(210, s.y(38) + 20, 0, true, 0.8);
        s.octopus(202, s.y(38) + 24, 198, s.y(38) - 10);
        s.fleche(245, s.y(38), 410, s.y(38), true);
        s.texte(250, s.y(38) - 30, "jusqu'au guide, sans descendre");
        s.plongeur(460, s.y(38), 180, false, 0.8);
        s.texte(440, s.y(38) + 45, "guide");
        s.reperes(20, 38);
        s.legende("Entre 35 et 40 m : relais auprès d'un équipier jusqu'au guide,",
                "profondeur gardée, aucune descente.");
        liste.add(s);

        s = new Schema("4.7", "Évaluation à 40 m au plus");
        s.echelleProfondeur(100, 5);
        s.eau(100, 0);
        s.limite(40, "limite de l'évaluation : 40 m, par un E3");
        s.plongeur(300, s.y(35), 0, true, 1);
        s.plongeur(440, s.y(35), 180, false, 1);
        s.texte(425, s.y(35) + 40, "E3");
        s.reperes(20, 40);
        s.legende("Évaluation par un E3, à 40 m au plus : stabilisation à chaque",
                "étape et mise en œuvre de toutes les techniques.");
        liste.add(s);

        s = new Schema("4.8", "Plongée encadrée entre 40 et 60 m");
        s.echelleProfondeur(95, 3.9);
        s.eau(95, 0);
        s.bande(40, 60, "zone 40-60 m : E4");
        profil(s, 60, 45);
        profil(s, 235, 52);
        profil(s, 410, 58);
        s.texte(75, 125, "plongée 1");
        s.texte(250, 125, "plongée 2");
        s.texte(425, 125, "plongée 3");
        s.reperes(20, 40, 60);
        s.legende("Entre 40 et 60 m, toujours encadré par un E4 :",
                "profondeur augmentée d'une plongée à l'autre.");
        liste.add(s);

        // ---------- 5. Organiser la plongée ----------
        s = new Schema("5.5", "Embarcation et surveillance de surface");
        s.eau(220, 0);
        s.bateau(120, 430, 220);
        s.pavillon(390, 178, 95);
        s.plongeur(230, 108, -90, false, 0.7);
        s.texte(150, 95, "surveillance de surface");
        s.parachute(560, 220, 540, 300);
        s.plongeur(520, 305, 0, true, 0.55);
        s.texte(480, 270, "palanquée à l'eau");
        s.texte(455, 135, "pavillon alpha");
        s.legende("Embarcation conforme, pavillon alpha hissé, surveillance de",
                "surface, palanquées mises à l'eau à tour de rôle.");
        liste.add(s);

        // ---------- 6. Évoluer en autonomie (0-60 m) ----------
        s = new Schema("6.4", "Parcours orienté à 35-40 m");
        s.echelleProfondeur(100, 4.5);
        s.eau(100, s.y(40));
        s.bande(35, 40, "35 à 40 m");
        s.plongeur(200, s.y(35.8), 0, true, 0.55);
        s.plongeur(240, s.y(37.6), 0, true, 0.55);
        s.fleche(270, s.y(37), 520, s.y(37), true);
        s.roche(555, s.y(38), "A");
        s.texte(300, s.y(30), "cap, relief, courant");
        s.reperes(20, 40);
        s.legende("Entre 35 et 40 m : parcours orienté, instrument et relief,",
                "consommation et paramètres contrôlés à chaque étape.");
        liste.add(s);

        s = new Schema("6.7", "Autonomie à 40 m comme entre 40 et 60 m");
        s.echelleProfondeur(95, 3.9);
        s.eau(95, 0);
        s.bande(40, 60, "exigences de cette zone");
        s.limite(40, "évaluation à 40 m au plus");
        s.plongeur(280, s.y(36.5), 0, true, 0.7);
        s.plongeur(390, s.y(37), 0, true, 0.7);
        s.plongeur(500, s.y(36), 0, true, 0.7);
        s.reperes(20, 40, 60);
        s.legende("Deux situations à 40 m au plus, avec le comportement exigé",
                "entre 40 et 60 m : consommation, désaturation, co-gestion.");
        liste.add(s);

        s = new Schema("6.8", "Vers 60 m sous la responsabilité d'un E4");
        s.echelleProfondeur(95, 3.9);
        s.eau(95, 0);
        s.bande(40, 60, "");
        s.bateau(480, 642, 95);
        s.texte(540, 80 + 22, "DP");
        s.chemin(true, 470, 105, 480, s.y(50));
        s.plongeur(330, s.y(53), 180, true, 0.6);
        s.plongeur(420, s.y(55.5), 180, true, 0.6);
        s.plongeur(220, s.y(54), 180, false, 0.6);
        s.texte(200, s.y(54) - 18, "E4");
        s.reperes(20, 40, 60);
        s.legende("Vers 60 m, en présence d'un DP et sous la responsabilité d'un E4,",
                "profondeur augmentée progressivement.");
        liste.add(s);

        s = new Schema("6.9", "Retour en surface d'une plongée profonde");
        s.echelleProfondeur(100, 10);
        s.eau(100, 0);
        s.bande(2.5, 3.5, "palier");
        s.bateau(520, 642, 100);
        s.chemin(true, 100, 335, 280, s.y(3), 400, s.y(3), 460, 108);
        s.texte(30, 310, "depuis 40 m");
        s.plongeur(320, s.y(3), 0, true, 0.55);
        s.plongeur(380, s.y(3) + 16, 0, true, 0.55);
        s.parachute(440, 100, 388, s.y(3) + 24);
        s.texte(300, 190, "arrêt et tour d'horizon à 3 m");
        s.reperes(3, 10, 20);
        s.legende("Remontée à la vitesse prévue, paliers, parachute,",
                "arrêt et tour d'horizon à 3 m, retour près du bateau.");
        liste.add(s);

        // ---------- 7. Respecter le milieu et l'environnement ----------
        s = new Schema("7.4", "Le long d'un tombant à 30 m");
        s.eau(80, 0);
        s.paroi(520);
        s.plongeur(405, 190, 0, true, 1);
        s.cote(418, 240, 515, 240, "1 m");
        s.fleche(380, 220, 380, 310, true);
        s.texte(30, 110, "vers 30 m");
        s.legende("À 30 m, à 1 m du tombant ou de l'épave, sans contact.",
                "Trajectoire stable, palmes hautes, lampe à côté des animaux.");
        liste.add(s);

        s = new Schema("7.8", "Milieu fragile en zone profonde");
        s.eau(80, 320);
        s.gorgone(180, 320);
        s.gorgone(300, 320);
        s.gorgone(430, 320);
        s.gorgone(540, 320);
        s.plongeur(330, 215, 0, true, 1);
        s.fleche(350, 175, 560, 175, true);
        s.cote(470, 230, 470, 262, "sans appui");
        s.legende("Coralligène, gorgones, épave : évolution sans appui ni contact,",
                "au fond comme au palier.");
        liste.add(s);

        return liste;
    }

    /** Une plongée vue de profil : descente, fond, remontée jusqu'au palier, surface. */
    static void profil(Schema s, double x, double metres) {
        s.chemin(true, x, s.y(0) + 4, x + 25, s.y(metres), x + 60, s.y(metres),
                x + 110, s.y(3), x + 135, s.y(3), x + 145, s.y(0) + 6);
    }
}
