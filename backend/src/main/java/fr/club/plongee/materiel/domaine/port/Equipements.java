package fr.club.plongee.materiel.domaine.port;

import fr.club.plongee.materiel.domaine.Equipement;

import java.util.List;
import java.util.Optional;

/** L'inventaire du matériel. */
public interface Equipements {

    Optional<Equipement> findById(Long id);

    boolean existsById(Long id);

    List<Equipement> findAllById(Iterable<Long> ids);

    /** Par type puis référence. */
    List<Equipement> findAllByOrderByTypeAscReferenceAsc();

    boolean existsByReferenceIgnoreCase(String reference);

    Optional<Equipement> findFirstByReferenceIgnoreCase(String reference);

    boolean existsByReferenceIgnoreCaseAndIdNot(String reference, Long id);

    <S extends Equipement> S save(S equipement);

    void delete(Equipement equipement);
}
