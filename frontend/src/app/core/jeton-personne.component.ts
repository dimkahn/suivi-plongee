import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Jeton d'une personne à placer (plongeur d'un groupe vers une palanquée,
 * élève vers un groupe d'entraînement) : nom complet, ou prénom et initiale
 * du nom au téléphone, et un détail en gras (aptitude, niveau préparé).
 *
 * Toucher le jeton le choisit (`choisir`) ; l'écran ouvre alors sa barre de
 * placement (`app-barre-placement`). Le glisser se pose sur l'élément hôte
 * (`<app-jeton-personne cdkDrag …>`), par l'écran. Affichage seul.
 *
 * Dans un vivier (`.vivier-jetons` de styles.css), les jetons s'alignent à
 * trois par ligne au téléphone, en gardant 44 px de haut pour le doigt.
 */
@Component({
  selector: 'app-jeton-personne',
  template: `
    <button type="button" class="jeton-plongeur" [class.selectionne]="selectionne()"
            [attr.aria-pressed]="selectionne()" [attr.aria-label]="etiquette()" (click)="choisir.emit()">
      <span class="nom-long">{{ prenom() }} {{ nom() }}</span>
      <span class="nom-court">{{ prenom() }} {{ initiale() }}</span>
      @if (detail(); as d) { <span class="niveau-jeton">{{ d }}</span> }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; min-width: 0; }
    .jeton-plongeur {
      display: inline-flex; align-items: center; gap: 6px;
      padding: var(--pas) var(--pas-2); border-radius: 999px; background: var(--brume, #eef4f5);
      border: 1px solid var(--trait); cursor: grab; font-size: .875rem; user-select: none;
      min-height: 44px; color: var(--encre); font-weight: 400;
    }
    .nom-court { display: none; }
    .niveau-jeton { font-weight: 700; color: var(--profond); }
    .jeton-plongeur.selectionne {
      background: var(--profond); border-color: var(--profond); color: #fff; font-weight: 700;
    }
    .jeton-plongeur.selectionne .niveau-jeton { color: #fff; }
    @media (max-width: 600px) {
      :host { display: flex; }
      .jeton-plongeur {
        flex: 1; flex-direction: column; justify-content: center; gap: 0;
        padding: 2px 6px; border-radius: var(--r-s); line-height: 1.15; min-width: 0;
      }
      .nom-long { display: none; }
      .nom-court {
        display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: .8125rem;
      }
      .niveau-jeton { font-size: .75rem; }
    }
  `]
})
export class JetonPersonneComponent {
  readonly prenom = input.required<string>();
  readonly nom = input.required<string>();
  /** Aptitude, niveau préparé… ; null : rien sous le nom. */
  readonly detail = input<string | null>(null);
  /** Choisi, en attente de sa destination. */
  readonly selectionne = input(false);
  readonly choisir = output<void>();

  /** « LACUES » → « L. » : assez pour distinguer deux prénoms identiques sur une petite puce. */
  readonly initiale = computed(() => {
    const n = (this.nom() ?? '').trim();
    return n ? n[0].toUpperCase() + '.' : '';
  });
  readonly etiquette = computed(() => `${this.prenom()} ${this.nom()}${this.detail() ? ', ' + this.detail() : ''}`);
}
