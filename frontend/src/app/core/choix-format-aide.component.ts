import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FORMATS_AIDE, FormatAideService } from './format-aide';

/**
 * « Aide pour : Téléphone | Ordinateur » : le format des vidéos d'aide et des
 * passages des manuels qui en dépendent. Le choix vaut pour toute l'aide et
 * reste sur l'appareil.
 */
@Component({
  selector: 'app-choix-format-aide',
  template: `
    <div class="choix" role="group" aria-label="Aide pour">
      <span class="libelle">Aide pour</span>
      @for (f of formats; track f.valeur) {
        <button type="button" [class.actif]="service.format() === f.valeur"
                [attr.aria-pressed]="service.format() === f.valeur" (click)="service.choisir(f.valeur)">
          {{ f.libelle }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .choix { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .libelle { font-weight: 700; font-size: .9375rem; margin-right: var(--pas); }
    button {
      min-height: 44px; padding: 0 var(--pas-2); border: 1px solid var(--profond); background: #fff;
      color: var(--profond); font: inherit; font-weight: 700; cursor: pointer;
    }
    button:first-of-type { border-radius: var(--r-s) 0 0 var(--r-s); }
    button:last-of-type { border-radius: 0 var(--r-s) var(--r-s) 0; }
    button.actif { background: var(--profond); color: #fff; }
  `]
})
export class ChoixFormatAideComponent {
  protected service = inject(FormatAideService);
  protected formats = FORMATS_AIDE;
}
