import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const jeton = auth.jeton;

  const envoyee = jeton
    ? requete.clone({ setHeaders: { Authorization: `Bearer ${jeton}` } })
    : requete;

  return suivant(envoyee).pipe(
    catchError((erreur: HttpErrorResponse) => {
      const surAuth = requete.url.includes('/api/auth/');
      if (erreur.status !== 401 || surAuth) return throwError(() => erreur);

      // Le jeton d'accès (30 min) a expiré : on tente un rafraîchissement
      // silencieux via le cookie avant de déconnecter — sinon « se souvenir
      // de moi » ne servirait à rien au-delà de 30 min d'usage continu.
      return auth.rafraichirPartage().pipe(
        switchMap(session => suivant(requete.clone({
          setHeaders: { Authorization: `Bearer ${session.jetonAcces}` }
        }))),
        catchError(() => {
          auth.session.set(null);
          router.navigate(['/connexion'], { queryParams: { retour: router.url } });
          return throwError(() => erreur);
        })
      );
    })
  );
};
