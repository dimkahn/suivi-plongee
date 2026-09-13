import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const gardeConnecte: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.connecte() || inject(Router).createUrlTree(['/connexion']);
};

/**
 * Confort d'affichage, pas une mesure de sécurité : l'autorisation réelle
 * est portée par les @PreAuthorize du serveur.
 */
export const gardeMoniteur: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estMoniteur() || inject(Router).createUrlTree(['/cursus']);
};

/**
 * Confort d'affichage, pas une mesure de sécurité : l'autorisation réelle
 * est portée par les @PreAuthorize du serveur.
 */
export const gardeAdmin: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estAdmin() || inject(Router).createUrlTree(['/cursus']);
};

/** Encadrants au sens large : moniteurs et administrateurs. */
export const gardeEncadrant: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estMoniteur() || auth.estAdmin() || inject(Router).createUrlTree(['/cursus']);
};
