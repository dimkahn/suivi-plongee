import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';
import { AvatarComponent } from './avatar.component';

/**
 * Vignette ronde d'un élève dans un tableau (synthèses) : sa photo si elle
 * est consultable (`aPhoto`, droit à l'image accordé, dit par le serveur),
 * sinon ses initiales. La photo vient du cache de l'appareil si elle y est.
 */
@Component({
  selector: 'app-photo-eleve',
  imports: [AvatarComponent],
  // alt vide : le nom de l'élève suit toujours la vignette.
  template: `<app-avatar [url]="url()" [nom]="nom()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: inline-flex; flex: none; }`],
  host: { '[style.--taille-avatar.px]': 'taille()' }
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

  private liberer(): void {
    const u = this.url();
    if (u) URL.revokeObjectURL(u);
    this.url.set(null);
  }

  ngOnDestroy(): void {
    this.liberer();
  }
}
