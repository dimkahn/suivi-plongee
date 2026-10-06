import { Component, ChangeDetectionStrategy, computed, input, model } from '@angular/core';
import { GroupeEntrainementVue } from './modeles';

/** Filtre par groupe d'entraînement : tous, un groupe, ou ceux qui ne sont dans aucun groupe. */
export type FiltreGroupe = 'TOUS' | 'SANS' | number;

/** Ce que l'on filtre : les élèves rangés dans les groupes, ou leurs encadrants attitrés (référents compris). */
export type MembresGroupe = 'ELEVES' | 'ENCADRANTS';

function estMembre(g: GroupeEntrainementVue, id: number, membres: MembresGroupe): boolean {
  return membres === 'ELEVES' ? g.eleves.some(e => e.id === id) : g.encadrants.some(e => e.id === id);
}

/** L'élève (ou l'encadrant, selon {@code membres}) passe-t-il le filtre ? */
export function passeFiltreGroupe(id: number, filtre: FiltreGroupe, groupes: GroupeEntrainementVue[],
                                  membres: MembresGroupe = 'ELEVES'): boolean {
  if (filtre === 'TOUS') return true;
  if (filtre === 'SANS') return !groupes.some(g => estMembre(g, id, membres));
  const groupe = groupes.find(g => g.id === filtre);
  return groupe ? estMembre(groupe, id, membres) : false;
}

/**
 * Boutons de filtre par groupe d'entraînement (ceux du planning du bassin),
 * communs aux pages Infos élèves, Présences et Trombinoscope (élèves et
 * moniteurs). « Sans groupe » n'apparaît que si des personnes affichées ne
 * sont rangées dans aucun groupe.
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
  /** Personnes affichées par la page : sert à proposer « Sans groupe » seulement s'il y en a. */
  readonly ids = input.required<number[]>();
  readonly membres = input<MembresGroupe>('ELEVES');
  readonly valeur = model<FiltreGroupe>('TOUS');

  sansGroupe = computed(() => this.ids().some(id => passeFiltreGroupe(id, 'SANS', this.groupes(), this.membres())));
}
