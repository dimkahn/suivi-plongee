package fr.club.plongee.referentiel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReferentielRepository extends JpaRepository<Referentiel, Long> {

    List<Referentiel> findByActifTrueOrderByNiveau();

    /**
     * Charge les blocs (LAZY) en une requête ; les critères de chaque bloc,
     * eux, restent chargés à la demande (deux collections en `List` ne se
     * fetch-joignent pas ensemble : MultipleBagFetchException). Le contrôleur
     * reste dans une transaction en lecture pour que cet accès ultérieur
     * fonctionne malgré `open-in-view: false`.
     */
    @Query("""
           select distinct r from Referentiel r
             left join fetch r.blocs
            where r.id = :id
           """)
    Optional<Referentiel> chargerComplet(@Param("id") Long id);

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
