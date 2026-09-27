package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.SoireePlanning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SoireePlanningRepository extends JpaRepository<SoireePlanning, Long> {

    @Query("""
           select s from SoireePlanning s
             left join fetch s.responsable
            where s.saison.id = :saisonId
           """)
    List<SoireePlanning> parSaison(@Param("saisonId") Long saisonId);

    Optional<SoireePlanning> findBySaisonIdAndDateSoiree(Long saisonId, LocalDate dateSoiree);
}
