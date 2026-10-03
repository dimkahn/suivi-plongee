package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.ExerciceSeance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExerciceSeanceRepository extends JpaRepository<ExerciceSeance, Long> {

    @Query("""
           select distinct e from ExerciceSeance e
             left join fetch e.referentiel
             left join fetch e.criteres c
             left join fetch c.bloc
            where e.seance.id = :seanceId
            order by e.ordre
           """)
    List<ExerciceSeance> deLaSeance(@Param("seanceId") Long seanceId);

    /**
     * Exercices d'une saison utiles à la fiche de suivi d'un cursus : ceux de
     * sa formation et les exercices communs.
     */
    @Query("""
           select distinct e from ExerciceSeance e
             join fetch e.seance s
             left join fetch e.criteres
            where s.saison.id = :saisonId
              and (e.referentiel is null or e.referentiel.id = :referentielId)
            order by s.dateSeance, s.ordre, e.ordre
           """)
    List<ExerciceSeance> pourLaFiche(@Param("saisonId") Long saisonId,
                                     @Param("referentielId") Long referentielId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ExerciceSeance e where e.seance.id = :seanceId")
    void supprimerDeLaSeance(@Param("seanceId") Long seanceId);
}
