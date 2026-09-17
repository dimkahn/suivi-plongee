import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SeanceVue } from '../../core/modeles';

@Component({
  selector: 'app-fiches-securite-liste',
  imports: [RouterLink],
  template: `
    <h1>Fiches de sécurité</h1>
    <p class="secondaire">
      Article A322-72 du Code du sport : noms, aptitudes et fonction des
      plongeurs par palanquée, paramètres prévus et réalisés. Non obligatoire
      en piscine ou fosse de 6 m ou moins (A322-98) — cette liste ne montre
      donc que les séances en milieu naturel ou de plus de 6 m ; au DP de
      juger si une fiche reste utile pour les autres.
    </p>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (seances().length === 0) {
      <div class="carte vide"><p>Aucune séance concernée sur cette saison.</p></div>
    } @else {
      <ul>
        @for (s of seances(); track s.id) {
          <li class="carte">
            <div class="ligne">
              <div class="identite">
                <span class="nom">{{ s.date }}{{ s.lieu ? ' — ' + s.lieu : '' }}</span>
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
    ul { list-style: none; margin: var(--pas-3) 0 0; padding: 0; display: grid; gap: var(--pas-2); }
    li { padding: var(--pas-2); }
    .ligne { display: flex; justify-content: space-between; align-items: center; gap: var(--pas-2); flex-wrap: wrap; }
    .identite { display: flex; flex-direction: column; gap: 2px; }
    .nom { font-weight: 700; }
    .actions { display: flex; align-items: center; gap: var(--pas-2); }
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

  seances = computed(() =>
    this.toutes()
      .filter(s => s.milieu === 'NATUREL' || (s.profondeurMax ?? 0) > 6)
      .sort((a, b) => b.date.localeCompare(a.date)));

  constructor() {
    void this.charger();
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
}
