import { Routes } from '@angular/router';
import { gardeAdmin, gardeConnecte, gardeEncadrant } from './core/gardes';

export const routes: Routes = [
  // Page d'accueil : Infos élèves. Un compte sans rôle d'encadrant en est
  // renvoyé vers /cursus par gardeEncadrant.
  { path: '', pathMatch: 'full', redirectTo: 'eleves' },
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
    path: 'mon-compte',
    canActivate: [gardeConnecte],
    loadComponent: () => import('./features/compte/mon-compte.component')
      .then(m => m.MonCompteComponent)
  },
  {
    path: 'eleves',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/roster/roster.component')
      .then(m => m.RosterComponent)
  },
  {
    path: 'presences',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/presences/presences.component')
      .then(m => m.PresencesComponent)
  },
  {
    path: 'seances',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/seances/seances.component')
      .then(m => m.SeancesComponent)
  },
  {
    path: 'fiches-securite',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/fiche-securite/fiches-securite-liste.component')
      .then(m => m.FichesSecuriteListeComponent)
  },
  {
    path: 'fiches-securite/:id',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/fiche-securite/fiche-securite.component')
      .then(m => m.FicheSecuriteComponent)
  },
  {
    path: 'fiches-securite/:id/realise',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/fiche-securite/fiche-securite-realise.component')
      .then(m => m.FicheSecuriteRealiseComponent)
  },
  {
    path: 'groupes',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/groupes/groupes.component')
      .then(m => m.GroupesComponent)
  },
  {
    path: 'admin',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/admin-accueil.component')
      .then(m => m.AdminAccueilComponent)
  },
  {
    path: 'admin/moniteurs',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/moniteurs.component')
      .then(m => m.MoniteursComponent)
  },
  {
    path: 'admin/eleves',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/eleves.component')
      .then(m => m.ElevesComponent)
  },
  {
    path: 'admin/saisons',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/saisons.component')
      .then(m => m.SaisonsComponent)
  },
  {
    path: 'admin/cursus',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/cursus-admin.component')
      .then(m => m.CursusAdminComponent)
  },
  {
    path: 'admin/referentiel',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/referentiel-admin.component')
      .then(m => m.ReferentielAdminComponent)
  },
  {
    path: 'trombinoscope',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/roster/trombinoscope.component')
      .then(m => m.TrombinoscopeComponent)
  },
  { path: '**', redirectTo: '' }
];
