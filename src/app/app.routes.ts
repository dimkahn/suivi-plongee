import { Routes } from '@angular/router';
import { gardeConnecte } from './core/gardes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cursus' },
  {
    path: 'connexion',
    loadComponent: () => import('./features/connexion/connexion.component')
      .then(m => m.ConnexionComponent)
  },
  {
    path: 'cursus',
    canActivate: [gardeConnecte],
    loadComponent: () => import('./features/cursus/cursus-liste.component')
      .then(m => m.CursusListeComponent)
  },
  {
    path: 'cursus/:id',
    canActivate: [gardeConnecte],
    loadComponent: () => import('./features/grille/grille.component')
      .then(m => m.GrilleComponent)
  },
  { path: '**', redirectTo: 'cursus' }
];
