package fr.club.plongee.evaluation.repository;

import fr.club.plongee.evaluation.domain.AccordValidationCritere;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AccordValidationCritereRepository extends JpaRepository<AccordValidationCritere, Long> {

    @Query("""
           select a from AccordValidationCritere a join fetch a.moniteur
            where a.cursus.id = :cursusId
            order by a.id
           """)
    List<AccordValidationCritere> duCursus(@Param("cursusId") Long cursusId);

    boolean existsByCursusIdAndCritereIdAndMoniteurId(Long cursusId, Long critereId, Long moniteurId);

    boolean existsByMoniteurId(Long moniteurId);
}
