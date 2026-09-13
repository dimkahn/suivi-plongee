package fr.club.plongee.formation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EleveRepository extends JpaRepository<Eleve, Long> {
    List<Eleve> findByArchiveLeIsNullOrderByNomAscPrenomAsc();
}
