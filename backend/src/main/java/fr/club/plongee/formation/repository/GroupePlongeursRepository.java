package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.GroupePlongeurs;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupePlongeursRepository extends JpaRepository<GroupePlongeurs, Long> {
    List<GroupePlongeurs> findBySaisonIdOrderByNomAsc(Long saisonId);
}
