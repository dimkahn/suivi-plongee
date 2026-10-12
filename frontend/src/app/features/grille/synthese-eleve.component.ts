import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { BlocVue, CritereVue, EtatCompetence, GrilleVue } from '../../core/modeles';
import { dateFr } from '../../core/date-fr';
import { libellePreparation } from '../../core/niveaux';
import { PhotoEleveComponent } from '../../core/photo-eleve.component';

/** Les trois rubriques de la fiche, dans l'ordre de lecture. */
const RUBRIQUES: { etat: EtatCompetence; titre: string; vide: string }[] = [
  { etat: 'A', titre: 'Compétences acquises', vide: 'Aucune compétence validée pour l’instant.' },
  { etat: 'ECA', titre: 'En cours d’acquisition', vide: 'Aucune compétence en cours.' },
  { etat: 'NT', titre: 'Non travaillées', vide: 'Toutes les compétences ont été travaillées.' }
];

const LIBELLES_CRITERE: Record<string, string> = { NON_ABORDE: 'NA', EN_COURS: 'ECA', ACQUIS: 'A' };

/**
 * Fiche de synthèse d'un élève (choix du club, 2026) : ses compétences
 * rangées en acquises (A, bloc validé), en cours d'acquisition (ECA) et non
 * travaillées (NT), comme la synthèse de son groupe, avec pour celles en
 * cours le détail des critères. Tirée de la grille (état calculé par le
 * serveur, `BlocVue.etat`), donc consultable hors ligne. Lecture seule,
 * imprimable.
 */
@Component({
  selector: 'app-synthese-eleve',
  imports: [RouterLink, PhotoEleveComponent],
  template: `
    <a [routerLink]="['/cursus', id()]" class="retour">&larr; Retour à la fiche de suivi</a>

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (grille(); as g) {
      <div class="entete">
        <app-photo-eleve [eleveId]="g.eleveId" [nom]="g.eleve" [aPhoto]="g.aPhoto" />
        <div>
          <h1>{{ g.eleve }}</h1>
          <p class="secondaire">
            Synthèse des compétences · {{ libellePreparation(g.niveau) }} · MFT {{ g.versionMft }} · {{ g.saison }}
          </p>
        </div>
        <button type="button" class="bouton-discret imprimer" (click)="imprimer()">Imprimer</button>
      </div>

      <div class="compteurs" role="list" aria-label="Résumé">
        @for (r of rubriques; track r.etat) {
          <a role="listitem" [href]="'#rubrique-' + r.etat" (click)="allerA($event, r.etat)"
             [class]="'compteur ' + r.etat">
            <strong>{{ parEtat()[r.etat].length }}</strong>
            <span><span class="etat-court">{{ r.etat }}</span> {{ r.titre.toLowerCase() }}</span>
          </a>
        }
      </div>

      <section class="avancement" aria-labelledby="titre-avancement">
        <h2 id="titre-avancement">Avancement par compétence</h2>
        <p class="secondaire">Part des critères acquis{{ g.milieuNaturelExclusif ? ' en milieu naturel' : '' }} ; une compétence validée compte pour 100 %.</p>
        <ul class="camemberts">
          @for (b of g.blocs; track b.id) {
            @let p = pourcentage(b);
            <li>
              <a [href]="'#competence-' + b.id" (click)="allerALaCompetence($event, b.id)" class="camembert"
                 [title]="detailPourcentage(b)" [attr.aria-label]="b.intitule + ' : ' + p + ' %, ' + detailPourcentage(b)">
                <svg viewBox="0 0 42 42" width="72" height="72" aria-hidden="true">
                  <circle cx="21" cy="21" r="16" class="piste" />
                  @if (p > 0) {
                    <circle cx="21" cy="21" r="16" class="part" pathLength="100"
                            [attr.stroke-dasharray]="p + ' ' + (100 - p)" transform="rotate(-90 21 21)" />
                  }
                  <text x="21" y="21" text-anchor="middle" dominant-baseline="central">{{ p }} %</text>
                </svg>
                <span class="nom-competence">
                  @if (b.regroupement) { <span class="regroupement">{{ b.regroupement }}</span> }
                  {{ b.intitule }}
                </span>
              </a>
            </li>
          }
        </ul>
      </section>

      @for (r of rubriques; track r.etat) {
        @let blocs = parEtat()[r.etat];
        <section class="rubrique" [id]="'rubrique-' + r.etat">
          <h2><span [class]="'etat ' + r.etat">{{ r.etat }}</span> {{ r.titre }} ({{ blocs.length }})</h2>
          @if (blocs.length === 0) {
            <p class="secondaire">{{ r.vide }}</p>
          } @else {
            <ul class="competences">
              @for (b of blocs; track b.id) {
                <li class="carte competence" [id]="'competence-' + b.id">
                  <p class="intitule">
                    @if (b.regroupement) { <span class="regroupement">{{ b.regroupement }}</span> }
                    {{ b.intitule }}
                  </p>
                  @if (r.etat === 'A') {
                    <p class="secondaire">
                      Validée{{ b.dateValidation ? ' le ' + dateFr(b.dateValidation) : '' }}{{ b.valideePar ? ' par ' + b.valideePar : '' }}
                    </p>
                  } @else if (r.etat === 'ECA') {
                    <p class="secondaire">
                      {{ b.acquis }}/{{ b.total }} critère{{ b.total > 1 ? 's' : '' }} acquis
                      @if (g.milieuNaturelExclusif && (b.acquisEntrainement ?? 0) > 0) {
                        · {{ b.acquisEntrainement }} à l'entraînement (piscine, fosse)
                      }
                      @if (b.acquis === b.total) { · reste à valider la compétence }
                      @if (b.enRetard) { · <span class="retard">en retard sur la progression</span> }
                    </p>
                    <ul class="criteres">
                      @for (c of b.criteres; track c.id) {
                        <li>
                          <span [class]="'pastille ' + c.statut">{{ libelleCritere(c.statut) }}</span>
                          <span>
                            {{ c.savoirFaire }}
                            @if (entrainementAffiche(g, c); as e) {
                              <span class="entrainement">entraînement : {{ libelleCritere(e) }}</span>
                            }
                          </span>
                        </li>
                      }
                    </ul>
                  } @else if (b.enRetard) {
                    <p class="secondaire retard">En retard sur la progression</p>
                  }
                </li>
              }
            </ul>
          }
        </section>
      }

      <p class="secondaire legende">
        <span class="etat A">A</span> acquise (compétence validée) ·
        <span class="etat ECA">ECA</span> en cours d'acquisition (au moins un critère travaillé) ·
        <span class="etat NT">NT</span> non travaillée.
        @if (g.milieuNaturelExclusif) {
          Au {{ g.niveau }}, seules les notes en milieu naturel font acquérir un critère ;
          une compétence travaillée seulement en piscine ou en fosse compte en cours d'acquisition.
        }
      </p>
    }
  `,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; }
    .entete { display: flex; align-items: center; gap: var(--pas-2); flex-wrap: wrap; margin: var(--pas) 0 var(--pas-2); }
    .entete h1 { margin: 0; }
    .entete p { margin: 0; }
    .imprimer { margin-left: auto; }
    .compteurs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--pas); margin-bottom: var(--pas-2); }
    .compteur { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
                min-height: 44px; padding: var(--pas); border-radius: var(--r-s); border: 1px solid var(--trait);
                text-decoration: none; color: var(--craie); background: var(--carte); text-align: center; }
    .compteur strong { font-size: 1.5rem; line-height: 1.1; }
    .compteur.A { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .compteur.ECA { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .etat-court { font-weight: 700; }
    .rubrique h2 { display: flex; align-items: center; gap: var(--pas); margin: var(--pas-3) 0 var(--pas); font-size: 1.125rem; }
    .etat { display: inline-flex; align-items: center; justify-content: center; min-width: 2.5rem; padding: 0 4px;
            border-radius: var(--r-s); border: 1px solid var(--trait); font-weight: 700; color: var(--craie); }
    .etat.A { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .etat.ECA { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .competences { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--pas); }
    .competence { padding: var(--pas) var(--pas-2); }
    .competence p { margin: 0; }
    .intitule { font-weight: 700; }
    .regroupement { display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: var(--r-s);
                    background: var(--fond); font-size: .75rem; font-weight: 700; color: var(--craie); }
    .criteres { list-style: none; padding: 0; margin: var(--pas) 0 0; display: grid; gap: 4px; font-size: .875rem; }
    .criteres li { display: flex; align-items: baseline; gap: var(--pas); }
    .pastille { flex: none; display: inline-block; min-width: 2.5rem; text-align: center; border-radius: var(--r-s);
                border: 1px solid var(--trait); font-size: .75rem; font-weight: 700; color: var(--craie); }
    .pastille.ACQUIS { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
    .pastille.EN_COURS { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .entrainement { display: block; font-size: .8125rem; color: var(--craie); }
    .retard { color: var(--accent); font-weight: 700; }
    .legende { margin-top: var(--pas-3); font-size: .8125rem; line-height: 1.8; }
    .avancement h2 { margin: var(--pas-3) 0 0; font-size: 1.125rem; }
    .avancement > p { margin: 2px 0 var(--pas); font-size: .8125rem; }
    .camemberts { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--pas);
                  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
    .camembert { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%;
                 min-height: 44px; padding: var(--pas); border: 1px solid var(--trait); border-radius: var(--r-s);
                 background: var(--carte); color: var(--encre); text-decoration: none; text-align: center; }
    .camembert:hover { border-color: var(--profond); }
    .camembert .piste { fill: none; stroke: var(--trait); stroke-width: 8; }
    .camembert .part { fill: none; stroke: var(--profond); stroke-width: 8; }
    .camembert text { font-size: 9px; font-weight: 700; fill: var(--encre); }
    .nom-competence { font-size: .8125rem; line-height: 1.3; color: var(--craie); }
    @media print {
      .retour, .imprimer { display: none; }
      .competence, .camembert { break-inside: avoid; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SyntheseEleveComponent {
  private api = inject(ApiService);

  /** Identifiant du cursus, tiré de l'adresse /cursus/:id/synthese. */
  id = input.required<string>();

  grille = signal<GrilleVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);

  readonly rubriques = RUBRIQUES;
  readonly dateFr = dateFr;
  readonly libellePreparation = libellePreparation;

  /** Les compétences rangées par état, dans l'ordre de la grille. */
  parEtat = computed(() => {
    const rangees: Record<EtatCompetence, BlocVue[]> = { A: [], ECA: [], NT: [] };
    for (const b of this.grille()?.blocs ?? []) rangees[etatDe(b)].push(b);
    return rangees;
  });

  constructor() {
    queueMicrotask(() => void this.charger());
  }

  private async charger(): Promise<void> {
    try {
      this.grille.set(await this.api.grille(Number(this.id())));
    } catch {
      this.erreur.set('La fiche de l’élève n’a pas pu être chargée.');
    } finally {
      this.chargement.set(false);
    }
  }

  libelleCritere(statut: string): string {
    return LIBELLES_CRITERE[statut] ?? statut;
  }

  /** N2/N3 : l'état à l'entraînement, rappelé quand il dit plus que le milieu naturel. */
  entrainementAffiche(g: GrilleVue, c: CritereVue): string | null {
    const e = c.entrainement?.statut;
    if (!g.milieuNaturelExclusif || !e || e === 'NON_ABORDE' || e === c.statut) return null;
    return e;
  }

  allerA(evenement: Event, etat: EtatCompetence): void {
    evenement.preventDefault();
    document.getElementById('rubrique-' + etat)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Part de la compétence effectuée : critères acquis sur le total (milieu
   * naturel seul pour un N2/N3, comme la validation) ; 100 % une fois validée.
   */
  pourcentage(b: BlocVue): number {
    if (etatDe(b) === 'A') return 100;
    return b.total > 0 ? Math.round(100 * b.acquis / b.total) : 0;
  }

  detailPourcentage(b: BlocVue): string {
    if (etatDe(b) === 'A') return 'compétence validée';
    return `${b.acquis} critère${b.acquis > 1 ? 's' : ''} acquis sur ${b.total}`;
  }

  allerALaCompetence(evenement: Event, blocId: number): void {
    evenement.preventDefault();
    document.getElementById('competence-' + blocId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  imprimer(): void {
    window.print();
  }
}

/** L'état calculé par le serveur ; même règle pour une grille mise en cache avant son arrivée. */
function etatDe(b: BlocVue): EtatCompetence {
  if (b.etat) return b.etat;
  if (b.valide) return 'A';
  const travaille = b.criteres.some(c => c.statut !== 'NON_ABORDE'
    || (c.entrainement != null && c.entrainement.statut !== 'NON_ABORDE'));
  return travaille ? 'ECA' : 'NT';
}
