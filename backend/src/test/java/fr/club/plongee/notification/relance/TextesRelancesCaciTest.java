package fr.club.plongee.notification.relance;

import fr.club.plongee.notification.relance.CalculRelancesCaci.Moment;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Qualite;
import fr.club.plongee.notification.relance.CalculRelancesCaci.Relance;
import fr.club.plongee.notification.relance.TextesRelancesCaci.Courriel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.RecordComponent;
import java.lang.reflect.Type;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** Les textes des e-mails de relance CACI, au mot près (R13, R14, R15). */
class TextesRelancesCaciTest {

    /** Exemple filé de la spec : Paul Marin, CACI passé le 20/11/2025, F = 20/11/2026. */
    private static final LocalDate F = LocalDate.of(2026, 11, 20);
    private static final LocalDate D = LocalDate.of(2026, 10, 21);

    private static Relance eleve(String nom, String prenom, Moment moment, LocalDate fin) {
        return new Relance(Qualite.ELEVE, 10L, nom, prenom, moment, fin);
    }

    private static Relance moniteur(String nom, String prenom, Moment moment, LocalDate fin) {
        return new Relance(Qualite.MONITEUR, 1L, nom, prenom, moment, fin);
    }

    @Test
    @DisplayName("L'e-mail à J-30 dit mot pour mot que le CACI expire le 20/11/2026")
    void relanceBientot() {
        Courriel courriel = TextesRelancesCaci.bientot("Paul", F);

        assertThat(courriel.sujet()).isEqualTo("Votre CACI expire le 20/11/2026");
        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Paul,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au 20/11/2026.
                Pensez à le faire renouveler et à remettre le nouveau certificat à un administrateur du club avant cette date.

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("L'e-mail du jour J dit mot pour mot que le CACI expire aujourd'hui")
    void relanceJourJ() {
        Courriel courriel = TextesRelancesCaci.jourJ("Paul", F);

        assertThat(courriel.sujet()).isEqualTo("Votre CACI expire aujourd'hui, le 20/11/2026");
        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Paul,

                Votre CACI (certificat d'absence de contre-indication) enregistré au club est valable jusqu'au 20/11/2026, c'est-à-dire aujourd'hui. À partir de demain, il sera expiré.
                Remettez le nouveau certificat à un administrateur du club.

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("Le récapitulatif reprend mot pour mot les rubriques bientôt, aujourd'hui et Sans CACI, sans rubrique vide")
    void recapitulatifExact() {
        Courriel courriel = TextesRelancesCaci.recapitulatif("Claire", D,
                List.of(eleve("Lemaire", "Hugo", Moment.BIENTOT, F),
                        moniteur("Marin", "Paul", Moment.JOUR_J, D)),
                List.of(moniteur("Vidal", "Tom", Moment.SANS_CACI, null)),
                List.of());

        assertThat(courriel.sujet()).isEqualTo("CACI à suivre : récapitulatif du 21/10/2026");
        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Claire,

                Voici les CACI à suivre au 21/10/2026.

                CACI qui expirent bientôt :
                - Lemaire Hugo, élève, valable jusqu'au 20/11/2026

                CACI qui expirent aujourd'hui :
                - Marin Paul, moniteur, valable jusqu'au 21/10/2026

                Sans CACI renseigné :
                - Vidal Tom, moniteur

                Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.
                Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("Une rubrique vide est omise en entier : titre, lignes et ligne vide qui suit")
    void rubriqueVideOmise() {
        Courriel courriel = TextesRelancesCaci.recapitulatif("Claire", D,
                List.of(moniteur("Marin", "Paul", Moment.JOUR_J, D)), List.of(), List.of());

        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Claire,

                Voici les CACI à suivre au 21/10/2026.

                CACI qui expirent aujourd'hui :
                - Marin Paul, moniteur, valable jusqu'au 21/10/2026

                Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.
                Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("Un moniteur que l'e-mail n'a pas pu joindre est listé par son nom et son prénom dans sa rubrique")
    void moniteurInjoignable() {
        Relance paul = moniteur("Marin", "Paul", Moment.BIENTOT, F);

        Courriel courriel = TextesRelancesCaci.recapitulatif("Claire", D, List.of(paul), List.of(), List.of(paul));

        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Claire,

                Voici les CACI à suivre au 21/10/2026.

                CACI qui expirent bientôt :
                - Marin Paul, moniteur, valable jusqu'au 20/11/2026

                Moniteurs que l'e-mail de relance n'a pas pu joindre :
                - Marin Paul

                Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.
                Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("Dans chaque rubrique, les lignes sont triées par nom puis prénom, sans tenir compte des majuscules ni des accents")
    void triSansCasseNiAccents() {
        Relance emery = moniteur("Émery", "Zoé", Moment.BIENTOT, F);
        Relance eluard = moniteur("Eluard", "Paul", Moment.BIENTOT, F);
        Relance martinEric = eleve("Martin", "Eric", Moment.JOUR_J, D);
        Relance martinElodie = eleve("martin", "Élodie", Moment.JOUR_J, D);

        Courriel courriel = TextesRelancesCaci.recapitulatif("Claire", D,
                List.of(emery, martinEric, eluard, martinElodie),
                List.of(eleve("Œuvray", "Lou", Moment.SANS_CACI, null),
                        eleve("dupont", "Léa", Moment.SANS_CACI, null),
                        eleve("Dupont", "Anne", Moment.SANS_CACI, null)),
                List.of(emery, eluard));

        assertThat(courriel.corps()).isEqualTo("""
                Bonjour Claire,

                Voici les CACI à suivre au 21/10/2026.

                CACI qui expirent bientôt :
                - Eluard Paul, moniteur, valable jusqu'au 20/11/2026
                - Émery Zoé, moniteur, valable jusqu'au 20/11/2026

                CACI qui expirent aujourd'hui :
                - martin Élodie, élève, valable jusqu'au 21/10/2026
                - Martin Eric, élève, valable jusqu'au 21/10/2026

                Sans CACI renseigné :
                - Dupont Anne, élève
                - dupont Léa, élève
                - Œuvray Lou, élève

                Moniteurs que l'e-mail de relance n'a pas pu joindre :
                - Eluard Paul
                - Émery Zoé

                Les élèves ne reçoivent aucun message : transmettez-leur l'information, ou à leur responsable légal pour un mineur.
                Les moniteurs listés ont reçu leur propre message, sauf ceux de la rubrique « n'a pas pu joindre ».

                Message envoyé automatiquement par le suivi des formations du club.""");
    }

    @Test
    @DisplayName("Aucun e-mail ne contient la date d'examen, le médecin, les cases, une adresse ni un lien : seules F et D comme dates")
    void aucunContenuDuCertificat() {
        // CACI passé le 20/11/2025 (médecin fédéral, cases compétition et limites) : F = 20/11/2026.
        Relance paul = moniteur("Marin", "Paul", Moment.BIENTOT, F);
        List<Courriel> courriels = List.of(
                TextesRelancesCaci.bientot("Paul", F),
                TextesRelancesCaci.jourJ("Paul", F),
                TextesRelancesCaci.recapitulatif("Claire", D,
                        List.of(paul, eleve("Lemaire", "Hugo", Moment.JOUR_J, D)),
                        List.of(moniteur("Vidal", "Tom", Moment.SANS_CACI, null)),
                        List.of(paul)));

        for (Courriel c : courriels) {
            String texte = (c.sujet() + "\n" + c.corps()).toLowerCase();
            assertThat(texte).as(c.sujet())
                    .doesNotContain("2025", "fédéral", "medecin", "médecin", "compétition", "limites",
                            "préconisation", "licence", "naissance", "téléphone", "urgence", "@", "http", "www.");
            Matcher dates = Pattern.compile("\\d{2}/\\d{2}/\\d{4}").matcher(texte);
            while (dates.find()) {
                assertThat(dates.group()).as(c.sujet()).isIn("20/11/2026", "21/10/2026");
            }
        }
    }

    @Test
    @DisplayName("Les textes ne reçoivent que prénom, nom, mention élève ou moniteur, F et D : rien du certificat")
    void textesNeRecoiventRienDuCertificat() {
        List<Type> permis = List.of(String.class, LocalDate.class);
        for (Method m : TextesRelancesCaci.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(m.getModifiers())) continue;
            for (Type t : m.getGenericParameterTypes()) {
                boolean listeDeRelances = t instanceof ParameterizedType p
                        && p.getRawType() == List.class && p.getActualTypeArguments()[0] == Relance.class;
                assertThat(permis.contains(t) || listeDeRelances).as("%s : paramètre %s", m.getName(), t).isTrue();
            }
        }
        assertThat(Arrays.stream(Relance.class.getRecordComponents()).map(RecordComponent::getName))
                .containsExactly("qualite", "personneId", "nom", "prenom", "moment", "finValidite");
    }
}
