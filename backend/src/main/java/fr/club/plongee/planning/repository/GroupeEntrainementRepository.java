package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.GroupeEntrainement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupeEntrainementRepository extends JpaRepository<GroupeEntrainement, Long> {

    @Query("""
           select g from GroupeEntrainement g
            where g.saison.id = :saisonId
            order by g.ordre, g.id
           """)
    List<GroupeEntrainement> parSaison(@Param("saisonId") Long saisonId);

    /** Le groupe d'un élève sur une saison : au plus un (règle de GroupeEntrainementService). */
    @Query("""
           select g.id from GroupeEntrainement g join g.eleves e
            where g.saison.id = :saisonId and e.id = :eleveId
           """)
    List<Long> groupeDeLEleve(@Param("saisonId") Long saisonId, @Param("eleveId") Long eleveId);

    @Query("""
           select count(g) > 0 from GroupeEntrainement g join g.espacesAttitres e
            where e.id = :espaceId
           """)
    boolean existsByEspaceAttitre(@Param("espaceId") Long espaceId);
}
