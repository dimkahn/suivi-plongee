package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.FicheSecurite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FicheSecuriteRepository extends JpaRepository<FicheSecurite, Long> {
    Optional<FicheSecurite> findBySeanceId(Long seanceId);
    boolean existsBySeanceId(Long seanceId);
    boolean existsByDpId(Long dpId);
}
