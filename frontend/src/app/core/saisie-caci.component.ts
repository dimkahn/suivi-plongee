import { Component, input, model, ChangeDetectionStrategy } from '@angular/core';
import { CACI_ENSEMBLE, CASES_CACI, MEDECINS_CACI } from './caci';

/**
 * Champs du CACI, communs au dossier d'un élève et à la fiche d'un moniteur :
 * fin de validité, date de l'examen, médecin signataire et cases cochées du
 * formulaire FFESSM. Chaque valeur se lie en double sens
 * (`[(finValidite)]`, `[(dateExamen)]`, `[(medecin)]`, `[(activites)]`).
 * Les champs n'utilisent pas ngModel : ils ne s'inscrivent pas dans le
 * formulaire de l'écran parent.
 */
@Component({
  selector: 'app-saisie-caci',
  template: `
    <label [for]="prefixe() + 'caci'">CACI valide jusqu'au</label>
    <input [id]="prefixe() + 'caci'" type="date" [value]="finValidite()"
           (change)="finValidite.set($any($event.target).value)">
    <label [for]="prefixe() + 'caciExamen'">Date de l'examen (CACI)</label>
    <input [id]="prefixe() + 'caciExamen'" type="date" [value]="dateExamen()"
           (change)="changerDateExamen($any($event.target).value)">
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
  finValidite = model('');
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

  /** Le CACI vaut un an : la fin de validité se propose si elle est encore vide. */
  changerDateExamen(date: string): void {
    this.dateExamen.set(date);
    if (date && !this.finValidite()) {
      const fin = new Date(date + 'T12:00:00');
      fin.setFullYear(fin.getFullYear() + 1);
      fin.setDate(fin.getDate() - 1);
      this.finValidite.set(`${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`);
    }
  }
}
