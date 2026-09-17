package fr.club.plongee.formation.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import fr.club.plongee.formation.domain.Saison;

import java.util.Optional;

public interface SaisonRepository extends JpaRepository<Saison, Long> {
    Optional<Saison> findFirstByOuverteTrueOrderByDateDebutDesc();
}
