import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { dateDuJour } from '../../core/date-fr';
import { ActionFiche, FichesSecuriteSejourVue, PortFichesSecurite, actionsAFaire } from './fiches-securite-sejour';
import { jourLong } from './sejour-api';

const GESTES: Record<ActionFiche['action'], { libelle: string; lien: string; chemin: string[] }> = {
  etablir: { libelle: 'À établir', lien: 'Établir la fiche', chemin: [] },
  completer: { libelle: 'À compléter au retour', lien: 'Compléter au retour', chemin: ['realise'] },
  signer: { libelle: 'À signer comme DP', lien: '✍ Signer la fiche', chemin: ['signature'] }
};

/**
 * L'encart « À faire » du haut du séjour (demande du club, 2026) : pour
 * l'encadrant, les fiches de sécurité du séjour qui l'attendent (établir,
 * compléter au retour, signer comme DP), chacune avec son lien, et un lien
 * vers les fiches de sécurité du séjour. Rien à faire : pas d'encart.
 * Jamais replié : ce qui reste à faire reste visible.
 */
@Component({
  selector: 'app-actions-sejour',
  imports: [RouterLink],
  template: `
    @if (aFaire(); as a) {
      @if (a.actions.length > 0 || a.signaturesAVenir.length > 0) {
        <section class="carte a-faire" aria-labelledby="titre-a-faire">
          <div class="tete">
            <h2 id="titre-a-faire">À faire</h2>
            <button type="button" class="bouton-discret voir-fiches" (click)="voirFiches.emit()">
              Voir les fiches de sécurité du séjour
            </button>
          </div>
          @if (a.actions.length > 0) {
            <ul class="actions">
              @for (x of a.actions; track x.action + x.plongee.seanceId) {
                <li class="action">
                  <span class="quoi">
                    <span class="etiquette-etat" [class]="x.action === 'etablir' ? 'attention' : 'fort'">{{ gestes[x.action].libelle }}</span>
                    Plongée n° {{ x.plongee.ordre }} du {{ jourLong(x.plongee.date) }}@if (x.plongee.lieu) { — {{ x.plongee.lieu }}}
                  </span>
                  <a [routerLink]="['/fiches-securite', x.plongee.seanceId].concat(gestes[x.action].chemin)" [queryParams]="retour()"
                     class="lien-action" [class.bouton-principal]="x.action === 'signer'" [class.bouton-discret]="x.action !== 'signer'">
                    {{ gestes[x.action].lien }}
                  </a>
                </li>
              }
            </ul>
          }
          @for (p of a.signaturesAVenir; track p.seanceId) {
            <p class="secondaire a-venir">
              ✍ Vous signerez comme DP la plongée n° {{ p.ordre }} du {{ jourLong(p.date) }} à partir de ce jour-là.
            </p>
          }
        </section>
      }
    }
  `,
  styles: [`
    .a-faire { margin: var(--pas-2) 0; padding: var(--pas-2); border-left: 6px solid var(--accent); }
    .tete { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; }
    .tete h2 { margin: 0; }
    .voir-fiches { margin-left: auto; min-height: 44px; }
    .actions { list-style: none; margin: var(--pas) 0 0; padding: 0; }
    .action { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap;
              padding: var(--pas) 0; border-top: 1px solid var(--trait); }
    .action:first-child { border-top: none; }
    .quoi { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; font-weight: 700; }
    .lien-action { min-height: 44px; display: inline-flex; align-items: center; width: auto; margin: 0; }
    .a-venir { margin: var(--pas) 0 0; }
    @media (max-width: 640px) { .voir-fiches { margin-left: 0; width: 100%; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionsSejourComponent implements OnInit {
  port = input.required<PortFichesSecurite>();
  sejourId = input.required<number>();
  /** « Voir les fiches de sécurité du séjour » : l'écran ouvre l'onglet. */
  voirFiches = output<void>();

  private auth = inject(AuthService);

  readonly jourLong = jourLong;
  readonly gestes = GESTES;

  private vue = signal<FichesSecuriteSejourVue | null>(null);
  readonly aFaire = computed(() => {
    const v = this.vue();
    return v ? actionsAFaire(v, this.auth.session()?.id, dateDuJour()) : null;
  });
  /** Suivi par les écrans de la fiche : leur retour ramène au séjour. */
  readonly retour = computed(() => ({ sejour: this.sejourId() }));

  ngOnInit(): void {
    // Sans réponse, pas d'encart : l'onglet des fiches dit lui-même ce qui ne va pas.
    this.port().lire().subscribe({ next: v => this.vue.set(v), error: () => {} });
  }
}
