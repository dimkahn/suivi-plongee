package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.DisponibiliteEncadrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DisponibiliteEncadrantRepository extends JpaRepository<DisponibiliteEncadrant, Long> {

    @Query("""
           select d from DisponibiliteEncadrant d
             join fetch d.utilisateur
            where d.saison.id = :saisonId
           """)
    List<DisponibiliteEncadrant> parSaison(@Param("saisonId") Long saisonId);

    Optional<DisponibiliteEncadrant> findByUtilisateurIdAndDateSoiree(Long utilisateurId, LocalDate dateSoiree);
}
