import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/** Un onglet : la valeur qu'il choisit, son libellé, et ce qui y reste à vérifier (rond orange). */
export interface OptionOnglet<T> {
  valeur: T;
  libelle: string;
  alertes?: number;
}

/**
 * Rangée d'onglets d'un écran (séjour, prêts, niveaux du référentiel…) :
 * l'onglet choisi est plein, les autres discrets. En onglets (`role="tab"`,
 * le contenu change sous la rangée) ou, avec `boutons`, en boutons
 * enfoncés (`aria-pressed`, un choix d'affichage). Les scénarios de vidéo
 * les visent par ce rôle : le garder quand on remplace une rangée existante.
 */
@Component({
  selector: 'app-onglets',
  template: `
    <div class="onglets" [class.defilant]="defilant()" [attr.role]="boutons() ? 'group' : 'tablist'"
         [attr.aria-label]="libelle()">
      @for (o of options(); track o.valeur) {
        <button type="button" class="bouton-discret" [class.actif]="o.valeur === choisi()"
                [attr.role]="boutons() ? null : 'tab'"
                [attr.aria-selected]="boutons() ? null : o.valeur === choisi()"
                [attr.aria-pressed]="boutons() ? o.valeur === choisi() : null"
                (click)="choisir.emit(o.valeur)">
          {{ o.libelle }}@if (o.alertes) {
            <span class="compteur-alertes" [attr.aria-label]="o.alertes + ' à vérifier'">{{ o.alertes }}</span>
          }
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; margin: var(--pas-2) 0; }
    .onglets { display: flex; gap: var(--pas); flex-wrap: wrap; }
    /* Une seule rangée, qui défile sur téléphone plutôt que de s'empiler. */
    .onglets.defilant { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
    .onglets.defilant button { flex: none; white-space: nowrap; }
    button { display: inline-flex; align-items: center; gap: 6px; }
    .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
    .compteur-alertes { min-width: 1.4rem; height: 1.4rem; padding: 0 5px; border-radius: 999px; font-size: .75rem;
                        font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
                        background: var(--en-cours); color: #fff; }
  `]
})
export class OngletsComponent<T> {
  readonly options = input.required<readonly OptionOnglet<T>[]>();
  readonly choisi = input.required<T>();
  /** Nom de la rangée pour les lecteurs d'écran (« Affichage des séances »). */
  readonly libelle = input<string>();
  /** Boutons enfoncés plutôt qu'onglets. */
  readonly boutons = input(false);
  /** Une seule rangée qui défile (beaucoup d'onglets). */
  readonly defilant = input(false);
  readonly choisir = output<T>();
}
