package fr.club.plongee.referentiel.repository;

import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ExerciceCompetenceRepository extends JpaRepository<ExerciceCompetence, Long> {

    /** Toute la base d'une version du MFT, désactivés compris, compétence par compétence, avec leurs critères. */
    @Query("""
           select distinct e from ExerciceCompetence e
             join fetch e.bloc b
             left join fetch e.criteres
            where b.referentiel.id = :referentielId
            order by b.ordre, e.ordre, e.numero
           """)
    List<ExerciceCompetence> parReferentiel(Long referentielId);

    /** Exercices de maîtrise actifs reliés à un critère : s'il y en a, lui seuls le font passer à acquis. */
    @Query("""
           select e from ExerciceCompetence e join e.criteres c
            where c.id = :critereId and e.actif = true
              and e.phase = fr.club.plongee.referentiel.domain.PhaseExercice.MAITRISE
            order by e.ordre, e.numero
           """)
    List<ExerciceCompetence> maitriseDuCritere(Long critereId);

    boolean existsByBlocIdAndNumero(Long blocId, String numero);
}
