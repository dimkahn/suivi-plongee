package fr.club.plongee.materiel.adaptateur.sortie.persistance;

import fr.club.plongee.materiel.domaine.Equipement;
import fr.club.plongee.materiel.domaine.port.Equipements;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

interface EquipementsJpa extends JpaRepository<Equipement, Long>, Equipements {

    @Override
    List<Equipement> findAllByOrderByTypeAscReferenceAsc();

    @Override
    boolean existsByReferenceIgnoreCase(String reference);

    @Override
    Optional<Equipement> findFirstByReferenceIgnoreCase(String reference);

    @Override
    boolean existsByReferenceIgnoreCaseAndIdNot(String reference, Long id);
}
