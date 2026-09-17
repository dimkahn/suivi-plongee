package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.Cursus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CursusRepository extends JpaRepository<Cursus, Long> {

    @Query("""
           select c from Cursus c
             join fetch c.eleve e
             join fetch c.referentiel r
             join fetch c.saison s
             left join fetch c.moniteurReferent m
            where c.saison.id = :saisonId
            order by r.niveau, e.nom, e.prenom
           """)
    List<Cursus> parSaison(@Param("saisonId") Long saisonId);

    @Query("""
           select c from Cursus c
             join fetch c.eleve e
             join fetch c.referentiel r
             left join fetch c.saison s
             left join fetch c.moniteurReferent m
            where c.id = :id
           """)
    Optional<Cursus> chargerComplet(@Param("id") Long id);

    /** Filtrage a la source : un eleve ne voit que ses propres cursus. */
    @Query("select c.id from Cursus c where c.eleve.utilisateur.id = :utilisateurId")
    List<Long> idsDeLEleve(@Param("utilisateurId") Long utilisateurId);

    /** Historique complet d'un élève, toutes saisons confondues, la plus récente d'abord. */
    @Query("""
           select c from Cursus c
             join fetch c.eleve e
             join fetch c.referentiel r
             join fetch c.saison s
             left join fetch c.moniteurReferent m
            where c.eleve.id = :eleveId
            order by s.dateDebut desc
           """)
    List<Cursus> parEleve(@Param("eleveId") Long eleveId);

    boolean existsByMoniteurReferentId(Long moniteurReferentId);
    boolean existsByEleveIdAndSaisonIdAndReferentielId(Long eleveId, Long saisonId, Long referentielId);
    boolean existsByEleveIdAndSaisonId(Long eleveId, Long saisonId);
    boolean existsByReferentielId(Long referentielId);
}
