package fr.club.plongee.formation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeanceRepository extends JpaRepository<Seance, Long> {
    List<Seance> findBySaisonIdOrderByDateSeance(Long saisonId);
    boolean existsByDpId(Long dpId);
}
