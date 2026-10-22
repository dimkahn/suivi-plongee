import { Component, computed, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { DialogueComponent } from '../../core/dialogue.component';
import { MAGASIN_CACHE, ecrire, lire } from '../../core/base-locale';
import {
  CONTENUS_HORS_LIGNE, ChoixHorsLigne, ContenuHorsLigne, FormuleHorsLigne, LIBELLES_CONTENUS, PeriodeHorsLigne,
  choixDeLaFormule, formuleDuChoix
} from '../../core/preparation-hors-ligne';

const CLE = 'preference:choix-hors-ligne';

/** Le choix tel qu'il est gardé sur l'appareil (un Set ne se range pas tel quel). */
interface ChoixGarde { contenus: ContenuHorsLigne[]; periode: PeriodeHorsLigne; }

/**
 * Fenêtre « Préparer hors ligne » : on choisit ce qu'on emporte (tout, la
 * séance du jour, la seule fiche de sécurité du jour, ou sur mesure). Le
 * dernier choix est reproposé à l'ouverture suivante.
 */
@Component({
  selector: 'app-preparer-hors-ligne',
  imports: [DialogueComponent],
  template: `
    <app-dialogue [ouvert]="ouvert()" titre="Préparer hors ligne" (fermer)="ouvert.set(false)">
      <p class="aide">Avec du réseau, avant de partir : choisissez ce dont vous aurez besoin sans réseau.</p>

      <fieldset class="formules">
        <legend>Que voulez-vous emporter ?</legend>
        @for (f of formules; track f.valeur) {
          <label class="option" [class.choisie]="formule() === f.valeur">
            <input type="radio" name="formule-hors-ligne" [checked]="formule() === f.valeur"
                   (change)="choisirFormule(f.valeur)">
            <span>
              <strong>{{ f.titre }}</strong>
              <span class="detail">{{ f.detail }}</span>
            </span>
          </label>
        }
      </fieldset>

      @if (formule() === 'sur-mesure') {
        <fieldset class="contenus">
          <legend>Contenu</legend>
          @for (c of contenus; track c) {
            <label class="option">
              <input type="checkbox" [checked]="contenusChoisis().has(c)" (change)="basculer(c)">
              <span>
                <strong>{{ libelles[c].titre }}</strong>
                <span class="detail">{{ libelles[c].detail }}</span>
              </span>
            </label>
          }
        </fieldset>
        <fieldset class="periode">
          <legend>Présences et fiches de sécurité</legend>
          <label class="option">
            <input type="radio" name="periode-hors-ligne" [checked]="periode() === 'jour'" (change)="periode.set('jour')">
            <span><strong>Séances d'aujourd'hui</strong></span>
          </label>
          <label class="option">
            <input type="radio" name="periode-hors-ligne" [checked]="periode() === 'proches'" (change)="periode.set('proches')">
            <span><strong>Séances à 30 jours</strong> <span class="detail">avant et après aujourd'hui</span></span>
          </label>
        </fieldset>
      }

      <div class="actions-dialogue">
        <button type="button" class="bouton-discret" (click)="ouvert.set(false)">Annuler</button>
        <button type="button" class="bouton-principal" [disabled]="contenusChoisis().size === 0"
                (click)="valider()">Préparer</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .aide { margin-top: 0; color: var(--craie); }
    fieldset { border: none; padding: 0; margin: 0 0 var(--pas-3); display: grid; gap: var(--pas); }
    legend { font-weight: 700; margin-bottom: var(--pas); padding: 0; }
    .option {
      display: flex; align-items: flex-start; gap: var(--pas-2); min-height: 44px;
      padding: var(--pas) var(--pas-2); border: 1px solid var(--trait); border-radius: var(--r-s);
      cursor: pointer;
    }
    .option.choisie { border-color: var(--profond); background: var(--fond); }
    .option input { width: 22px; height: 22px; margin: 2px 0 0; flex: none; }
    .option strong { display: block; }
    .detail { color: var(--craie); font-size: .875rem; }
  `]
})
export class PreparerHorsLigneComponent {
  /** Le choix validé : le bandeau lance le préchargement et en montre le bilan. */
  preparer = output<ChoixHorsLigne>();

  readonly ouvert = signal(false);
  readonly contenusChoisis = signal<Set<ContenuHorsLigne>>(new Set(CONTENUS_HORS_LIGNE));
  readonly periode = signal<PeriodeHorsLigne>('proches');
  /** « Sur mesure » reste affiché tant qu'on y coche, même si le choix retombe sur une formule. */
  private readonly surMesure = signal(false);
  readonly formule = computed<FormuleHorsLigne>(() => this.surMesure()
    ? 'sur-mesure'
    : formuleDuChoix({ contenus: this.contenusChoisis(), periode: this.periode() }));

  readonly contenus = CONTENUS_HORS_LIGNE;
  readonly libelles = LIBELLES_CONTENUS;
  readonly formules: { valeur: FormuleHorsLigne; titre: string; detail: string }[] = [
    { valeur: 'tout', titre: 'Tout', detail: 'notes, présences, fiches de sécurité, planning, infos élèves, photos et séjours ; à 30 jours' },
    { valeur: 'seance-du-jour', titre: 'La séance du jour', detail: "appel, notes des élèves et fiche de sécurité d'aujourd'hui, sans les photos" },
    { valeur: 'fiche-du-jour', titre: 'La fiche de sécurité du jour', detail: "seulement les fiches de sécurité d'aujourd'hui : le plus rapide" },
    { valeur: 'sur-mesure', titre: 'Sur mesure', detail: 'cochez ce que vous voulez' }
  ];

  async ouvrir(): Promise<void> {
    const garde = await lire<{ cle: string; valeur: ChoixGarde }>(MAGASIN_CACHE, CLE).catch(() => undefined);
    if (garde?.valeur) {
      this.contenusChoisis.set(new Set(garde.valeur.contenus.filter(c => CONTENUS_HORS_LIGNE.includes(c))));
      this.periode.set(garde.valeur.periode === 'jour' ? 'jour' : 'proches');
    }
    this.surMesure.set(formuleDuChoix({ contenus: this.contenusChoisis(), periode: this.periode() }) === 'sur-mesure');
    this.ouvert.set(true);
  }

  choisirFormule(formule: FormuleHorsLigne): void {
    this.surMesure.set(formule === 'sur-mesure');
    if (formule === 'sur-mesure') return;
    const choix = choixDeLaFormule(formule);
    this.contenusChoisis.set(choix.contenus);
    this.periode.set(choix.periode);
  }

  basculer(contenu: ContenuHorsLigne): void {
    const contenus = new Set(this.contenusChoisis());
    if (contenus.has(contenu)) contenus.delete(contenu);
    else contenus.add(contenu);
    this.contenusChoisis.set(contenus);
  }

  valider(): void {
    const choix: ChoixHorsLigne = { contenus: this.contenusChoisis(), periode: this.periode() };
    void ecrire(MAGASIN_CACHE, {
      cle: CLE, valeur: { contenus: [...choix.contenus], periode: choix.periode } satisfies ChoixGarde, majLe: Date.now()
    }).catch(() => {});
    this.ouvert.set(false);
    this.preparer.emit(choix);
  }
}
