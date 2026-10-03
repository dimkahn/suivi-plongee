package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.ExerciceSeance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExerciceSeanceRepository extends JpaRepository<ExerciceSeance, Long> {

    /** Tous les programmes de la séance : le commun et celui de chaque groupe. */
    @Query("""
           select distinct e from ExerciceSeance e
             left join fetch e.groupe
             left join fetch e.referentiel
             left join fetch e.criteres c
             left join fetch c.bloc
            where e.seance.id = :seanceId
            order by e.ordre
           """)
    List<ExerciceSeance> deLaSeance(@Param("seanceId") Long seanceId);

    /**
     * Exercices d'une saison utiles à la fiche de suivi d'un cursus : ceux de
     * sa formation et les exercices communs, du programme commun de chaque
     * séance et de celui du groupe de l'élève ({@code groupeId} null : élève
     * rangé dans aucun groupe, programme commun seul).
     */
    @Query("""
           select distinct e from ExerciceSeance e
             join fetch e.seance s
             left join fetch e.groupe g
             left join fetch e.criteres
            where s.saison.id = :saisonId
              and (e.referentiel is null or e.referentiel.id = :referentielId)
              and (g is null or g.id = :groupeId)
            order by s.dateSeance, s.ordre, e.ordre
           """)
    List<ExerciceSeance> pourLaFiche(@Param("saisonId") Long saisonId,
                                     @Param("referentielId") Long referentielId,
                                     @Param("groupeId") Long groupeId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ExerciceSeance e where e.seance.id = :seanceId and e.groupe is null")
    void supprimerProgrammeCommun(@Param("seanceId") Long seanceId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ExerciceSeance e where e.seance.id = :seanceId and e.groupe.id = :groupeId")
    void supprimerProgrammeDuGroupe(@Param("seanceId") Long seanceId, @Param("groupeId") Long groupeId);
}
