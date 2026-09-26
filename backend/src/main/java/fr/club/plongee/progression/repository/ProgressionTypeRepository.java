package fr.club.plongee.progression.repository;

import fr.club.plongee.progression.domain.ProgressionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ProgressionTypeRepository extends JpaRepository<ProgressionType, Long> {

    @Query("""
           select p from ProgressionType p
             join fetch p.referentiel r
            order by r.niveau, r.dateApplication desc, p.nom
           """)
    List<ProgressionType> listerAvecReferentiel();

    @Query("""
           select p from ProgressionType p
             join fetch p.referentiel r
             join p.saisons s
            where s.id = :saisonId
            order by r.niveau, p.nom
           """)
    List<ProgressionType> suiviesPar(Long saisonId);

    /** La progression qu'un cursus suit : celle de sa saison pour son référentiel (au plus une). */
    @Query("""
           select p from ProgressionType p
             join p.saisons s
            where s.id = :saisonId and p.referentiel.id = :referentielId
           """)
    Optional<ProgressionType> suivie(Long saisonId, Long referentielId);
}
