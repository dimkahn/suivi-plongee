package fr.club.plongee.commun;

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

    private ProblemDetail probleme(HttpStatus statut, String detail) {
        ProblemDetail p = ProblemDetail.forStatus(statut);
        p.setTitle(statut.getReasonPhrase());
        p.setDetail(detail);
        return p;
    }
}
