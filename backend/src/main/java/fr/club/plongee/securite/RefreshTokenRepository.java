package fr.club.plongee.securite;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByEmpreinteAndRevoqueFalse(String empreinte);

    @Modifying
    @Query("update RefreshToken t set t.revoque = true where t.utilisateur.id = :utilisateurId")
    void revoquerTout(Long utilisateurId);
}
