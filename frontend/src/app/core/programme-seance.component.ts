import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { ProgressionVue } from './modeles';
import { plageMois, programmeDuJour } from './progression';

/**
 * Programme d'une séance tiré des progressions suivies par la saison : la
 * période du mois pour chaque niveau. En version « compacte » une ligne par
 * niveau (liste des séances) ; sinon le contenu et les blocs se déplient.
 */
@Component({
  selector: 'app-programme-seance',
  template: `
    @if (programme().length > 0) {
      @if (compact()) {
        <ul class="compact" aria-label="Programme de la séance">
          @for (p of programme(); track p.niveau) {
            <li><span class="niveau">{{ p.niveau }}</span> {{ p.periode.intitule }}</li>
          }
        </ul>
      } @else {
        <section class="programme" aria-label="Programme de la séance">
          <h2>Au programme</h2>
          @for (p of programme(); track p.niveau) {
            <details>
              <summary>
                <span class="niveau">{{ p.niveau }}</span>
                <span class="intitule">{{ p.periode.intitule }}</span>
              </summary>
              <div class="contenu">
                <p class="secondaire">{{ p.progression }} · {{ plage(p.periode.moisDebut, p.periode.moisFin) }}</p>
                @if (p.periode.note) { <p>{{ p.periode.note }}</p> }
                @if (p.periode.blocs.length > 0) {
                  <ul>
                    @for (b of p.periode.blocs; track b.id) { <li>{{ b.intitule }}</li> }
                  </ul>
                }
              </div>
            </details>
          }
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .niveau {
      display: inline-block; min-width: 2.25em; padding: 0 6px; margin-right: 6px;
      border-radius: var(--r-s); background: var(--profond); color: #fff;
      font-size: .8125rem; font-weight: 700; text-align: center;
    }
    .compact { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 2px; font-size: .875rem; }
    .programme h2 { margin: 0 0 var(--pas); font-size: 1rem; }
    .programme { display: flex; flex-direction: column; gap: 4px; }
    details { border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--fond); }
    summary { padding: 12px var(--pas-2); line-height: 20px; cursor: pointer; font-weight: 700; }
    .contenu { padding: 0 var(--pas-2) var(--pas-2); font-size: .9375rem; }
    .contenu p { margin: 0 0 var(--pas); }
    .contenu ul { margin: 0; padding-left: 1.25rem; display: grid; gap: 2px; }
  `]
})
export class ProgrammeSeanceComponent {
  readonly progressions = input.required<ProgressionVue[]>();
  /** Date de la séance, AAAA-MM-JJ. */
  readonly date = input.required<string>();
  readonly compact = input(false);

  readonly programme = computed(() => programmeDuJour(this.progressions(), this.date()));
  readonly plage = plageMois;
}
