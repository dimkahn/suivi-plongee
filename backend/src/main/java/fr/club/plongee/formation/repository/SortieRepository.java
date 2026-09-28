package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.Sortie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface SortieRepository extends JpaRepository<Sortie, Long> {

    @Query("""
           select distinct s from Sortie s left join fetch s.seances
            where s.dateFin >= :depuis
            order by s.dateDebut, s.id
           """)
    List<Sortie> depuis(@Param("depuis") LocalDate depuis);

    @Query("select distinct s from Sortie s left join fetch s.seances order by s.dateDebut desc, s.id desc")
    List<Sortie> toutes();

    /** La sortie de chaque séance donnée qui en a une. */
    @Query("select s from Sortie s join s.seances se where se.id in :seanceIds")
    List<Sortie> contenant(@Param("seanceIds") Collection<Long> seanceIds);
}
