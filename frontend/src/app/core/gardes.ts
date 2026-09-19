import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Attend que {@link AuthService.sessionResolue} passe à `true` avant de
 * statuer : au chargement de l'application, la navigation initiale peut
 * s'exécuter avant que `/api/auth/rafraichir` ait répondu, et `connecte()`
 * vaut alors toujours `false` même si la session est en réalité valide.
 */
function apresResolutionSession() {
  const auth = inject(AuthService);
  return toObservable(auth.sessionResolue).pipe(filter(resolue => resolue), take(1));
}

export const gardeConnecte: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return apresResolutionSession().pipe(
    map(() => auth.connecte()
      || router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } }))
  );
};

/**
 * Confort d'affichage, pas une mesure de sécurité : l'autorisation réelle
 * est portée par les @PreAuthorize du serveur. Attend aussi la résolution de
 * la session, pour la même raison que {@link gardeConnecte} : ces rôles
 * dépendent de `session()`, pas encore renseignée à la navigation initiale.
 */
export const gardeMoniteur: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return apresResolutionSession().pipe(
    map(() => auth.estMoniteur() || router.createUrlTree(['/cursus']))
  );
};

/**
 * Confort d'affichage, pas une mesure de sécurité : l'autorisation réelle
 * est portée par les @PreAuthorize du serveur.
 */
export const gardeAdmin: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return apresResolutionSession().pipe(
    map(() => auth.estAdmin() || router.createUrlTree(['/cursus']))
  );
};

/** Encadrants au sens large : moniteurs et administrateurs. */
export const gardeEncadrant: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return apresResolutionSession().pipe(
    map(() => auth.estMoniteur() || auth.estAdmin() || router.createUrlTree(['/cursus']))
  );
};
