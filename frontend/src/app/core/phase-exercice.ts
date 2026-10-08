import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PhaseExercice } from './modeles';

/** Les trois temps d'une compétence dans la base d'exercices, dans l'ordre. */
export const PHASES: { valeur: PhaseExercice; libelle: string; lettre: string }[] = [
  { valeur: 'INITIATION', libelle: 'Initiation', lettre: 'I' },
  { valeur: 'PERFECTIONNEMENT', libelle: 'Perfectionnement', lettre: 'P' },
  { valeur: 'MAITRISE', libelle: 'Maîtrise', lettre: 'M' }
];

export function libellePhase(phase: PhaseExercice): string {
  return PHASES.find(p => p.valeur === phase)?.libelle ?? phase;
}

/**
 * Pastille « M 1.7 » : la phase de l'exercice se lit d'un coup d'œil, par sa
 * lettre et sa couleur (initiation bleu clair, perfectionnement ambre,
 * maîtrise vert, comme « acquis »). Le libellé complet est dans l'info-bulle
 * et pour les lecteurs d'écran.
 */
@Component({
  selector: 'app-pastille-phase',
  standalone: true,
  template: `
    <span [class]="'pastille-phase ' + phase().toLowerCase()" [title]="titre()" [attr.aria-label]="titre()">
      <span class="lettre" aria-hidden="true">{{ lettre() }}</span>@if (numero()) {<span aria-hidden="true">{{ numero() }}</span>}
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .pastille-phase {
      display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; border-radius: var(--r-s);
      border: 1px solid; font-size: .75rem; font-weight: 700; line-height: 1.5; white-space: nowrap;
    }
    .lettre { font-family: var(--font-titres), sans-serif; }
    .initiation { background: #E0F2FE; border-color: var(--profond); color: var(--profond-fonce); }
    .perfectionnement { background: var(--en-cours-clair); border-color: var(--en-cours); color: var(--en-cours); }
    .maitrise { background: var(--acquis-clair); border-color: var(--acquis); color: var(--acquis); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PastillePhaseComponent {
  phase = input.required<PhaseExercice>();
  numero = input<string | null>(null);
  intitule = input<string | null>(null);

  lettre = computed(() => PHASES.find(p => p.valeur === this.phase())?.lettre ?? '?');
  titre = computed(() => {
    const exercice = [this.numero(), this.intitule()].filter(Boolean).join(' ');
    return libellePhase(this.phase()) + (exercice ? ' · ' + exercice : '');
  });
}
