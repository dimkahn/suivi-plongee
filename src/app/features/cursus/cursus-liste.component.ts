import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CursusVue } from '../../core/modeles';

@Component({
  selector: 'app-cursus-liste',
  imports: [RouterLink],
  template: `
    <h1>Formations en cours</h1>
    <p class="secondaire">{{ sousTitre() }}</p>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (liste().length === 0) {
      <div class="carte vide">
        <p>Aucune formation ouverte sur cette saison.</p>
        <p class="secondaire">Un administrateur peut inscrire un élève depuis la gestion du club.</p>
      </div>
    } @else {
      @for (niveau of niveaux(); track niveau) {
        <section>
          <h2>{{ niveau }}</h2>
          <ul>
            @for (c of parNiveau(niveau); track c.id) {
              <li class="carte">
                <a [routerLink]="['/cursus', c.id]">
                  <span class="nom">{{ c.eleve }}</span>
                  <span class="secondaire">
                    {{ c.moniteurReferent ? 'Référent : ' + c.moniteurReferent : 'Sans référent' }}
                  </span>
                </a>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    section { margin-top: var(--pas-4); }
    h2 { margin-bottom: var(--pas-2); color: var(--profond); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas); }
    li a {
      display: flex; align-items: baseline; justify-content: space-between; gap: var(--pas-2);
      padding: var(--pas-2); text-decoration: none; color: inherit; min-height: 56px;
      border-radius: var(--r);
    }
    .nom { font-weight: 700; }
  `]
})
export class CursusListeComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  liste = signal<CursusVue[]>([]);
  chargement = signal(true);

  constructor() {
    // Le service retombe sur le cache local si le réseau manque : la liste
    // reste consultable au bord du bassin.
    this.api.cursus()
      .then(c => this.liste.set(c))
      .catch(() => this.liste.set([]))
      .finally(() => this.chargement.set(false));
  }

  sousTitre(): string {
    return this.auth.estMoniteur()
      ? 'Sélectionnez un élève pour ouvrir sa grille de compétences.'
      : 'Votre progression dans la formation.';
  }

  niveaux(): string[] {
    return [...new Set(this.liste().map(c => c.niveau))].sort();
  }

  parNiveau(niveau: string): CursusVue[] {
    return this.liste().filter(c => c.niveau === niveau);
  }
}
