package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.PhotoEleve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Set;

public interface PhotoEleveRepository extends JpaRepository<PhotoEleve, Long> {

    /** Élèves qui ont une photo, sans charger les images : pour les listes. */
    @Query("select p.eleveId from PhotoEleve p")
    Set<Long> idsElevesAvecPhoto();
}
