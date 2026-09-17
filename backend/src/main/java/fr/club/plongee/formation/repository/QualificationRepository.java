package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.Qualification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QualificationRepository extends JpaRepository<Qualification, Long> {
    List<Qualification> findByEleveId(Long eleveId);
    Optional<Qualification> findByEleveIdAndTypeIgnoreCase(Long eleveId, String type);
}
