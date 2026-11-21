import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DialogueComponent } from './dialogue.component';

/**
 * « ⋯ » : les actions moins courantes d'une carte (envoyer, désigner…),
 * dans une petite fenêtre plutôt qu'empilées sous la carte, où elles en
 * doublaient la hauteur au téléphone. Les boutons sont projetés ; en toucher
 * un ferme la fenêtre avant son action. « Supprimer » va de préférence dans
 * la fenêtre « Modifier » ; sans elle (compte désactivé), en dernier ici,
 * classe « danger », séparé des autres : fenêtre puis confirmation.
 */
@Component({
  selector: 'app-plus-actions',
  imports: [DialogueComponent],
  template: `
    <button type="button" class="bouton-discret plus-actions" (click)="ouvert.set(true)"
            [attr.aria-label]="'Autres actions pour ' + sujet()">
      <span aria-hidden="true">⋯</span>
    </button>
    <app-dialogue [ouvert]="ouvert()" [choix]="true" [titre]="sujet()" (fermer)="ouvert.set(false)">
      <!-- Toucher une action ferme la fenêtre, puis l'action suit son cours. -->
      <div class="liste-plus" (click)="fermerSurBouton($event)">
        <ng-content />
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .plus-actions { min-width: 44px; min-height: 44px; justify-content: center; font-size: 1.25rem; line-height: 1; }
    .liste-plus { display: grid; gap: var(--pas); }
    .liste-plus ::ng-deep .danger { margin-top: var(--pas-2); }
    .liste-plus ::ng-deep button, .liste-plus ::ng-deep a {
      width: 100%; min-height: 48px; justify-content: flex-start; text-align: left;
    }
  `]
})
export class PlusActionsComponent {
  /** Ce sur quoi portent les actions : titre de la fenêtre et nom du bouton (« Autres actions pour … »). */
  sujet = input.required<string>();
  ouvert = signal(false);

  fermerSurBouton(e: Event): void {
    if ((e.target as HTMLElement).closest('button, a')) this.ouvert.set(false);
  }
}
