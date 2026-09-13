import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { RosterVue } from '../../core/modeles';

const LIBELLES: Record<string, string> = {
  NAGE: 'Nage', BLOC: 'Bloc', THEORIE: 'Théorie', PLONGEE: 'Plongée',
  ABSENT: 'ABS', EXCUSE: 'Excusé', PRESENT: 'Présent'
};

@Component({
  selector: 'app-roster',
  imports: [RouterLink],
  template: `
    <h1>Infos élèves</h1>
    <p class="secondaire">Vue d'ensemble de la saison : présence par séance, CACI, volume de séances.</p>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (roster(); as r) {
      <div class="tableau-scroll">
        <table>
          <thead>
            <tr>
              <th class="figee">Élève</th>
              <th>Niveau</th>
              <th>CACI</th>
              <th>Bloc</th>
              <th>Nage</th>
              @for (s of r.seances; track s.id) {
                <th>{{ s.date }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (e of r.eleves; track e.cursusId) {
              <tr>
                <td class="figee">
                  <div class="identite-cellule">
                    <a [routerLink]="['/cursus', e.cursusId]">{{ e.eleve }}</a>
                    @if (e.moniteurReferent) {
                      <span class="secondaire">{{ e.moniteurReferent }}</span>
                    }
                  </div>
                </td>
                <td>{{ e.niveau }}</td>
                <td [class.alerte-cellule]="!e.caciValide">{{ e.caciValide ? 'OK' : '⚠' }}</td>
                <td>{{ e.seancesBloc }}</td>
                <td>{{ e.seancesNage }}</td>
                @for (s of r.seances; track s.id) {
                  <td [class.absence]="e.presencesParSeance[s.id] === 'ABSENT'">
                    {{ libelle(e.presencesParSeance[s.id]) }}
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
    h1 { margin-bottom: var(--pas); }
    .tableau-scroll { overflow-x: auto; margin-top: var(--pas-3); }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; }
    .figee { position: sticky; left: 0; min-width: 160px; }
    th.figee { background: var(--fond); }
    td.figee { background: var(--carte); }
    .identite-cellule { display: flex; flex-direction: column; gap: 2px; white-space: normal; }
    .identite-cellule a { font-weight: 700; }
    .alerte-cellule { color: #B3261E; font-weight: 700; }
    .absence { color: var(--craie); }
  `]
})
export class RosterComponent {
  private api = inject(ApiService);

  roster = signal<RosterVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  constructor() {
    this.api.roster().subscribe({
      next: r => { this.roster.set(r); this.chargement.set(false); },
      error: () => {
        this.erreur.set("Impossible de charger la vue d'ensemble.");
        this.chargement.set(false);
      }
    });
  }

  libelle(code: string | undefined): string {
    if (!code) return '–';
    return LIBELLES[code] ?? code;
  }
}
