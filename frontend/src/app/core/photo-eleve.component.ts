import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Vignette ronde d'un élève dans un tableau (synthèses) : sa photo si elle
 * est consultable (`aPhoto`, droit à l'image accordé, dit par le serveur),
 * sinon ses initiales. La photo vient du cache de l'appareil si elle y est.
 */
@Component({
  selector: 'app-photo-eleve',
  template: `
    @if (url(); as u) {
      <!-- alt vide : le nom de l'élève suit toujours la vignette. -->
      <img class="avatar" [src]="u" alt="" [width]="taille()" [height]="taille()">
    } @else {
      <span class="avatar silhouette" aria-hidden="true">{{ initiales() }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .avatar { width: var(--taille); height: var(--taille); border-radius: 50%; object-fit: cover; background: var(--fond); }
    .silhouette { display: flex; align-items: center; justify-content: center;
                  font-family: var(--font-titres), sans-serif; font-size: .75rem; font-weight: 700; color: var(--craie); }
  `],
  host: { '[style.--taille.px]': 'taille()' }
})
export class PhotoEleveComponent implements OnDestroy {
  private api = inject(ApiService);

  readonly eleveId = input.required<number>();
  readonly nom = input.required<string>();
  readonly aPhoto = input(false);
  readonly taille = input(40);

  url = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.eleveId();
      const aPhoto = this.aPhoto();
      untracked(() => {
        this.liberer();
        if (aPhoto) {
          this.api.photoEleve(id).then(
            blob => { if (this.eleveId() === id) this.url.set(URL.createObjectURL(blob)); },
            () => { /* pas de photo consultable : les initiales restent affichées */ }
          );
        }
      });
    });
  }

  initiales(): string {
    return this.nom().split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
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
