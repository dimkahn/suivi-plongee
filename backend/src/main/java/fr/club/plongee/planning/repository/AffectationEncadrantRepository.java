package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.AffectationEncadrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AffectationEncadrantRepository extends JpaRepository<AffectationEncadrant, Long> {

    @Query("""
           select a from AffectationEncadrant a
             join fetch a.utilisateur
             join fetch a.groupe
            where a.saison.id = :saisonId
           """)
    List<AffectationEncadrant> parSaison(@Param("saisonId") Long saisonId);

    Optional<AffectationEncadrant> findByUtilisateurIdAndDateSoiree(Long utilisateurId, LocalDate dateSoiree);
}
