package fr.club.plongee.ia.repository;

import fr.club.plongee.ia.domain.JournalIa;
import fr.club.plongee.ia.domain.TypeJournalIa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/** Journal en ajout seul : ni UPDATE ni DELETE ici. */
public interface JournalIaRepository extends JpaRepository<JournalIa, Long> {

    @Query("""
           select j from JournalIa j
             left join fetch j.auteur
            where j.session.id = :sessionId and j.id > :apres
            order by j.id
           """)
    List<JournalIa> suite(@Param("sessionId") Long sessionId, @Param("apres") long apres);

    Optional<JournalIa> findFirstBySessionIdAndTypeInOrderByIdDesc(Long sessionId, List<TypeJournalIa> types);

    boolean existsBySessionIdAndType(Long sessionId, TypeJournalIa type);

    boolean existsByTypeAndCommitSha(TypeJournalIa type, String commitSha);
}
