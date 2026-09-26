package fr.club.plongee.progression.repository;

import fr.club.plongee.progression.domain.ProgressionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

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
}
