package fr.club.plongee.delivrance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DelivranceRepository extends JpaRepository<Delivrance, Long> {

    Optional<Delivrance> findByCursusId(Long cursusId);
    boolean existsByDelivreParId(Long delivreParId);

    /** Les N1 dont les 4 plongees en milieu naturel arrivent a echeance. */
    @Query("""
           select d from Delivrance d
             join fetch d.cursus c
             join fetch c.eleve e
            where d.plongeesMilieuNaturelAFaire > 0
              and d.echeancePlongees <= :limite
            order by d.echeancePlongees
           """)
    List<Delivrance> echeancesProches(@Param("limite") LocalDate limite);
}
