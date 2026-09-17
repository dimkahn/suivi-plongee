package fr.club.plongee.securite.repository;

import fr.club.plongee.securite.domain.RoleNom;
import fr.club.plongee.securite.domain.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    @Query("select u from Utilisateur u where :role member of u.roles order by u.nom, u.prenom")
    List<Utilisateur> parRole(@Param("role") RoleNom role);
}
