package fr.club.plongee.materiel.repository;

import fr.club.plongee.materiel.domain.Equipement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EquipementRepository extends JpaRepository<Equipement, Long> {

    List<Equipement> findAllByOrderByTypeAscReferenceAsc();

    boolean existsByReferenceIgnoreCase(String reference);

    Optional<Equipement> findFirstByReferenceIgnoreCase(String reference);

    boolean existsByReferenceIgnoreCaseAndIdNot(String reference, Long id);
}
