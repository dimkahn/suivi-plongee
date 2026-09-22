import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SeanceVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

@Component({
  selector: 'app-fiches-securite-liste',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    <h1>Fiches de sécurité</h1>
    <p class="secondaire">
      Article A322-72 du Code du sport : noms, aptitudes et fonction des
      plongeurs par palanquée, paramètres prévus et réalisés. Non obligatoire
      en piscine ou fosse de 6 m ou moins (A322-98) — cette liste ne montre
      donc que les séances en milieu naturel ou de plus de 6 m ; au DP de
      juger si une fiche reste utile pour les autres.
    </p>

    <section class="filtres">
      <div>
        <label for="filtre-date">Date</label>
        <input id="filtre-date" type="date" name="filtreDate"
               [ngModel]="filtreDate()" (ngModelChange)="filtreDate.set($event)">
      </div>
      <div>
        <label for="filtre-lieu">Lieu</label>
        <input id="filtre-lieu" type="search" name="filtreLieu" placeholder="Nom du site…"
               [ngModel]="filtreLieu()" (ngModelChange)="filtreLieu.set($event)">
      </div>
      @if (filtreDate() || filtreLieu()) {
        <button type="button" class="bouton-discret" (click)="reinitialiserFiltres()">Réinitialiser</button>
      }
    </section>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (toutes().length === 0) {
      <div class="carte vide"><p>Aucune séance concernée sur cette saison.</p></div>
    } @else if (seances().length === 0) {
      <div class="carte vide"><p>Aucune fiche ne correspond aux filtres.</p></div>
    } @else {
      <ul>
        @for (s of seances(); track s.id) {
          <li class="carte">
            <div class="ligne">
              <div class="identite">
                <span class="nom">
                  {{ s.date | dateFr }}{{ aPlusieursCeJour(s) ? ' (n° ' + s.ordre + ')' : '' }}{{ s.lieu ? ' — ' + s.lieu : '' }}
                </span>
                <span class="secondaire">
                  {{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Milieu artificiel' }}
                  {{ s.profondeurMax ? ' · ' + s.profondeurMax + ' m' : '' }}
                </span>
              </div>
              <div class="actions">
                @if (s.ficheSecurite) {
                  <span class="etiquette">Fiche enregistrée</span>
                }
                <a [routerLink]="['/fiches-securite', s.id]" class="bouton-discret">
                  {{ s.ficheSecurite ? 'Modifier la fiche' : 'Établir la fiche' }}
                </a>
                @if (s.ficheSecurite) {
                  <a [routerLink]="['/fiches-securite', s.id, 'realise']" class="bouton-discret">
                    Compléter au retour de plongée
                  </a>
                }
              </div>
            </div>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2) var(--pas-3); align-items: flex-end;
      margin: var(--pas-2) 0;
    }
    .filtres > div { min-width: 200px; flex: 1 1 200px; }
    .filtres label { display: block; margin: 0 0 4px; font-weight: 700; font-size: .9375rem; }
    .filtres input { margin: 0; width: 100%; }

    ul { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .actions { display: flex; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .etiquette {
      font-size: .8125rem; font-weight: 700; color: var(--profond);
      border: 1px solid var(--profond); border-radius: var(--r-s); padding: 2px 8px;
    }
  `]
})
export class FichesSecuriteListeComponent {
  private api = inject(ApiService);

  toutes = signal<SeanceVue[]>([]);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  filtreDate = signal('');
  filtreLieu = signal('');

  seances = computed(() => {
    const date = this.filtreDate();
    const lieu = this.normaliser(this.filtreLieu());
    return this.toutes()
      .filter(s => s.milieu === 'NATUREL' || (s.profondeurMax ?? 0) > 6)
      .filter(s => !date || s.date === date)
      .filter(s => !lieu || this.normaliser(s.lieu ?? '').includes(lieu))
      .sort((a, b) => b.date.localeCompare(a.date) || a.ordre - b.ordre);
  });

  /** Nombre de séances listées à chaque date, pour numéroter les plongées d'une journée à plusieurs séances. */
  private comptesParDate = computed(() => {
    const compte = new Map<string, number>();
    for (const s of this.seances()) {
      compte.set(s.date, (compte.get(s.date) ?? 0) + 1);
    }
    return compte;
  });

  constructor() {
    void this.charger();
  }

  aPlusieursCeJour(s: SeanceVue): boolean {
    return (this.comptesParDate().get(s.date) ?? 0) > 1;
  }

  private async charger(): Promise<void> {
    try {
      this.toutes.set(await this.api.seances());
    } catch {
      this.erreur.set('Impossible de charger les séances.');
    } finally {
      this.chargement.set(false);
    }
  }

  reinitialiserFiltres(): void {
    this.filtreDate.set('');
    this.filtreLieu.set('');
  }

  /** Casse et accents ignorés : « Blaisy » retrouve « Carrière de Blaisy » sans accent sur un clavier qui ne le tape pas facilement. */
  private normaliser(texte: string): string {
    return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }
}
