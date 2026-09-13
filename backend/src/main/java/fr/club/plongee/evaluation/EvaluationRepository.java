package fr.club.plongee.evaluation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {

    java.util.Optional<Evaluation> findByReferenceClient(String referenceClient);

    boolean existsByMoniteurId(Long moniteurId);
    boolean existsBySeanceId(Long seanceId);

    /**
     * Etat courant de la grille : la derniere evaluation saisie pour chaque critere.
     * La table etant en ajout seul, le plus grand id est le plus recent.
     */
    @Query("""
           select e from Evaluation e
             join fetch e.critere c
             join fetch e.moniteur m
            where e.id in (
                  select max(e2.id) from Evaluation e2
                   where e2.cursus.id = :cursusId
                   group by e2.critere.id)
           """)
    List<Evaluation> etatCourant(@Param("cursusId") Long cursusId);

    /** Historique complet d'un critere, du plus ancien au plus recent. */
    @Query("""
           select e from Evaluation e
             join fetch e.moniteur m
            where e.cursus.id = :cursusId and e.critere.id = :critereId
            order by e.saisiLe
           """)
    List<Evaluation> historique(@Param("cursusId") Long cursusId,
                                @Param("critereId") Long critereId);

    /**
     * Historique complet de tous les criteres d'un cursus, pour la vue
     * globale d'un eleve (une colonne par seance, comme l'onglet individuel
     * du tableur qu'elle remplace).
     */
    @Query("""
           select e from Evaluation e
             join fetch e.moniteur m
             left join fetch e.seance s
            where e.cursus.id = :cursusId
            order by e.critere.id, e.saisiLe
           """)
    List<Evaluation> historiqueCursus(@Param("cursusId") Long cursusId);

    @Query("""
           select count(e) from Evaluation e
            where e.cursus.id = :cursusId
              and e.critere.bloc.id = :blocId
              and e.statut = fr.club.plongee.evaluation.StatutAcquisition.ACQUIS
              and e.id in (select max(e2.id) from Evaluation e2
                            where e2.cursus.id = :cursusId group by e2.critere.id)
           """)
    long compterAcquisDuBloc(@Param("cursusId") Long cursusId, @Param("blocId") Long blocId);
}
