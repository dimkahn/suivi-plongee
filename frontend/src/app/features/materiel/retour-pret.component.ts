import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemandeRetour, PretVue } from '../../core/modeles';
import { dateDuJour } from '../../core/date-fr';
import { nomEquipement } from '../../core/nom-equipement';
import { DialogueComponent } from '../../core/dialogue.component';
import { PhotosPretComponent } from './photos-pret.component';

interface LigneRetour { incident: string; horsService: boolean; }

/**
 * Fenêtre « Retour du matériel » : date, incident et mise hors service par
 * équipement, désinfection au retour d'un détendeur déclaré depuis un
 * séjour, photos, remarques. Sert à l'écran des prêts et à la fiche d'un
 * équipement (ouverte au scanner) ; l'écran envoie la demande et affiche
 * l'erreur. Le prêt se rend en entier, avec tous ses équipements.
 */
@Component({
  selector: 'app-retour-pret',
  imports: [FormsModule, DialogueComponent, PhotosPretComponent],
  template: `
    <app-dialogue [ouvert]="pret() !== null" [erreur]="erreur()" (fermer)="fermer.emit()"
                  [titre]="'Retour du matériel de ' + (pret()?.emprunteur ?? '')">
      @if (pret(); as p) {
        @if (p.equipements.length > 1) {
          <p class="secondaire">Le prêt se rend en entier : {{ p.equipements.length }} équipements.</p>
        }
        <label [for]="'dateRetour-' + p.id">Date de retour</label>
        <input [id]="'dateRetour-' + p.id" type="date" [min]="p.datePret" [max]="aujourdhui"
               [(ngModel)]="dateRetour">
        @for (e of p.equipements; track e.id) {
          <div class="retour-equipement">
            <label [for]="'incident-' + e.id">{{ e.typeLibelle }} {{ nom(e) }} : incident éventuel</label>
            <input [id]="'incident-' + e.id" [(ngModel)]="lignes[e.id].incident"
                   placeholder="Rien à signaler">
            <label class="case">
              <input type="checkbox" [(ngModel)]="lignes[e.id].horsService">
              Mettre hors service
            </label>
          </div>
        }
        @if (p.desinfectionAuRetour) {
          <label class="case desinfection">
            <input type="checkbox" [(ngModel)]="desinfecte">
            Le détendeur a été désinfecté au retour (obligatoire : l'emprunteur l'a déclaré lui-même
            depuis le séjour ; inscrit à son journal).
          </label>
        }
        <h3 class="titre-photos">Photos de l'état au retour</h3>
        <app-photos-pret [pret]="p" (nombres)="nombres.emit({ pretId: p.id, avant: $event.avant, apres: $event.apres })" />
        <label [for]="'remarquesRetour-' + p.id">Remarques</label>
        <textarea [id]="'remarquesRetour-' + p.id" rows="2" [(ngModel)]="remarques"></textarea>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" (click)="valider.emit(demande(p))" [disabled]="envoi()">
            {{ envoi() ? 'Enregistrement…' : 'Valider le retour' }}
          </button>
          <button type="button" class="bouton-discret" (click)="fermer.emit()">Annuler</button>
        </div>
      }
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .case { display: flex; align-items: flex-start; gap: var(--pas); font-weight: 400; min-height: 44px; margin: 0; padding: var(--pas) 0; }
    .case input { width: auto; flex: none; margin-top: 4px; }
    textarea { resize: vertical; }
    .retour-equipement { border-top: 1px solid var(--trait); margin-top: var(--pas-2); }
    .case.desinfection { font-weight: 700; border-top: 1px solid var(--trait); margin-top: var(--pas-2); }
    .titre-photos { margin: var(--pas-2) 0 0; padding-top: var(--pas-2); border-top: 1px solid var(--trait); font-size: 1rem; }
  `]
})
export class RetourPretComponent {
  /** Le prêt à rendre ; null : fenêtre fermée. */
  pret = input<PretVue | null>(null);
  erreur = input<string | null>(null);
  envoi = input(false);

  fermer = output<void>();
  valider = output<DemandeRetour>();
  nombres = output<{ pretId: number; avant: number; apres: number }>();

  readonly nom = nomEquipement;
  readonly aujourdhui = dateDuJour();

  dateRetour = dateDuJour();
  lignes: Record<number, LigneRetour> = {};
  remarques = '';
  desinfecte = false;

  constructor() {
    // Formulaire vierge à chaque prêt ouvert.
    let ouvert: number | null = null;
    effect(() => {
      const p = this.pret();
      if (p?.id === ouvert) return;
      ouvert = p?.id ?? null;
      if (!p) return;
      this.dateRetour = this.aujourdhui;
      this.remarques = '';
      this.desinfecte = false;
      this.lignes = {};
      for (const e of p.equipements) this.lignes[e.id] = { incident: '', horsService: false };
    });
  }

  demande(p: PretVue): DemandeRetour {
    return {
      dateRetour: this.dateRetour,
      equipements: p.equipements.map(e => ({
        equipementId: e.id,
        incident: this.lignes[e.id]?.incident.trim() || null,
        horsService: !!this.lignes[e.id]?.horsService
      })),
      remarques: this.remarques.trim() || null,
      detendeursDesinfectes: p.desinfectionAuRetour ? this.desinfecte : undefined
    };
  }
}
