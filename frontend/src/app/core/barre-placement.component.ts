import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Barre collée en bas de l'écran, au-dessus de la barre d'onglets du
 * téléphone, le temps de choisir où placer une personne touchée (palanquée,
 * groupe d'entraînement) : l'alternative au glisser-déposer, plus sûre au
 * doigt. « Prénom Nom → question », puis les boutons de destination que
 * l'écran projette, puis « Annuler ». Affichage seul.
 */
@Component({
  selector: 'app-barre-placement',
  template: `
    <div class="barre-placement" role="dialog" [attr.aria-label]="etiquette()">
      <p><strong>{{ nom() }}</strong>{{ precision() ? ' ' + precision() : '' }} → {{ question() }}</p>
      <div class="choix-palanquees">
        <ng-content />
        <button type="button" class="bouton-discret" (click)="annuler.emit()">Annuler</button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .barre-placement {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      max-height: 45vh; overflow-y: auto;
      padding: var(--pas-2) var(--pas-3) calc(var(--pas-2) + env(safe-area-inset-bottom, 0px));
      background: var(--carte); border-top: 1px solid var(--trait);
      box-shadow: 0 -6px 16px rgba(0,0,0,.15);
    }
    p { margin: 0 0 var(--pas); }
    .choix-palanquees { display: flex; flex-wrap: wrap; gap: var(--pas); }
  `]
})
export class BarrePlacementComponent {
  /** Ce que lit un lecteur d'écran : « Choisir la palanquée ». */
  readonly etiquette = input.required<string>();
  /** Qui est à placer. */
  readonly nom = input.required<string>();
  /** Entre parenthèses après le nom, d'où il vient : « (palanquée 2) ». */
  readonly precision = input<string | null>(null);
  readonly question = input.required<string>();
  readonly annuler = output<void>();
}
