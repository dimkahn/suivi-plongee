import { Routes } from '@angular/router';
import { gardeAdmin, gardeConnecte, gardeEncadrant } from './core/gardes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cursus' },
  {
    path: 'connexion',
    loadComponent: () => import('./features/connexion/connexion.component')
      .then(m => m.ConnexionComponent)
  },
  {
    path: 'reinitialiser-mot-de-passe',
    loadComponent: () => import('./features/connexion/reinitialisation.component')
      .then(m => m.ReinitialisationComponent)
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
  {
    path: 'cursus/:id/matrice',
    canActivate: [gardeConnecte],
    loadComponent: () => import('./features/grille/matrice.component')
      .then(m => m.MatriceComponent)
  },
  {
    path: 'eleves',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/roster/roster.component')
      .then(m => m.RosterComponent)
  },
  {
    path: 'seances/nouvelle',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/seances/seance-creation.component')
      .then(m => m.SeanceCreationComponent)
  },
  {
    path: 'admin/moniteurs',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/moniteurs.component')
      .then(m => m.MoniteursComponent)
  },
  { path: '**', redirectTo: 'cursus' }
];
