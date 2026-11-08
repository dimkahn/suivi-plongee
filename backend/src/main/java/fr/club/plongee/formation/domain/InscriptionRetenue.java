package fr.club.plongee.formation.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Inscription montrée pour un élève dans les listes de personnes d'une saison
 * (trombinoscope, feuille de présence, Infos élèves, synthèse du groupe,
 * formations en cours). Un brevet délivré en cours d'année, puis le niveau
 * suivant, font deux inscriptions pour la même personne : on n'en montre
 * qu'une. Choix du club, 2026-11-08.
 *
 * <p>Ordre de préférence : en cours ou suspendue, puis validée ou délivrée,
 * puis hors formation (abandon, obtenu ailleurs) ; à égalité, la plus récente.
 * L'ordre des élèves de la liste d'origine est gardé.
 */
public final class InscriptionRetenue {

    private InscriptionRetenue() {}

    public static List<Cursus> uneParEleve(List<Cursus> inscriptions) {
        Map<Long, Cursus> parEleve = new LinkedHashMap<>();
        for (Cursus c : inscriptions) {
            parEleve.merge(c.getEleve().getId(), c, (actuel, candidat) -> prefere(candidat, actuel) ? candidat : actuel);
        }
        return new ArrayList<>(parEleve.values());
    }

    private static boolean prefere(Cursus candidat, Cursus actuel) {
        int rangCandidat = rang(candidat);
        int rangActuel = rang(actuel);
        if (rangCandidat != rangActuel) return rangCandidat < rangActuel;
        return candidat.getId() > actuel.getId();
    }

    private static int rang(Cursus c) {
        if (c.getStatut() == Cursus.Statut.EN_COURS || c.getStatut() == Cursus.Statut.SUSPENDU) return 0;
        if (c.horsFormation()) return 2;
        return 1;
    }
}
