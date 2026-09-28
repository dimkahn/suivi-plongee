package fr.club.plongee.materiel.repository;

import fr.club.plongee.materiel.domain.InterventionEquipement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/** Journal en ajout seul : ni UPDATE ni DELETE ici. */
public interface InterventionEquipementRepository extends JpaRepository<InterventionEquipement, Long> {

    @Query("""
           select i from InterventionEquipement i
             left join fetch i.saisiPar
            where i.equipement.id = :equipementId
            order by i.dateIntervention desc, i.id desc
           """)
    List<InterventionEquipement> parEquipement(@Param("equipementId") Long equipementId);

    @Query("select i from InterventionEquipement i where i.equipement.id in :ids")
    List<InterventionEquipement> parEquipements(@Param("ids") Collection<Long> ids);

    boolean existsByEquipementId(Long equipementId);
}
