package fr.club.plongee.formation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SaisonRepository extends JpaRepository<Saison, Long> {
    Optional<Saison> findFirstByOuverteTrueOrderByDateDebutDesc();
}
