package fr.club.plongee.evaluation.repository;

import fr.club.plongee.evaluation.domain.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {

    java.util.Optional<Evaluation> findByReferenceClient(String referenceClient);

    boolean existsByMoniteurId(Long moniteurId);
    boolean existsByCursusId(Long cursusId);
    boolean existsBySeanceId(Long seanceId);

    /** Feuille de présence : [cursusId, nombre de notes] des élèves notés sur cette séance. */
    @Query("""
           select e.cursus.id, count(e) from Evaluation e
            where e.seance.id = :seanceId
            group by e.cursus.id
           """)
    List<Object[]> compterParCursusPourSeance(@Param("seanceId") Long seanceId);
    boolean existsByCritereId(Long critereId);
    boolean existsByCritere_BlocId(Long blocId);
    boolean existsByExerciceId(Long exerciceId);

    /** Dernière note d'un critère dans un suivi (milieu naturel ou entraînement). */
    java.util.Optional<Evaluation> findFirstByCursusIdAndCritereIdAndEntrainementOrderByIdDesc(
            Long cursusId, Long critereId, boolean entrainement);

    /**
     * Etat courant de la grille : la derniere evaluation saisie pour chaque critere.
     * La table etant en ajout seul, le plus grand id est le plus recent.
     * Les notes d'entrainement (N2/N3 en piscine ou fosse) n'en font pas partie.
     */
    default List<Evaluation> etatCourant(Long cursusId) {
        return derniereParCritere(cursusId, false);
    }

    /** Etat courant du suivi d'entrainement en piscine et fosse (N2/N3). */
    default List<Evaluation> etatEntrainement(Long cursusId) {
        return derniereParCritere(cursusId, true);
    }

    @Query("""
           select e from Evaluation e
             join fetch e.critere c
             join fetch e.moniteur m
             left join fetch e.exercice x
            where e.id in (
                  select max(e2.id) from Evaluation e2
                   where e2.cursus.id = :cursusId and e2.entrainement = :entrainement
                   group by e2.critere.id)
           """)
    List<Evaluation> derniereParCritere(@Param("cursusId") Long cursusId,
                                        @Param("entrainement") boolean entrainement);

    /** Historique complet d'un critere, du plus ancien au plus recent. */
    @Query("""
           select e from Evaluation e
             join fetch e.moniteur m
             left join fetch e.exercice x
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
             left join fetch e.exercice x
            where e.cursus.id = :cursusId
            order by e.critere.id, e.saisiLe
           """)
    List<Evaluation> historiqueCursus(@Param("cursusId") Long cursusId);

    @Query("""
           select count(e) from Evaluation e
            where e.cursus.id = :cursusId
              and e.critere.bloc.id = :blocId
              and e.statut = fr.club.plongee.evaluation.domain.StatutAcquisition.ACQUIS
              and e.id in (select max(e2.id) from Evaluation e2
                            where e2.cursus.id = :cursusId and e2.entrainement = false
                            group by e2.critere.id)
           """)
    long compterAcquisDuBloc(@Param("cursusId") Long cursusId, @Param("blocId") Long blocId);
}
