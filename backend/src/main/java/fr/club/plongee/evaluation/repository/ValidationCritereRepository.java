package fr.club.plongee.evaluation.repository;

import fr.club.plongee.evaluation.domain.ValidationCritere;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ValidationCritereRepository extends JpaRepository<ValidationCritere, Long> {

    @Query("""
           select v from ValidationCritere v join fetch v.moniteur
            where v.cursus.id = :cursusId
           """)
    List<ValidationCritere> duCursus(@Param("cursusId") Long cursusId);

    boolean existsByCursusIdAndCritereId(Long cursusId, Long critereId);

    boolean existsByMoniteurId(Long moniteurId);
}
