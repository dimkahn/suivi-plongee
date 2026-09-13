package fr.club.plongee.securite;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReinitialisationMotDePasseRepository extends JpaRepository<ReinitialisationMotDePasse, Long> {
    Optional<ReinitialisationMotDePasse> findByJetonHash(String jetonHash);
}
