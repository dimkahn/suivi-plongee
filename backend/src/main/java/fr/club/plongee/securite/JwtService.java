package fr.club.plongee.securite;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class JwtService {

    private final SecretKey cle;
    private final Duration dureeAcces;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.duree-acces-minutes}") long minutes) {
        this.cle = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.dureeAcces = Duration.ofMinutes(minutes);
    }

    public String genererAcces(UtilisateurPrincipal principal) {
        Instant maintenant = Instant.now();
        List<String> roles = principal.getAuthorities().stream()
                .map(a -> a.getAuthority()).toList();
        return Jwts.builder()
                .subject(principal.email())
                .claim("uid", principal.id())
                .claim("roles", roles)
                .claim("niveau", principal.niveauEncadrement() == null
                        ? null : principal.niveauEncadrement().name())
                .issuedAt(Date.from(maintenant))
                .expiration(Date.from(maintenant.plus(dureeAcces)))
                .signWith(cle)
                .compact();
    }

    /** Renvoie l'email porte par le jeton, ou null si le jeton est invalide ou expire. */
    public String emailSiValide(String jeton) {
        try {
            Claims claims = Jwts.parser().verifyWith(cle).build()
                    .parseSignedClaims(jeton).getPayload();
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public long dureeAccesSecondes() {
        return dureeAcces.toSeconds();
    }
}
