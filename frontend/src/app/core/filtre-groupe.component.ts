import { Component, ChangeDetectionStrategy, computed, input, model } from '@angular/core';
import { GroupeEntrainementVue } from './modeles';

/** Filtre d'élèves par groupe d'entraînement : tous, un groupe, ou ceux qui ne sont dans aucun groupe. */
export type FiltreGroupe = 'TOUS' | 'SANS' | number;

/** L'élève passe-t-il le filtre ? */
export function passeFiltreGroupe(eleveId: number, filtre: FiltreGroupe, groupes: GroupeEntrainementVue[]): boolean {
  if (filtre === 'TOUS') return true;
  if (filtre === 'SANS') return !groupes.some(g => g.eleves.some(e => e.id === eleveId));
  return groupes.find(g => g.id === filtre)?.eleves.some(e => e.id === eleveId) ?? false;
}

/**
 * Boutons de filtre par groupe d'entraînement (ceux du planning du bassin),
 * communs aux pages Infos élèves, Présences et Trombinoscope. « Sans groupe »
 * n'apparaît que si des élèves affichés ne sont rangés dans aucun groupe.
 */
@Component({
  selector: 'app-filtre-groupe',
  template: `
    <div class="filtres" role="group" aria-label="Filtrer par groupe">
      <button type="button" class="bouton-discret" [class.actif]="valeur() === 'TOUS'"
              [attr.aria-pressed]="valeur() === 'TOUS'" (click)="valeur.set('TOUS')">Tous</button>
      @for (g of groupes(); track g.id) {
        <button type="button" class="bouton-discret" [class.actif]="valeur() === g.id"
                [attr.aria-pressed]="valeur() === g.id" (click)="valeur.set(g.id)">{{ g.nom }}</button>
      }
      @if (sansGroupe()) {
        <button type="button" class="bouton-discret" [class.actif]="valeur() === 'SANS'"
                [attr.aria-pressed]="valeur() === 'SANS'" (click)="valeur.set('SANS')">Sans groupe</button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .filtres { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
  `]
})
export class FiltreGroupeComponent {
  readonly groupes = input.required<GroupeEntrainementVue[]>();
  /** Élèves affichés par la page : sert à proposer « Sans groupe » seulement s'il y en a. */
  readonly eleveIds = input.required<number[]>();
  readonly valeur = model<FiltreGroupe>('TOUS');

  sansGroupe = computed(() => this.eleveIds().some(id => passeFiltreGroupe(id, 'SANS', this.groupes())));
}
