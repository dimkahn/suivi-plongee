package fr.club.plongee.securite.repository;

import fr.club.plongee.securite.domain.PhotoUtilisateur;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PhotoUtilisateurRepository extends JpaRepository<PhotoUtilisateur, Long> {
}
