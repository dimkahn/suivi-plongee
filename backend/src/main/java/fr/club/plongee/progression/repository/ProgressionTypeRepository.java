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
}
