import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CACI_LIMITES, CASES_CACI, couleurCaci, libelleCaci, libelleMedecinCaci } from './caci';
import { DateFrPipe } from './date-fr';

/**
 * Détail du CACI d'un élève ou d'un moniteur, en lecture seule : échéance,
 * date de l'examen, médecin et toutes les cases du formulaire FFESSM, les
 * cochées en gras. Se place dans un dialogue ou une page.
 */
@Component({
  selector: 'app-detail-caci',
  imports: [DateFrPipe],
  template: `
    @let couleur = couleurCaci(finValidite());
    <p class="etat-caci" [class]="couleur ? 'caci-' + couleur : 'caci-alerte'">{{ libelleCaci(finValidite()) }}</p>
    <p>
      Date de l'examen :
      <strong>{{ dateExamen() ? (dateExamen() | dateFr) : 'non renseignée' }}</strong>
      <br>Médecin : <strong>{{ libelleMedecinCaci(medecin()) }}</strong>
    </p>
    @if (activites().includes(limites)) {
      <div class="alerte" role="note">
        Le médecin a fixé des limites et préconisations : lisez le certificat papier avant de plonger.
      </div>
    }
    @if (activites().length === 0) {
      <p class="secondaire">Les cases cochées sur le CACI n'ont pas été saisies.</p>
    }
    @for (g of groupes; track g.titre) {
      <h3 class="titre-cases">{{ g.titre }}</h3>
      <ul class="cases-caci">
        @for (c of g.cases; track c.code) {
          @let cochee = activites().includes(c.code);
          <li [class.cochee]="cochee">
            <span class="marque" role="img" [attr.aria-label]="cochee ? 'cochée' : 'non cochée'">{{ cochee ? '☑' : '☐' }}</span>
            {{ c.libelle }}
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    .etat-caci { font-weight: 700; }
    /* Échéance : plus d'un mois, moins d'un mois, moins de 15 jours ; expiré ou absent. */
    .caci-vert { color: var(--acquis); }
    .caci-orange { color: var(--en-cours); }
    .caci-rouge, .caci-alerte { color: #B3261E; }
    .titre-cases { margin: var(--pas-2) 0 4px; font-size: 1rem; }
    .cases-caci { list-style: none; margin: 0; padding: 0; }
    .cases-caci li { padding: 4px 0; color: var(--craie); }
    .cases-caci li.cochee { color: var(--encre); font-weight: 700; }
    .marque { display: inline-block; width: 1.5em; font-size: 1.125rem; }
  `]
})
export class DetailCaciComponent {
  finValidite = input<string | null>(null);
  dateExamen = input<string | null>(null);
  medecin = input<string | null>(null);
  activites = input<string[]>([]);

  readonly groupes = CASES_CACI;
  readonly limites = CACI_LIMITES;
  readonly couleurCaci = couleurCaci;
  readonly libelleCaci = libelleCaci;
  readonly libelleMedecinCaci = libelleMedecinCaci;
}
