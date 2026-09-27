package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.AffectationGroupe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AffectationGroupeRepository extends JpaRepository<AffectationGroupe, Long> {

    @Query("""
           select a from AffectationGroupe a
             join fetch a.groupe g
             left join fetch a.espace
            where g.saison.id = :saisonId
           """)
    List<AffectationGroupe> parSaison(@Param("saisonId") Long saisonId);

    Optional<AffectationGroupe> findByGroupeIdAndDateSoiree(Long groupeId, LocalDate dateSoiree);
}
