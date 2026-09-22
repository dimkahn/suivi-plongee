package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.Eleve;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EleveRepository extends JpaRepository<Eleve, Long> {
    List<Eleve> findByArchiveLeIsNullOrderByNomAscPrenomAsc();
    List<Eleve> findByArchiveLeIsNotNullOrderByNomAscPrenomAsc();
}
