package fr.club.plongee;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Architecture hexagonale (choix de 2026, voir CLAUDE.md « Architecture
 * hexagonale ») : chaque domaine fonctionnel {@code fr.club.plongee.<domaine>}
 * se range en {@code domaine} (modèle, règles, ports), {@code application}
 * (cas d'usage) et {@code adaptateur.entree} / {@code adaptateur.sortie}.
 *
 * Les domaines encore « en couches » (domain/repository/service et
 * contrôleurs à la racine) sont listés dans {@link #DOMAINES_EN_COUCHES} :
 * cette liste ne peut que diminuer. Un domaine migré doit en être retiré
 * (le test le rappelle), un nouveau domaine naît hexagonal.
 */
class ArchitectureHexagonaleTest {

    private static final String RACINE = "fr.club.plongee";

    /** Paquets techniques, transverses, qui ne sont pas des domaines. */
    private static final Set<String> PAQUETS_TECHNIQUES = Set.of("commun", "config", "audit");

    /** Domaines pas encore migrés. Ne jamais y ajouter un domaine. */
    private static final Set<String> DOMAINES_EN_COUCHES = Set.of(
            "admin", "delivrance", "evaluation", "formation", "identite", "materiel",
            "notification", "planning", "progression", "referentiel", "securite");

    /** Seuls sous-paquets admis directement sous un domaine hexagonal. */
    private static final List<String> COUCHES = List.of("domaine", "application", "adaptateur");

    private static JavaClasses classes;

    @BeforeAll
    static void importer() {
        classes = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages(RACINE);
    }

    @Test
    @DisplayName("Un domaine qui n'est pas dans la liste des exceptions est rangé en domaine / application / adaptateur")
    void domainesHexagonauxBienRanges() {
        Map<String, Set<String>> horsCouches = new TreeMap<>();
        for (JavaClass classe : classes) {
            String domaine = domaine(classe);
            if (domaine == null || PAQUETS_TECHNIQUES.contains(domaine) || DOMAINES_EN_COUCHES.contains(domaine)) {
                continue;
            }
            String couche = couche(classe);
            if (!estUneCouche(couche)) {
                horsCouches.computeIfAbsent(domaine, d -> new TreeSet<>()).add(classe.getName());
            }
        }
        assertThat(horsCouches)
                .as("Classes rangées hors de domaine/application/adaptateur dans un domaine hexagonal")
                .isEmpty();
    }

    @Test
    @DisplayName("Chaque domaine de la liste des exceptions est encore en couches (sinon le retirer de la liste)")
    void listeDesExceptionsAJour() {
        Set<String> dejaMigres = new TreeSet<>(DOMAINES_EN_COUCHES);
        for (JavaClass classe : classes) {
            String domaine = domaine(classe);
            if (domaine != null && DOMAINES_EN_COUCHES.contains(domaine) && !estUneCouche(couche(classe))) {
                dejaMigres.remove(domaine);
            }
        }
        assertThat(dejaMigres)
                .as("Domaines migrés à retirer de DOMAINES_EN_COUCHES")
                .isEmpty();
    }

    @Test
    @DisplayName("Le domaine ne dépend ni de l'application, ni des adaptateurs, ni de Spring")
    void domaineIsole() {
        noClasses().that().resideInAPackage(RACINE + ".*.domaine..")
                // Persistable & co. de Spring Data restent admis, comme les annotations JPA
                .should().dependOnClassesThat(resideInAnyPackage(
                        RACINE + ".*.application..", RACINE + ".*.adaptateur..",
                        "org.springframework..", "jakarta.servlet..", "com.fasterxml.jackson..")
                        .and(not(resideInAPackage("org.springframework.data.domain.."))))
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    @DisplayName("L'application ne dépend d'aucun adaptateur ni de la technique web ou base de données")
    void applicationSansAdaptateur() {
        noClasses().that().resideInAPackage(RACINE + ".*.application..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        RACINE + ".*.adaptateur..",
                        "org.springframework.web..", "org.springframework.http..",
                        "org.springframework.jdbc..", "org.springframework.data..",
                        "jakarta.servlet..")
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    @DisplayName("Un adaptateur d'entrée n'appelle pas un adaptateur de sortie, et inversement")
    void adaptateursSepares() {
        noClasses().that().resideInAPackage(RACINE + ".*.adaptateur.entree..")
                .should().dependOnClassesThat().resideInAPackage(RACINE + ".*.adaptateur.sortie..")
                .allowEmptyShould(true)
                .check(classes);
        noClasses().that().resideInAPackage(RACINE + ".*.adaptateur.sortie..")
                .should().dependOnClassesThat().resideInAPackage(RACINE + ".*.adaptateur.entree..")
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    @DisplayName("Les adaptateurs d'un domaine ne sont utilisés que par ce domaine (et la configuration)")
    void adaptateursPrives() {
        Set<String> domaines = new TreeSet<>();
        for (JavaClass classe : classes) {
            String domaine = domaine(classe);
            if ("adaptateur".equals(couche(classe))) {
                domaines.add(domaine);
            }
        }
        for (String domaine : domaines) {
            noClasses().that().resideOutsideOfPackages(RACINE + "." + domaine + "..", RACINE + ".config..")
                    .should().dependOnClassesThat().resideInAPackage(RACINE + "." + domaine + ".adaptateur..")
                    .check(classes);
        }
    }

    /** {@code fr.club.plongee.<domaine>...} → domaine ; null pour une classe à la racine. */
    private static String domaine(JavaClass classe) {
        String[] parties = relatif(classe);
        return parties.length >= 1 && !parties[0].isEmpty() ? parties[0] : null;
    }

    /** Sous-paquet directement sous le domaine ; null pour une classe à la racine du domaine. */
    private static String couche(JavaClass classe) {
        String[] parties = relatif(classe);
        return parties.length >= 2 ? parties[1] : null;
    }

    private static boolean estUneCouche(String couche) {
        return couche != null && COUCHES.contains(couche);
    }

    private static String[] relatif(JavaClass classe) {
        String paquet = classe.getPackageName();
        if (!paquet.startsWith(RACINE + ".")) {
            return new String[0];
        }
        return paquet.substring(RACINE.length() + 1).split("\\.");
    }
}
