import { Component, computed, input, model, ChangeDetectionStrategy } from '@angular/core';
import { CACI_ENSEMBLE, CASES_CACI, MEDECINS_CACI, finValiditeCaci } from './caci';
import { DateFrPipe, dateDuJour } from './date-fr';

/**
 * Champs du CACI, communs au dossier d'un élève et à la fiche d'un moniteur :
 * date de l'examen (la fin de validité, un an après, s'affiche sans se
 * saisir), médecin signataire et cases cochées du formulaire FFESSM. Chaque
 * valeur se lie en double sens (`[(dateExamen)]`, `[(medecin)]`, `[(activites)]`).
 * Les champs n'utilisent pas ngModel : ils ne s'inscrivent pas dans le
 * formulaire de l'écran parent.
 */
@Component({
  selector: 'app-saisie-caci',
  imports: [DateFrPipe],
  template: `
    <label [for]="prefixe() + 'caciExamen'">Date de l'examen (CACI)</label>
    <input [id]="prefixe() + 'caciExamen'" type="date" [value]="dateExamen()" [max]="aujourdhui"
           (input)="dateExamen.set($any($event.target).value)">
    <p class="fin-validite" aria-live="polite">
      @if (finValidite(); as fin) {
        Valide jusqu'au <strong>{{ fin | dateFr }}</strong> (un an après l'examen).
      } @else {
        La fin de validité se calcule à partir de la date de l'examen.
      }
    </p>
    <label [for]="prefixe() + 'caciMedecin'">Médecin signataire</label>
    <select [id]="prefixe() + 'caciMedecin'" (change)="medecin.set($any($event.target).value)">
      <option value="" [selected]="!medecin()">Non renseigné</option>
      @for (m of medecins; track m.code) {
        <option [value]="m.code" [selected]="medecin() === m.code">{{ m.libelle }}</option>
      }
    </select>
    <!-- Cases du CACI FFESSM (version juin 2026) : les cases seulement, jamais le texte écrit par le médecin. -->
    <fieldset class="cases-caci">
      <legend>Cases cochées sur le CACI</legend>
      @for (g of groupes; track g.titre) {
        <p class="titre-cases">{{ g.titre }}</p>
        @for (c of g.cases; track c.code) {
          <label class="case">
            <input type="checkbox" [checked]="activites().includes(c.code)"
                   [disabled]="g.seulement && activites().includes(ensemble)"
                   (change)="basculer(c.code, $any($event.target).checked)">
            {{ c.libelle }}
          </label>
        }
      }
      <p class="aide-cases">Le texte écrit par le médecin (activités en compétition, limites) n'est pas recopié : il reste sur le certificat papier.</p>
    </fieldset>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    /* Mêmes étiquettes que les formulaires Élèves et Moniteurs. */
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .fin-validite { margin: 4px 0 0; font-size: .875rem; color: var(--craie); }
    .fin-validite strong { color: var(--encre); }
    .cases-caci { border: 1px solid var(--trait); border-radius: 8px; padding: var(--pas) var(--pas-2); margin: var(--pas) 0; }
    .cases-caci legend { font-weight: 700; padding: 0 4px; }
    .case { display: flex; align-items: center; gap: var(--pas); min-height: 44px; margin: 0; font-weight: 400; }
    .case input { width: auto; }
    .titre-cases { margin: var(--pas) 0 0; font-size: .875rem; color: var(--craie); font-weight: 700; }
    .aide-cases { margin: var(--pas) 0 0; font-size: .8125rem; color: var(--craie); }
  `]
})
export class SaisieCaciComponent {
  /** Préfixe des identifiants, pour deux formulaires dans la même page. */
  prefixe = input('');
  dateExamen = model('');
  medecin = model('');
  activites = model<string[]>([]);

  readonly groupes = CASES_CACI;
  readonly medecins = MEDECINS_CACI;
  readonly ensemble = CACI_ENSEMBLE;

  /** « L'ensemble des activités » décoche les cases « ou bien seulement », comme sur le formulaire. */
  basculer(code: string, cochee: boolean): void {
    const seulement = CASES_CACI.filter(g => g.seulement).flatMap(g => g.cases.map(c => c.code));
    let cases = this.activites().filter(c => c !== code);
    if (cochee) {
      if (code === CACI_ENSEMBLE) cases = cases.filter(c => !seulement.includes(c));
      cases.push(code);
    }
    this.activites.set(cases);
  }

  /** Calculée, jamais saisie : le serveur fait le même calcul. */
  finValidite = computed(() => finValiditeCaci(this.dateExamen()));
  /** Pas d'examen dans le futur (le serveur le refuse aussi). */
  readonly aujourdhui = dateDuJour();
}
