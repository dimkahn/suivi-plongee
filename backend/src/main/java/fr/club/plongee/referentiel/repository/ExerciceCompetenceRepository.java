package fr.club.plongee.referentiel.repository;

import fr.club.plongee.referentiel.domain.ExerciceCompetence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ExerciceCompetenceRepository extends JpaRepository<ExerciceCompetence, Long> {

    /** Toute la base d'une version du MFT, désactivés compris, compétence par compétence. */
    @Query("""
           select e from ExerciceCompetence e
             join fetch e.bloc b
            where b.referentiel.id = :referentielId
            order by b.ordre, e.ordre, e.numero
           """)
    List<ExerciceCompetence> parReferentiel(Long referentielId);

    /** Une compétence qui a au moins un exercice actif ne s'acquiert que sur un exercice de maîtrise. */
    boolean existsByBlocIdAndActifTrue(Long blocId);

    boolean existsByBlocIdAndNumero(Long blocId, String numero);
}
