package fr.club.plongee.materiel.adaptateur.sortie.persistance;

import fr.club.plongee.materiel.domaine.InspectionTiv;
import fr.club.plongee.materiel.domaine.port.InspectionsTiv;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** En ajout seul, comme le journal : ni UPDATE ni DELETE ici. */
interface InspectionsTivJpa extends JpaRepository<InspectionTiv, Long>, InspectionsTiv {

    @Override
    @Query("""
           select t from InspectionTiv t
             join fetch t.intervention i
             join fetch i.equipement
             left join fetch i.saisiPar
            where t.id = :id
           """)
    Optional<InspectionTiv> detail(@Param("id") Long id);

    @Override
    @Query("select t from InspectionTiv t where t.intervention.id in :interventionIds")
    List<InspectionTiv> parInterventions(@Param("interventionIds") Collection<Long> interventionIds);

    @Override
    Optional<InspectionTiv> findFirstByInterventionEquipementIdOrderByIdDesc(Long equipementId);

    @Override
    Optional<InspectionTiv> findFirstByInterventionSaisiParIdOrderByIdDesc(Long utilisateurId);
}
