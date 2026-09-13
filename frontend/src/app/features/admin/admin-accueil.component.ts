import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-accueil',
  imports: [RouterLink],
  template: `
    <h1>Administration</h1>
    <p class="secondaire">Gestion du club : comptes, élèves, saisons et inscriptions.</p>

    <ul>
      <li class="carte">
        <a routerLink="/admin/moniteurs">
          <span class="nom">Moniteurs</span>
          <span class="secondaire">Comptes des encadrants : ajout, activation, mot de passe</span>
        </a>
      </li>
      <li class="carte">
        <a routerLink="/admin/eleves">
          <span class="nom">Élèves</span>
          <span class="secondaire">Dossiers, autorisations, droit à l'image</span>
        </a>
      </li>
      <li class="carte">
        <a routerLink="/admin/saisons">
          <span class="nom">Saisons</span>
          <span class="secondaire">Ouverture et fermeture des saisons</span>
        </a>
      </li>
      <li class="carte">
        <a routerLink="/admin/cursus">
          <span class="nom">Inscriptions</span>
          <span class="secondaire">Inscrire un élève dans une formation, changer de référent</span>
        </a>
      </li>
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    ul { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    li a {
      display: flex; flex-direction: column; gap: 2px; padding: var(--pas-2);
      text-decoration: none; color: inherit; min-height: 44px;
    }
    .nom { font-weight: 700; }
  `]
})
export class AdminAccueilComponent {}
