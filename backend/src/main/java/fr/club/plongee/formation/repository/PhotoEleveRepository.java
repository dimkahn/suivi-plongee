package fr.club.plongee.formation.repository;

import fr.club.plongee.formation.domain.PhotoEleve;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoEleveRepository extends JpaRepository<PhotoEleve, Long> {
}
