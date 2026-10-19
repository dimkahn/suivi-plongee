package fr.club.plongee.evaluation.repository;

import fr.club.plongee.evaluation.domain.AccordValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AccordValidationRepository extends JpaRepository<AccordValidation, Long> {

    @Query("""
           select a from AccordValidation a join fetch a.moniteur
            where a.cursus.id = :cursusId
            order by a.id
           """)
    List<AccordValidation> duCursus(@Param("cursusId") Long cursusId);

    boolean existsByCursusIdAndBlocIdAndMoniteurId(Long cursusId, Long blocId, Long moniteurId);

    boolean existsByMoniteurId(Long moniteurId);
}
