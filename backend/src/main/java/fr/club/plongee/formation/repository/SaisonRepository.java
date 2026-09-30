package fr.club.plongee.formation.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import fr.club.plongee.formation.domain.Saison;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.Optional;

public interface SaisonRepository extends JpaRepository<Saison, Long> {
    Optional<Saison> findFirstByOuverteTrueOrderByDateDebutDesc();

    /**
     * La saison dont les dates couvrent toute la période. Si plusieurs se
     * chevauchent, la saison ouverte l'emporte, puis la plus récente.
     */
    default Optional<Saison> contenant(LocalDate debut, LocalDate fin) {
        return findAll().stream()
                .filter(s -> !debut.isBefore(s.getDateDebut()) && !fin.isAfter(s.getDateFin()))
                .max(Comparator.comparing(Saison::isOuverte).thenComparing(Saison::getDateDebut));
    }
}
