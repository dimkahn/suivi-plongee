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

    /** Séance confiée à ce compte de sécurité surface. */
    @Query("select count(u) > 0 from Utilisateur u join u.seancesSecuriteSurface s where u.id = :id and s = :seanceId")
    boolean seanceConfiee(@Param("id") Long id, @Param("seanceId") Long seanceId);

    @Query("select s from Utilisateur u join u.seancesSecuriteSurface s where u.id = :id")
    List<Long> seancesConfiees(@Param("id") Long id);
}
