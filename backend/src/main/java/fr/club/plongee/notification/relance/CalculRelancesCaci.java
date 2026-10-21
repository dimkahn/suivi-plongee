package fr.club.plongee.notification.relance;

import fr.club.plongee.commun.Caci;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Relances CACI dues un jour D, en calcul pur (sans base ni envoi) : à partir
 * des personnes du périmètre et des relances déjà faites, dit quelles relances
 * « bientôt » (de F − 30 à F − 1) et « jour J » (le jour F) sont dues, une
 * seule fois par personne et par fin de validité F (une nouvelle F ouvre un
 * nouveau cycle), et qui citer sous « Sans CACI renseigné » (au plus une fois
 * sur 7 jours, et seulement les jours où le récapitulatif part). Un dossier
 * élève rattaché au compte d'un moniteur du périmètre est ignoré : la personne
 * est traitée comme moniteur. Ne lit rien du certificat hormis F.
 */
public final class CalculRelancesCaci {

    /** Mention de la personne au récapitulatif. */
    public enum Qualite { ELEVE, MONITEUR }

    /** Moment de la relance ; {@code SANS_CACI} : citation dans la rubrique « Sans CACI renseigné ». */
    public enum Moment { BIENTOT, JOUR_J, SANS_CACI }

    /** Moniteur du périmètre (rôle MONITEUR, actif le jour D) ; {@code finValidite} nulle : pas de CACI. */
    public record Moniteur(long utilisateurId, String nom, String prenom, LocalDate finValidite) {}

    /** Dossier élève du périmètre ; {@code utilisateurId} : compte rattaché, s'il y en a un. */
    public record Eleve(long eleveId, Long utilisateurId, String nom, String prenom, LocalDate finValidite) {}

    /** Relance déjà faite ; {@code personneId} : id du compte (moniteur) ou du dossier (élève). */
    public record RelanceFaite(Qualite qualite, long personneId, Moment moment, LocalDate finValidite,
                               LocalDate faiteLe) {}

    /** Relance due ; {@code finValidite} nulle pour {@code SANS_CACI}. */
    public record Relance(Qualite qualite, long personneId, String nom, String prenom, Moment moment,
                          LocalDate finValidite) {}

    /** {@code dues} : relances « bientôt » et « jour J » ; {@code sansCaci} : citations « Sans CACI renseigné ». */
    public record Resultat(List<Relance> dues, List<Relance> sansCaci) {

        /** R11 : le récapitulatif part si au moins une relance (élève ou moniteur) est due. */
        public boolean recapitulatifDu() {
            return !dues.isEmpty();
        }
    }

    private CalculRelancesCaci() {}

    public static Resultat calculer(LocalDate jour, List<Moniteur> moniteurs, List<Eleve> eleves,
                                    List<RelanceFaite> faites) {
        List<Personne> personnes = new ArrayList<>();
        moniteurs.forEach(m -> personnes.add(
                new Personne(Qualite.MONITEUR, m.utilisateurId(), m.nom(), m.prenom(), m.finValidite())));
        Set<Long> comptesMoniteurs = moniteurs.stream().map(Moniteur::utilisateurId).collect(Collectors.toSet());
        eleves.stream()
                .filter(e -> e.utilisateurId() == null || !comptesMoniteurs.contains(e.utilisateurId())) // R5
                .forEach(e -> personnes.add(new Personne(Qualite.ELEVE, e.eleveId(), e.nom(), e.prenom(), e.finValidite())));

        List<Relance> dues = new ArrayList<>();
        List<Relance> sansCaci = new ArrayList<>();
        for (Personne p : personnes) {
            if (p.fin() == null) {
                if (!citeeCetteSemaine(jour, faites, p)) {
                    sansCaci.add(new Relance(p.qualite(), p.id(), p.nom(), p.prenom(), Moment.SANS_CACI, null));
                }
            } else {
                relanceDue(jour, p, faites).ifPresent(dues::add);
            }
        }
        // R11 : sans relance due, pas de récapitulatif, donc personne n'est cité sous « Sans CACI renseigné ».
        return new Resultat(dues, dues.isEmpty() ? List.of() : sansCaci);
    }

    private record Personne(Qualite qualite, long id, String nom, String prenom, LocalDate fin) {}

    /** R12 : citée sous « Sans CACI renseigné » par un récapitulatif parti entre D − 6 et D inclus. */
    private static boolean citeeCetteSemaine(LocalDate jour, List<RelanceFaite> faites, Personne p) {
        return faites.stream().anyMatch(f -> f.qualite() == p.qualite() && f.personneId() == p.id()
                && f.moment() == Moment.SANS_CACI
                && !f.faiteLe().isBefore(jour.minusDays(6)) && !f.faiteLe().isAfter(jour));
    }

    /** « Bientôt » de F − 30 à F − 1 (R6), « jour J » le jour F seulement (R7), une fois par F (R8). */
    private static Optional<Relance> relanceDue(LocalDate jour, Personne p, List<RelanceFaite> faites) {
        LocalDate fin = p.fin();
        Moment moment;
        if (jour.equals(fin)) moment = Moment.JOUR_J;
        else if (!jour.isBefore(fin.minusDays(Caci.JOURS_AVANT_ECHEANCE)) && jour.isBefore(fin)) moment = Moment.BIENTOT;
        else return Optional.empty();
        if (dejaFaite(faites, p, moment)) return Optional.empty();
        return Optional.of(new Relance(p.qualite(), p.id(), p.nom(), p.prenom(), moment, fin));
    }

    private static boolean dejaFaite(List<RelanceFaite> faites, Personne p, Moment moment) {
        return faites.stream().anyMatch(f -> f.qualite() == p.qualite() && f.personneId() == p.id()
                && f.moment() == moment && p.fin().equals(f.finValidite()));
    }
}
