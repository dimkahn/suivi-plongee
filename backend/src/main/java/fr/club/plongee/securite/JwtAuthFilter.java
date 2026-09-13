package fr.club.plongee.securite;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final DetailsUtilisateurService detailsService;

    public JwtAuthFilter(JwtService jwtService, DetailsUtilisateurService detailsService) {
        this.jwtService = jwtService;
        this.detailsService = detailsService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest requete,
                                    @NonNull HttpServletResponse reponse,
                                    @NonNull FilterChain chaine) throws ServletException, IOException {
        String entete = requete.getHeader("Authorization");
        if (entete != null && entete.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String email = jwtService.emailSiValide(entete.substring(7));
            if (email != null) {
                try {
                    UtilisateurPrincipal principal = detailsService.loadUserByUsername(email);
                    if (principal.isEnabled()) {
                        var auth = new UsernamePasswordAuthenticationToken(
                                principal, null, principal.getAuthorities());
                        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(requete));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                } catch (Exception ignore) {
                    // compte supprime ou desactive : la requete continue en anonyme
                }
            }
        }
        chaine.doFilter(requete, reponse);
    }
}
