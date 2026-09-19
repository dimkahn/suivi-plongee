import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
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
      if (erreur.status === 401 && !surAuth) {
        auth.session.set(null);
        router.navigate(['/connexion'], { queryParams: { retour: router.url } });
      }
      return throwError(() => erreur);
    })
  );
};
