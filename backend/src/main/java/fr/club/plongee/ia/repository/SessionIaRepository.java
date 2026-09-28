package fr.club.plongee.ia.repository;

import fr.club.plongee.ia.domain.SessionIa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SessionIaRepository extends JpaRepository<SessionIa, Long> {

    @Query("select s from SessionIa s join fetch s.creePar order by s.id desc")
    List<SessionIa> toutesRecentesDabord();

    boolean existsByCreeParId(Long utilisateurId);

    boolean existsByBranche(String branche);
}
