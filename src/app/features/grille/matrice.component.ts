import { Component, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { MatriceVue } from '../../core/modeles';

const LIBELLES: Record<string, string> = {
  NON_ABORDE: 'NA', EN_COURS: 'ECA', ACQUIS: 'A'
};

@Component({
  selector: 'app-matrice',
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/cursus', id()]" class="retour">&larr; Retour à la grille</a>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (matrice(); as m) {
      <h1>{{ m.eleve }}</h1>
      <p class="secondaire">Vue globale · {{ m.niveau }} · toutes les séances de la saison</p>

      <div class="tableau-scroll">
        <table>
          <thead>
            <tr>
              <th class="figee">Critère</th>
              @for (s of m.seances; track s.id) {
                <th>{{ s.date }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (ligne of m.lignes; track ligne.critereId) {
              <tr>
                <td class="figee">
                  <span class="code">{{ ligne.blocCode }}</span>
                  {{ ligne.savoirFaire }}
                </td>
                @for (s of m.seances; track s.id) {
                  <td [class]="classe(cellulePour(ligne, s.id))"
                      [title]="cellulePour(ligne, s.id) ? cellulePour(ligne, s.id)!.parQui : ''">
                    {{ libelle(cellulePour(ligne, s.id)) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour {
      display: inline-block; margin-bottom: var(--pas-2); font-size: .875rem; text-decoration: none;
    }
    h1 { margin-bottom: 2px; }
    .tableau-scroll { overflow-x: auto; margin-top: var(--pas-3); }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; }
    .figee { position: sticky; left: 0; min-width: 240px; white-space: normal; max-width: 32ch; }
    th.figee { background: var(--fond); }
    td.figee { background: var(--carte); }
    .code {
      display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem;
    }
    .cellule.encours { background: var(--en-cours-clair); color: var(--en-cours); font-weight: 700; }
    .cellule.acquis  { background: var(--acquis-clair);  color: var(--acquis);  font-weight: 700; }
    .cellule.neant   { color: var(--craie); }
  `]
})
export class MatriceComponent {
  private api = inject(ApiService);

  id = input.required<string>();

  matrice = signal<MatriceVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => this.charger());
  }

  private charger(): void {
    this.api.matrice(Number(this.id())).subscribe({
      next: m => { this.matrice.set(m); this.chargement.set(false); },
      error: () => {
        this.erreur.set("Impossible de charger la vue globale de l'élève.");
        this.chargement.set(false);
      }
    });
  }

  cellulePour(ligne: MatriceVue['lignes'][number], seanceId: number) {
    // La dernière saisie pour cette séance : une table en ajout seul peut en
    // porter plusieurs (une correction), on affiche la plus récente.
    const cellules = ligne.historique.filter(c => c.seanceId === seanceId);
    return cellules.length ? cellules[cellules.length - 1] : null;
  }

  libelle(cellule: MatriceVue['lignes'][number]['historique'][number] | null): string {
    return cellule ? (LIBELLES[cellule.statut] ?? cellule.statut) : '–';
  }

  classe(cellule: MatriceVue['lignes'][number]['historique'][number] | null): string {
    if (!cellule) return '';
    const suffixe = cellule.statut === 'ACQUIS' ? 'acquis'
      : cellule.statut === 'EN_COURS' ? 'encours' : 'neant';
    return 'cellule ' + suffixe;
  }
}
