package fr.club.plongee.formation.repository;

import fr.club.plongee.commun.Calendrier;
import fr.club.plongee.formation.domain.Participation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ParticipationRepository extends JpaRepository<Participation, Long> {

    List<Participation> findByCursusId(Long cursusId);
    List<Participation> findBySeanceId(Long seanceId);

    Optional<Participation> findByCursusIdAndSeanceId(Long cursusId, Long seanceId);
    boolean existsBySeanceId(Long seanceId);
    boolean existsByCursusId(Long cursusId);

    /**
     * Le « NB seances bloc » du tableur, calcule au lieu d'etre saisi. Seules
     * comptent les seances deja passees : une presence annoncee a l'avance
     * (jusqu'a une semaine) n'est pas encore une seance faite.
     */
    default long compterAtelier(Long cursusId, Participation.Atelier atelier) {
        return compterAtelierJusquAu(cursusId, atelier, Calendrier.aujourdhui());
    }

    @Query("""
           select count(p) from Participation p
            where p.cursus.id = :cursusId
              and p.statut = 'PRESENT'
              and p.atelier = :atelier
              and p.seance.dateSeance <= :jusquAu
           """)
    long compterAtelierJusquAu(@Param("cursusId") Long cursusId,
                               @Param("atelier") Participation.Atelier atelier,
                               @Param("jusquAu") LocalDate jusquAu);

    /** Séances de la saison où l'élève est noté présent : les seules où on peut l'évaluer. */
    @Query("""
           select p.seance.id from Participation p
            where p.cursus.id = :cursusId
              and p.statut = 'PRESENT'
           """)
    List<Long> seancesOuPresent(@Param("cursusId") Long cursusId);
}
