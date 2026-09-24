import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CelluleMatrice, LigneMatrice, MatriceVue, SeanceEnTete } from '../../core/modeles';
import { DateFrPipe } from '../../core/date-fr';

const LIBELLES: Record<string, string> = {
  NON_ABORDE: 'NA', EN_COURS: 'ECA', ACQUIS: 'A'
};

@Component({
  selector: 'app-matrice',
  imports: [FormsModule, RouterLink, DateFrPipe],
  template: `
    <a [routerLink]="['/cursus', id()]" class="retour">&larr; Retour à la grille</a>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (matrice(); as m) {
      <h1>{{ m.eleve }}</h1>
      <p class="secondaire">Vue globale · {{ m.niveau }} · toutes les séances de la saison</p>

      <div class="options" role="group" aria-label="Affichage">
        <label class="case">
          <input type="checkbox" [ngModel]="seulementNotees()" (ngModelChange)="seulementNotees.set($event)">
          Seulement les séances où l'élève a été noté
        </label>
        <label class="case">
          <input type="checkbox" [ngModel]="seulementNonAcquis()" (ngModelChange)="seulementNonAcquis.set($event)">
          Seulement les critères non acquis
        </label>
      </div>
      <p class="legende secondaire">
        <span class="pastille acquis">A</span> acquis
        <span class="pastille encours">ECA</span> en cours d'acquisition
        <span class="pastille neant">NA</span> non abordé
        · {{ seancesAffichees().length }} séance(s) sur {{ m.seances.length }}
      </p>

      @if (lignesAffichees().length === 0) {
        <div class="carte vide"><p>Tous les critères sont acquis.</p></div>
      } @else {
      <div class="tableau-scroll">
        <table>
          <thead>
            <tr>
              <th class="figee">Critère <span class="sous-titre">· état actuel</span></th>
              @for (s of seancesAffichees(); track s.id) {
                <th class="entete-seance">
                  <span class="date-seance">{{ s.date | dateFr }}</span>
                  @if (s.lieu) { <span class="lieu-seance">{{ s.lieu }}</span> }
                  <span class="milieu-seance" [class.naturel]="s.milieu === 'NATUREL'">
                    {{ s.milieu === 'NATUREL' ? 'Naturel' : 'Piscine' }}
                  </span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of lignesAffichees(); track item.ligne.critereId) {
              @if (item.nouveauGroupe && item.ligne.regroupement) {
                <tr class="groupe">
                  <td [attr.colspan]="1 + seancesAffichees().length"><span class="titre-fige">{{ item.ligne.regroupement }}</span></td>
                </tr>
              }
              @if (item.nouveauBloc) {
                <tr class="bloc-titre">
                  <td [attr.colspan]="1 + seancesAffichees().length"><span class="titre-fige">{{ item.ligne.blocIntitule }}</span></td>
                </tr>
              }
              <tr class="critere">
                <td class="figee">
                  <div class="critere-etat">
                    <span>{{ item.ligne.savoirFaire }}</span>
                    @let actuel = etatActuel(item.ligne);
                    <span [class]="'pastille ' + suffixe(actuel)" [title]="actuel ? 'Dernière saisie le ' + (actuel.date | dateFr) + ' par ' + actuel.parQui : 'Jamais noté'">
                      {{ libelle(actuel) }}
                    </span>
                  </div>
                </td>
                @for (s of seancesAffichees(); track s.id) {
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
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour {
      display: inline-block; margin-bottom: var(--pas-2); font-size: .875rem; text-decoration: none;
    }
    h1 { margin-bottom: 2px; }
    .options { display: flex; flex-wrap: wrap; gap: var(--pas) var(--pas-3); margin-top: var(--pas-3); }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; font-weight: 700; font-size: .9375rem; cursor: pointer; }
    .case input { width: 20px; height: 20px; margin: 0; }
    .legende { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: var(--pas) 0 0; }
    .pastille {
      display: inline-block; min-width: 32px; padding: 1px 6px; border-radius: 4px; text-align: center;
      font-size: .75rem; font-weight: 700; background: var(--fond); color: var(--craie);
    }
    .pastille.acquis { background: var(--acquis-clair); color: var(--acquis); }
    .pastille.encours { background: var(--en-cours-clair); color: var(--en-cours); }
    .pastille.jamais { background: none; }
    .legende .pastille { margin-left: var(--pas); }
    .legende .pastille:first-child { margin-left: 0; }

    .tableau-scroll { overflow-x: auto; margin-top: var(--pas-2); }
    /* Sur ordinateur, le tableau défile dans son propre cadre : la ligne des
       dates reste visible (en-tête collé en haut) pendant qu'on descend dans
       les critères, et la colonne des critères reste à gauche. */
    @media (min-width: 721px) {
      .tableau-scroll {
        max-height: calc(100vh - 220px); overflow: auto;
        border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte);
      }
      thead th { position: sticky; top: 0; z-index: 2; background: var(--fond); }
      thead th.figee { z-index: 3; }
      tr.critere:hover td { background: var(--fond); }
      tr.critere:hover td.acquis { background: var(--acquis-clair); }
      tr.critere:hover td.encours { background: var(--en-cours-clair); }
      tr.critere:hover td.figee { background: #EEF6F8; }
    }
    .sous-titre { font-weight: 400; }
    .entete-seance { white-space: normal; min-width: 90px; max-width: 130px; vertical-align: bottom; }
    .date-seance { display: block; color: var(--encre); }
    .lieu-seance { display: block; font-weight: 400; font-size: .75rem; overflow-wrap: anywhere; }
    .milieu-seance {
      display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 4px;
      background: var(--accent-clair); color: var(--encre); font-size: .6875rem; font-weight: 700;
    }
    .milieu-seance.naturel { background: var(--profond); color: #fff; }
    .critere-etat { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); }
    .critere-etat .pastille { flex: none; }
    table { border-collapse: collapse; white-space: nowrap; }
    th, td {
      padding: 8px 12px; border-bottom: 1px solid var(--trait); text-align: left; font-size: .875rem;
    }
    thead th { color: var(--craie); font-weight: 700; }
    .figee { position: sticky; left: 0; min-width: 240px; white-space: normal; max-width: 32ch; }
    th.figee { background: var(--fond); }
    td.figee { background: var(--carte); z-index: 1; }
    /* Une cellule fusionnée sur toute la ligne est aussi large que le
       tableau : « sticky » sur la cellule elle-même n'a aucun effet et le
       titre défilait hors de l'écran. On fige le texte à l'intérieur. */
    .titre-fige { position: sticky; left: 12px; display: inline-block; }
    tr.groupe td {
      background: var(--fond); color: var(--profond);
      font-weight: 700; text-transform: uppercase; font-size: .8125rem; letter-spacing: .02em;
      border-bottom: none;
    }
    tr.bloc-titre td {
      background: var(--carte); color: var(--craie);
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

    /* Sur téléphone, 240px de colonne figée ne laissaient presque plus de
       place aux séances. */
    @media (max-width: 720px) {
      .figee { min-width: 0; width: 45vw; max-width: 45vw; }
      th, td { padding: 8px; }
      .titre-fige { left: 8px; max-width: calc(100vw - 48px); white-space: normal; }
    }
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
  /** Masque les colonnes vides : sur une saison, l'élève n'est noté qu'à une partie des séances. */
  seulementNotees = signal(true);
  seulementNonAcquis = signal(false);

  seancesAffichees = computed<SeanceEnTete[]>(() => {
    const m = this.matrice();
    if (!m) return [];
    if (!this.seulementNotees()) return m.seances;
    const notees = new Set(m.lignes.flatMap(l => l.historique.map(c => c.seanceId)));
    return m.seances.filter(s => notees.has(s.id));
  });

  lignesAffichees = computed(() => {
    const m = this.matrice();
    if (!m) return [];
    const lignes = this.seulementNonAcquis()
      ? m.lignes.filter(l => this.etatActuel(l)?.statut !== 'ACQUIS')
      : m.lignes;
    let regroupementPrecedent: string | null | undefined;
    let blocPrecedent: string | undefined;
    return lignes.map(ligne => {
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

  /** État courant d'un critère : la dernière saisie, séance ou non (l'historique arrive trié par date de saisie). */
  etatActuel(ligne: LigneMatrice): CelluleMatrice | null {
    return ligne.historique.at(-1) ?? null;
  }

  suffixe(cellule: CelluleMatrice | null): string {
    if (!cellule) return 'jamais';
    return cellule.statut === 'ACQUIS' ? 'acquis' : cellule.statut === 'EN_COURS' ? 'encours' : 'neant';
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

  classe(cellule: CelluleMatrice | null): string {
    return cellule ? 'cellule ' + this.suffixe(cellule) : 'cellule';
  }
}
