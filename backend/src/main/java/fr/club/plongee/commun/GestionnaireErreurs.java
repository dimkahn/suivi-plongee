package fr.club.plongee.commun;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GestionnaireErreurs {

    private static final Logger log = LoggerFactory.getLogger(GestionnaireErreurs.class);

    @ExceptionHandler(RessourceIntrouvableException.class)
    ProblemDetail introuvable(RessourceIntrouvableException e) {
        return probleme(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(RegleMetierException.class)
    ProblemDetail regleMetier(RegleMetierException e) {
        return probleme(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail accesRefuse(AccessDeniedException e) {
        return probleme(HttpStatus.FORBIDDEN,
                "Vous n'avez pas les droits necessaires pour cette action.");
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail authentification(AuthenticationException e) {
        return probleme(HttpStatus.UNAUTHORIZED, "Identifiants invalides ou session expiree.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail validation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " : " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return probleme(HttpStatus.BAD_REQUEST, detail);
    }

    /**
     * Filet de sécurité : sans ceci, une exception non prévue remonte non
     * traitée jusqu'au conteneur, qui la transforme en page d'erreur "/error" ;
     * or JwtAuthFilter (comme tout OncePerRequestFilter) ne s'exécute pas sur
     * ce forward interne, donc "/error" est vu comme non authentifié et
     * répond 401 au lieu du vrai 500 — un diagnostic très trompeur en prod.
     */
    @ExceptionHandler(Exception.class)
    ProblemDetail interne(Exception e) {
        log.error("Erreur non prevue", e);
        return probleme(HttpStatus.INTERNAL_SERVER_ERROR,
                "Une erreur inattendue est survenue. Réessayez ou contactez un administrateur.");
    }

    private ProblemDetail probleme(HttpStatus statut, String detail) {
        ProblemDetail p = ProblemDetail.forStatus(statut);
        p.setTitle(statut.getReasonPhrase());
        p.setDetail(detail);
        return p;
    }
}
