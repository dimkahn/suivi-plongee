package fr.club.plongee.planning.repository;

import fr.club.plongee.planning.domain.GroupeEntrainement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupeEntrainementRepository extends JpaRepository<GroupeEntrainement, Long> {

    @Query("""
           select g from GroupeEntrainement g
             left join fetch g.espaceAttitre
            where g.saison.id = :saisonId
            order by g.ordre, g.id
           """)
    List<GroupeEntrainement> parSaison(@Param("saisonId") Long saisonId);

    boolean existsByEspaceAttitreId(Long espaceId);
}
