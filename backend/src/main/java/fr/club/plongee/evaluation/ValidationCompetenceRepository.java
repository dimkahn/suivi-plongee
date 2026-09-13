package fr.club.plongee.evaluation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ValidationCompetenceRepository extends JpaRepository<ValidationCompetence, Long> {
    List<ValidationCompetence> findByCursusId(Long cursusId);
    Optional<ValidationCompetence> findByCursusIdAndBlocId(Long cursusId, Long blocId);
    boolean existsByCursusIdAndBlocId(Long cursusId, Long blocId);
    boolean existsByMoniteurId(Long moniteurId);
}
