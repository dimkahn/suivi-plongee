import { ChangeDetectionStrategy, Component, OnDestroy, effect, input, signal, untracked } from '@angular/core';
import { LecturePhotoJournee } from './sejour-api';

/**
 * Une photo d'un lieu d'une journée du programme. Elle demande le jeton
 * (compte ou lien) : lue par l'API, affichée par une adresse locale libérée
 * quand le composant disparaît. Tant qu'elle n'est pas là, la place reste grise.
 */
@Component({
  selector: 'app-photo-journee',
  template: `
    @if (url(); as u) {
      <img [src]="u" [alt]="alt()">
    } @else {
      <span class="attente" role="img" [attr.aria-label]="erreur() ? 'Photo indisponible' : 'Chargement de la photo'"></span>
    }
  `,
  styles: [`
    :host { display: block; }
    img, .attente { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: var(--r-s);
                    background: var(--trait); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhotoJourneeComponent implements OnDestroy {
  jour = input.required<string>();
  photoId = input.required<number>();
  lire = input.required<LecturePhotoJournee>();
  alt = input('Photo du lieu');

  readonly url = signal<string | null>(null);
  readonly erreur = signal(false);

  constructor() {
    effect(() => {
      const jour = this.jour(), id = this.photoId(), lire = this.lire();
      untracked(() => {
        this.liberer();
        this.erreur.set(false);
        lire(jour, id).subscribe({
          next: blob => { if (id === this.photoId()) this.url.set(URL.createObjectURL(blob)); },
          error: () => this.erreur.set(true)
        });
      });
    });
  }

  private liberer(): void {
    const u = this.url();
    if (u) URL.revokeObjectURL(u);
    this.url.set(null);
  }

  ngOnDestroy(): void {
    this.liberer();
  }
}
