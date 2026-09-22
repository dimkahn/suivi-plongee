import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { MatriceVue } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

const LIBELLES: Record<string, string> = {
  NON_ABORDE: 'NA', EN_COURS: 'ECA', ACQUIS: 'A'
};

@Component({
  selector: 'app-matrice',
  imports: [RouterLink, DateFrPipe],
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
                <th>{{ s.date | dateFr }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of lignesAffichees(); track item.ligne.critereId) {
              @if (item.nouveauGroupe && item.ligne.regroupement) {
                <tr class="groupe">
                  <td [attr.colspan]="1 + m.seances.length">{{ item.ligne.regroupement }}</td>
                </tr>
              }
              @if (item.nouveauBloc) {
                <tr class="bloc-titre">
                  <td [attr.colspan]="1 + m.seances.length">{{ item.ligne.blocIntitule }}</td>
                </tr>
              }
              <tr>
                <td class="figee">
                  {{ item.ligne.savoirFaire }}
                </td>
                @for (s of m.seances; track s.id) {
                  @let cellule = cellulePour(item.ligne, s.id);
                  <td [class]="classe(cellule)">
                    <span class="statut">{{ libelle(cellule) }}</span>
                    @if (cellule) {
                      <span class="moniteur">{{ cellule.parQui }}</span>
                    }
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
    tr.groupe td {
      position: sticky; left: 0; background: var(--fond); color: var(--profond);
      font-weight: 700; text-transform: uppercase; font-size: .8125rem; letter-spacing: .02em;
      border-bottom: none;
    }
    tr.bloc-titre td {
      position: sticky; left: 0; background: var(--carte); color: var(--craie);
      font-weight: 700; font-size: .8125rem; border-bottom: 1px solid var(--trait);
      padding-top: 12px;
    }
    td.cellule { min-width: 90px; }
    .statut { display: block; }
    .moniteur {
      display: block; margin-top: 2px; color: var(--craie); font-size: .75rem; font-weight: 400;
      white-space: normal;
    }
    .cellule.encours { background: var(--en-cours-clair); }
    .cellule.encours .statut { color: var(--en-cours); font-weight: 700; }
    .cellule.acquis  { background: var(--acquis-clair); }
    .cellule.acquis  .statut { color: var(--acquis); font-weight: 700; }
    .cellule.neant   .statut { color: var(--craie); }
  `]
})
export class MatriceComponent {
  private api = inject(ApiService);

  id = input.required<string>();

  matrice = signal<MatriceVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  /**
   * Le backend livre deja les lignes groupees par regroupement (etiquette
   * "Commun"/"PA20"/"PE40"...) : on repere juste ici ou inserer un titre de
   * groupe, au premier changement de valeur.
   */
  lignesAffichees = computed(() => {
    const m = this.matrice();
    if (!m) return [];
    let regroupementPrecedent: string | null | undefined;
    let blocPrecedent: string | undefined;
    return m.lignes.map(ligne => {
      const nouveauGroupe = ligne.regroupement !== regroupementPrecedent;
      const nouveauBloc = nouveauGroupe || ligne.blocIntitule !== blocPrecedent;
      regroupementPrecedent = ligne.regroupement;
      blocPrecedent = ligne.blocIntitule;
      return { ligne, nouveauGroupe, nouveauBloc };
    });
  });

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
    if (!cellule) return 'cellule';
    const suffixe = cellule.statut === 'ACQUIS' ? 'acquis'
      : cellule.statut === 'EN_COURS' ? 'encours' : 'neant';
    return 'cellule ' + suffixe;
  }
}
