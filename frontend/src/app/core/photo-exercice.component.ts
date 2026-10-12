import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Une photo d'un exercice de la base. Comme le schéma, elle demande le jeton
 * d'accès : lue par l'API (et gardée sur l'appareil), affichée par une
 * adresse locale libérée quand le composant disparaît.
 */
@Component({
  selector: 'app-photo-exercice',
  standalone: true,
  template: `
    @if (url(); as u) {
      <img class="photo" [src]="u" [alt]="legende() || 'Photo de l’exercice'">
    } @else if (erreur()) {
      <p class="secondaire">Photo indisponible (hors ligne ?).</p>
    } @else {
      <p class="secondaire">Chargement de la photo…</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .photo { display: block; width: 100%; height: auto; border-radius: var(--r-s); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhotoExerciceComponent implements OnDestroy {
  private api = inject(ApiService);

  exerciceId = input.required<number>();
  photoId = input.required<number>();
  legende = input<string | null>(null);

  url = signal<string | null>(null);
  erreur = signal(false);

  constructor() {
    effect(() => {
      const exerciceId = this.exerciceId();
      const photoId = this.photoId();
      untracked(() => void this.charger(exerciceId, photoId));
    });
  }

  private async charger(exerciceId: number, photoId: number): Promise<void> {
    this.liberer();
    this.erreur.set(false);
    try {
      const blob = await this.api.photoExercice(exerciceId, photoId);
      if (photoId === this.photoId()) this.url.set(URL.createObjectURL(blob));
    } catch {
      this.erreur.set(true);
    }
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
