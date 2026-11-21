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
 *
 * Avec `confirmerFermeture` (une question), la croix, « Fermer » et Échap
 * la posent d'abord : la fenêtre ne se ferme que sur « OK ». À donner
 * seulement quand une saisie serait perdue ; `ouvert` repassé à faux ferme
 * sans question (après un enregistrement réussi).
 *
 * Avec `choix`, une fenêtre de choix plus légère (choisir une séance, une
 * date, une action) : pas plein écran sur téléphone, « Fermer » en toutes
 * lettres (styles.css, `.dialogue-seance`).
 */
@Component({
  selector: 'app-dialogue',
  template: `
    <dialog #fenetre [class]="choix() ? 'dialogue-seance' : 'dialogue-formulaire'" [class.large]="large()"
            [attr.aria-labelledby]="idTitre" (cancel)="surEchap($event)" (close)="fermer.emit()">
      @if (ouvert()) {
        <div class="entete-dialogue">
          <h2 [id]="idTitre">{{ titre() }}</h2>
          @if (choix()) {
            <button type="button" class="bouton-discret" (click)="demanderFermeture()">Fermer</button>
          } @else {
            <button type="button" class="bouton-discret fermer-dialogue" aria-label="Fermer"
                    (click)="demanderFermeture()">✕</button>
          }
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
  /** Fenêtre de choix plutôt que formulaire. */
  choix = input(false);
  /** Question posée avant de fermer par la croix, « Fermer » ou Échap ; null : fermer sans question. */
  confirmerFermeture = input<string | null>(null);
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

  demanderFermeture(): void {
    if (this.fermetureAcceptee()) this.fenetre().nativeElement.close();
  }

  /** Échap : le navigateur fermerait la fenêtre ; on la garde si la question est refusée. */
  surEchap(evenement: Event): void {
    if (!this.fermetureAcceptee()) evenement.preventDefault();
  }

  private fermetureAcceptee(): boolean {
    const question = this.confirmerFermeture();
    return question == null || confirm(question);
  }
}
