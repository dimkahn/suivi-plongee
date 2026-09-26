package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.AdhesionSaison;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AdhesionSaisonRepository extends JpaRepository<AdhesionSaison, Long> {

    @Query("""
           select a from AdhesionSaison a
             join fetch a.eleve e
             join fetch a.saison s
            where a.saison.id = :saisonId
            order by e.nom, e.prenom
           """)
    List<AdhesionSaison> parSaison(@Param("saisonId") Long saisonId);

    @Query("""
           select a from AdhesionSaison a
             join fetch a.saison s
            where a.eleve.id = :eleveId
            order by s.dateDebut desc
           """)
    List<AdhesionSaison> parEleve(@Param("eleveId") Long eleveId);

    @Query("""
           select a from AdhesionSaison a
             join fetch a.eleve e
             join fetch a.saison s
           """)
    List<AdhesionSaison> toutesAvecEleveEtSaison();

    Optional<AdhesionSaison> findByEleveIdAndSaisonId(Long eleveId, Long saisonId);

    boolean existsByEleveIdAndSaisonId(Long eleveId, Long saisonId);
}
