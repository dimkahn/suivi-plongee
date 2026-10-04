package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.LiaisonSeances;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LiaisonSeancesRepository extends JpaRepository<LiaisonSeances, Long> {
    Optional<LiaisonSeances> findBySeancesId(Long seanceId);
}
