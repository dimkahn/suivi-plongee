package fr.club.plongee.notification.relance;

import fr.club.plongee.notification.relance.CalculRelancesCaci.Moment;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Qualite;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Relance;

import java.text.Collator;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;

import static fr.club.plongee.commun.Calendrier.DATE_FR;

/**
 * Textes exacts des e-mails de relance CACI, en texte brut et sans lien
 * (R13, R14, R15 de la spec). Les méthodes ne reçoivent que prénom, nom,
 * mention élève ou moniteur, fin de validité F et date du jour D : rien du
 * certificat ni aucune autre donnée personnelle ne peut entrer dans un e-mail
 * (R18, figé par {@code TextesRelancesCaciTest}).
 */
public final class TextesRelancesCaci {

    /** Sujet et corps d'un e-mail en texte brut. */
    public record Courriel(String sujet, String corps) {}

    private static final String SIGNATURE = "Message envoyé automatiquement par le suivi des formations du club.";

    /** Tri des lignes par nom puis prénom, ni casse ni accents (force primaire). */
    private static final Comparator<Relance> ORDRE_ALPHABETIQUE = ordreAlphabetique();

    private TextesRelancesCaci() {}

    private static Comparator<Relance> ordreAlphabetique() {
        Collator collator = Collator.getInstance(Locale.FRENCH);
        collator.setStrength(Collator.PRIMARY);
        return Comparator.comparing(Relance::nom, collator).thenComparing(Relance::prenom, collator);
    }

    /** R13 : e-mail « bientôt » au moniteur. */
    public static Courriel bientot(String prenom, LocalDate finValidite) {
        String fin = DATE_FR.format(finValidite);
        return new Courriel("Votre CACI expire le " + fin, """
                Bonjour %s,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au %s.
                Pensez à le faire renouveler et à remettre le nouveau certificat à un administrateur du club avant cette date.

                %s""".formatted(prenom, fin, SIGNATURE));
    }

    /** R14 : e-mail « jour J » au moniteur. */
    public static Courriel jourJ(String prenom, LocalDate finValidite) {
        String fin = DATE_FR.format(finValidite);
        return new Courriel("Votre CACI expire aujourd'hui, le " + fin, """
                Bonjour %s,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au %s, c'est-à-dire aujourd'hui. À partir de demain, il sera expiré.
                Remettez le nouveau certificat à un administrateur du club.

                %s""".formatted(prenom, fin, SIGNATURE));
    }

    /**
     * R15 : récapitulatif à un administrateur.
     *
     * @param prenom       prénom de l'administrateur destinataire
     * @param jour         D, date du récapitulatif
     * @param dues         relances « bientôt » et « jour J » du jour, élèves et moniteurs
     * @param sansCaci     citations « Sans CACI renseigné » du jour (R12)
     * @param injoignables moniteurs dont l'e-mail de relance n'a pas pu partir (R16)
     */
    public static Courriel recapitulatif(String prenom, LocalDate jour, List<Relance> dues,
                                         List<Relance> sansCaci, List<Relance> injoignables) {
        String date = DATE_FR.format(jour);
        StringBuilder corps = new StringBuilder();
        corps.append("Bonjour ").append(prenom).append(",\n\n");
        corps.append("Voici les CACI à suivre au ").append(date).append(".\n\n");
        rubrique(corps, "CACI qui expirent bientôt :",
                dues.stream().filter(r -> r.moment() == Moment.BIENTOT).toList(), TextesRelancesCaci::ligneAvecFin);
        rubrique(corps, "CACI qui expirent aujourd'hui :",
                dues.stream().filter(r -> r.moment() == Moment.JOUR_J).toList(), TextesRelancesCaci::ligneAvecFin);
        rubrique(corps, "Sans CACI renseigné :", sansCaci,
                r -> "- " + r.nom() + " " + r.prenom() + ", " + mention(r));
        rubrique(corps, "Moniteurs que l'e-mail de relance n'a pas pu joindre :", injoignables,
                r -> "- " + r.nom() + " " + r.prenom());
        corps.append("Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.\n");
        corps.append("Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».\n\n");
        corps.append(SIGNATURE);
        return new Courriel("CACI à suivre : récapitulatif du " + date, corps.toString());
    }

    /**
     * Une rubrique vide est omise en entier : titre, lignes et ligne vide qui suit.
     * Lignes triées par nom puis prénom, ni casse ni accents.
     */
    private static void rubrique(StringBuilder corps, String titre, List<Relance> personnes,
                                 Function<Relance, String> ligne) {
        if (personnes.isEmpty()) return;
        corps.append(titre).append('\n');
        personnes.stream().sorted(ORDRE_ALPHABETIQUE).forEach(r -> corps.append(ligne.apply(r)).append('\n'));
        corps.append('\n');
    }

    private static String ligneAvecFin(Relance r) {
        return "- " + r.nom() + " " + r.prenom() + ", " + mention(r) + ", valable jusqu'au "
                + DATE_FR.format(r.finValidite());
    }

    private static String mention(Relance r) {
        return r.qualite() == Qualite.ELEVE ? "élève" : "moniteur";
    }
}
