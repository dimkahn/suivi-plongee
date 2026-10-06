import { Component, ElementRef, effect, input, output, viewChild, ChangeDetectionStrategy } from '@angular/core';

let compteur = 0;

/**
 * Fenêtre de dialogue des créations et modifications : le formulaire s'ouvre
 * devant la liste au lieu de s'insérer dedans (sur téléphone, il prend tout
 * l'écran). L'écran parent garde l'état : `ouvert` ouvre ou ferme la
 * fenêtre, `fermer` signale qu'elle a été fermée (croix, touche Échap ou
 * `ouvert` repassé à faux) et `erreur` affiche le refus du serveur dans la
 * fenêtre, sans quoi il resterait caché derrière.
 *
 * Le contenu (champs, puis boutons dans un `<div class="actions-dialogue">`)
 * est projeté : il garde les styles de l'écran parent. Un toucher à côté de
 * la fenêtre ne la ferme pas, pour ne pas perdre une saisie.
 */
@Component({
  selector: 'app-dialogue',
  template: `
    <dialog #fenetre class="dialogue-formulaire" [class.large]="large()"
            [attr.aria-labelledby]="idTitre" (close)="fermer.emit()">
      @if (ouvert()) {
        <div class="entete-dialogue">
          <h2 [id]="idTitre">{{ titre() }}</h2>
          <button type="button" class="bouton-discret fermer-dialogue" aria-label="Fermer"
                  (click)="fenetre.close()">✕</button>
        </div>
        @if (erreur(); as e) { <div class="alerte" role="alert">{{ e }}</div> }
        <ng-content />
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager
})
export class DialogueComponent {
  ouvert = input(false);
  titre = input.required<string>();
  erreur = input<string | null>(null);
  /** Fenêtre plus large, pour les formulaires en plusieurs colonnes. */
  large = input(false);
  fermer = output<void>();

  readonly idTitre = `titre-dialogue-${++compteur}`;
  private fenetre = viewChild.required<ElementRef<HTMLDialogElement>>('fenetre');

  constructor() {
    effect(() => {
      const d = this.fenetre().nativeElement;
      if (this.ouvert() && !d.open) d.showModal();
      else if (!this.ouvert() && d.open) d.close();
    });
  }
}
