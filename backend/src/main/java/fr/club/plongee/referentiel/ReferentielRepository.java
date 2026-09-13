package fr.club.plongee.referentiel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ReferentielRepository extends JpaRepository<Referentiel, Long> {

    List<Referentiel> findByActifTrueOrderByNiveau();

    @Query("""
           select r from Referentiel r
            where r.niveau = :niveau and r.actif = true
            order by r.dateApplication desc
           """)
    List<Referentiel> versionsActives(Niveau niveau);

    default Optional<Referentiel> versionCourante(Niveau niveau) {
        return versionsActives(niveau).stream().findFirst();
    }
}
