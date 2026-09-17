package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.Participation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ParticipationRepository extends JpaRepository<Participation, Long> {

    List<Participation> findByCursusId(Long cursusId);

    Optional<Participation> findByCursusIdAndSeanceId(Long cursusId, Long seanceId);
    boolean existsBySeanceId(Long seanceId);

    /** Le « NB seances bloc » du tableur, calcule au lieu d'etre saisi. */
    @Query("""
           select count(p) from Participation p
            where p.cursus.id = :cursusId
              and p.statut = 'PRESENT'
              and p.atelier = :atelier
           """)
    long compterAtelier(@Param("cursusId") Long cursusId,
                        @Param("atelier") Participation.Atelier atelier);
}
