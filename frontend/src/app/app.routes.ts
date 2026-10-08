import { Routes } from '@angular/router';
import { gardeAdmin, gardeConnecte, gardeEncadrant, gardeInspectionBlocs, gardeMateriel, gardeSorties } from './core/gardes';

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
    path: 'seances/:id/programme',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/seances/programme-exercices.component')
      .then(m => m.ProgrammeExercicesComponent)
  },
  // Anciennes adresses, avant le passage des séances dans l'administration.
  { path: 'seances', pathMatch: 'full', redirectTo: 'admin/seances' },
  { path: 'seances/generer', pathMatch: 'full', redirectTo: 'admin/seances/generer' },
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
    path: 'planning',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/planning/planning.component')
      .then(m => m.PlanningComponent)
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
    path: 'admin/exercices',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/exercices-admin.component')
      .then(m => m.ExercicesAdminComponent)
  },
  {
    path: 'admin/groupes-entrainement',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/groupes-entrainement.component')
      .then(m => m.GroupesEntrainementComponent)
  },
  {
    path: 'admin/planning',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/planning-admin.component')
      .then(m => m.PlanningAdminComponent)
  },
  {
    path: 'admin/sorties',
    canActivate: [gardeConnecte, gardeSorties],
    loadComponent: () => import('./features/admin/sorties.component')
      .then(m => m.SortiesComponent)
  },
  {
    path: 'admin/seances',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/seances/seances.component')
      .then(m => m.SeancesComponent)
  },
  {
    path: 'admin/seances/generer',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/seances/generation-saison.component')
      .then(m => m.GenerationSaisonComponent)
  },
  {
    path: 'admin/progressions',
    canActivate: [gardeConnecte, gardeAdmin],
    loadComponent: () => import('./features/admin/progressions-admin.component')
      .then(m => m.ProgressionsAdminComponent)
  },
  {
    path: 'materiel',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/inventaire.component')
      .then(m => m.InventaireComponent)
  },
  {
    path: 'materiel/prets',
    canActivate: [gardeConnecte, gardeMateriel],
    loadComponent: () => import('./features/materiel/prets.component')
      .then(m => m.PretsComponent)
  },
  {
    path: 'materiel/etiquettes',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/etiquettes.component')
      .then(m => m.EtiquettesMaterielComponent)
  },
  {
    path: 'materiel/scanner',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/scanner.component')
      .then(m => m.ScannerMaterielComponent)
  },
  {
    path: 'materiel/tiv/:inspectionId',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/rapport-inspection-tiv.component')
      .then(m => m.RapportInspectionTivComponent)
  },
  {
    path: 'materiel/:id/tiv',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/saisie-inspection-tiv.component')
      .then(m => m.SaisieInspectionTivComponent)
  },
  {
    path: 'materiel/:id',
    canActivate: [gardeConnecte, gardeInspectionBlocs],
    loadComponent: () => import('./features/materiel/fiche-equipement.component')
      .then(m => m.FicheEquipementComponent)
  },
  {
    path: 'trombinoscope',
    canActivate: [gardeConnecte, gardeEncadrant],
    loadComponent: () => import('./features/roster/trombinoscope.component')
      .then(m => m.TrombinoscopeComponent)
  },
  // Page publique : les vidéos d'aide se regardent sans compte.
  {
    path: 'videos',
    loadComponent: () => import('./features/videos/videos.component')
      .then(m => m.VideosComponent)
  },
  // Page publique aussi : les questions fréquentes, un manuel par écran.
  {
    path: 'aide',
    loadComponent: () => import('./features/aide/aide.component')
      .then(m => m.AideComponent)
  },
  { path: '**', redirectTo: '' }
];
