import { Component, ChangeDetectionStrategy, computed, input, model, signal } from '@angular/core';
import { normaliser } from './seance-lieu';

/** Une option de la liste : `detail` s'affiche en petit sous le libellé. */
export interface OptionCombobox {
  id: number;
  libelle: string;
  detail?: string | null;
}

/**
 * Champ de recherche avec liste de choix : on tape quelques lettres (casse et
 * accents ignorés), on choisit à la souris, au doigt ou au clavier (flèches,
 * Entrée, Échap). La valeur liée est l'id de l'option choisie ; tant qu'aucune
 * option n'est choisie, elle reste null.
 */
@Component({
  selector: 'app-combobox',
  template: `
    <div class="combobox">
      <input [id]="idChamp()" type="text" autocomplete="off"
             role="combobox" aria-autocomplete="list" [attr.aria-controls]="idChamp() + '-liste'"
             [attr.aria-expanded]="ouvert()"
             [attr.aria-activedescendant]="optionActive() ? idChamp() + '-option-' + optionActive()!.id : null"
             [placeholder]="aide()" [disabled]="desactive()"
             [value]="texteAffiche()" (input)="saisir($any($event.target).value)"
             (focus)="ouvrir()" (blur)="fermerDiffere()" (keydown)="clavier($event)">
      @if (valeur() !== null && !desactive()) {
        <button type="button" class="effacer" aria-label="Effacer le choix" (mousedown)="effacer()">×</button>
      }
      @if (ouvert()) {
        <ul [id]="idChamp() + '-liste'" role="listbox" class="options">
          @for (o of filtrees(); track o.id; let i = $index) {
            <li role="option" [id]="idChamp() + '-option-' + o.id"
                [attr.aria-selected]="valeur() === o.id" [class.active]="indexActif() === i">
              <button type="button" tabindex="-1" (mousedown)="choisir(o)">
                <span class="libelle">{{ o.libelle }}</span>
                @if (o.detail) { <span class="detail">{{ o.detail }}</span> }
              </button>
            </li>
          } @empty {
            <li class="vide">{{ texteVide() }}</li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .combobox { position: relative; }
    .combobox input { width: 100%; margin: 0; padding-right: 44px; }
    .effacer {
      position: absolute; top: 0; right: 0; width: 44px; height: 100%; min-height: 44px;
      background: none; border: none; color: var(--craie); font-size: 1.25rem; cursor: pointer;
    }
    .options {
      position: absolute; z-index: 2; top: 100%; left: 0; right: 0; margin: 2px 0 0; padding: 0;
      list-style: none; max-height: 280px; overflow-y: auto; background: var(--carte);
      border: 1px solid var(--trait); border-radius: var(--r-s); box-shadow: 0 4px 12px rgba(0,0,0,.12);
    }
    .options button {
      display: flex; flex-direction: column; gap: 2px; width: 100%; min-height: 44px;
      padding: var(--pas) var(--pas-2); text-align: left; background: none; border: none; color: var(--encre);
    }
    .options button:hover, .options li.active button { background: var(--fond); }
    .options li.active button { outline: 2px solid var(--profond); outline-offset: -2px; }
    .options li[aria-selected="true"] .libelle { font-weight: 700; }
    .detail { font-size: .8125rem; color: var(--craie); }
    .vide { padding: var(--pas) var(--pas-2); color: var(--craie); font-size: .875rem; }
  `]
})
export class ComboboxComponent {
  readonly options = input.required<OptionCombobox[]>();
  /** Id de l'option choisie, lié dans les deux sens : [(valeur)]. */
  readonly valeur = model<number | null>(null);
  /** Id du champ, pour le relier à son <label for>. */
  readonly idChamp = input.required<string>();
  readonly aide = input('Rechercher…');
  readonly texteVide = input('Aucun résultat.');
  readonly desactive = input(false);

  readonly ouvert = signal(false);
  readonly indexActif = signal(-1);
  /** Texte tapé ; null tant que l'on n'a pas tapé depuis le dernier choix. */
  private readonly recherche = signal<string | null>(null);

  private readonly choisie = computed(() => this.options().find(o => o.id === this.valeur()) ?? null);
  readonly texteAffiche = computed(() => this.recherche() ?? this.choisie()?.libelle ?? '');
  readonly filtrees = computed(() => {
    const r = normaliser(this.recherche() ?? '');
    return r ? this.options().filter(o => normaliser(o.libelle).includes(r)) : this.options();
  });
  readonly optionActive = computed(() => this.filtrees()[this.indexActif()] ?? null);

  saisir(texte: string): void {
    this.recherche.set(texte);
    this.valeur.set(null);
    this.ouvert.set(true);
    this.indexActif.set(texte.trim() ? 0 : -1);
  }

  ouvrir(): void {
    this.ouvert.set(true);
  }

  /** Différé pour laisser le clic sur une option se produire avant la fermeture. */
  fermerDiffere(): void {
    setTimeout(() => {
      this.ouvert.set(false);
      this.recherche.set(null);
    }, 150);
  }

  choisir(o: OptionCombobox): void {
    this.valeur.set(o.id);
    this.recherche.set(null);
    this.ouvert.set(false);
    this.indexActif.set(-1);
  }

  effacer(): void {
    this.valeur.set(null);
    this.recherche.set('');
  }

  clavier(ev: KeyboardEvent): void {
    const nb = this.filtrees().length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.ouvert.set(true);
      if (nb === 0) return;
      this.indexActif.set((this.indexActif() + (ev.key === 'ArrowDown' ? 1 : -1) + nb) % nb);
      const o = this.optionActive();
      if (o) document.getElementById(`${this.idChamp()}-option-${o.id}`)?.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter') {
      const o = this.optionActive();
      if (this.ouvert() && o) {
        ev.preventDefault();
        this.choisir(o);
      }
    } else if (ev.key === 'Escape') {
      this.ouvert.set(false);
    }
  }
}
