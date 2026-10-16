package fr.club.plongee.materiel.repository;

import fr.club.plongee.materiel.domain.InspectionTiv;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** En ajout seul, comme le journal : ni UPDATE ni DELETE ici. */
public interface InspectionTivRepository extends JpaRepository<InspectionTiv, Long> {

    @Query("""
           select t from InspectionTiv t
             join fetch t.intervention i
             join fetch i.equipement
             left join fetch i.saisiPar
            where t.id = :id
           """)
    Optional<InspectionTiv> detail(@Param("id") Long id);

    @Query("select t from InspectionTiv t where t.intervention.id in :interventionIds")
    List<InspectionTiv> parInterventions(@Param("interventionIds") Collection<Long> interventionIds);

    /** La plus récente de ce bloc : on en reprend les filetages, qui ne changent pas d'une année à l'autre. */
    Optional<InspectionTiv> findFirstByInterventionEquipementIdOrderByIdDesc(Long equipementId);

    /** La plus récente saisie par ce compte : on en reprend le nom et le n° de TIV. */
    Optional<InspectionTiv> findFirstByInterventionSaisiParIdOrderByIdDesc(Long utilisateurId);
}
