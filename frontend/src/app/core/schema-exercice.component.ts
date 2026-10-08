import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Schéma d'un exercice de la base : l'image demande le jeton d'accès, elle
 * est donc lue par l'API (et gardée sur l'appareil pour le hors ligne) puis
 * affichée par une adresse locale, libérée quand le composant disparaît.
 */
@Component({
  selector: 'app-schema-exercice',
  standalone: true,
  template: `
    @if (url(); as u) {
      <img class="schema" [src]="u" [alt]="'Schéma de l’exercice ' + (libelle() ?? '')">
    } @else if (erreur()) {
      <p class="secondaire">Schéma indisponible (hors ligne ?).</p>
    } @else {
      <p class="secondaire">Chargement du schéma…</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .schema { display: block; width: 100%; max-width: 560px; height: auto; border-radius: var(--r-s); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchemaExerciceComponent implements OnDestroy {
  private api = inject(ApiService);

  exerciceId = input.required<number>();
  /** Numéro et intitulé, pour le texte de remplacement. */
  libelle = input<string | null>(null);
  /** Change après un nouveau dépôt, pour relire l'image. */
  version = input(0);

  url = signal<string | null>(null);
  erreur = signal(false);

  constructor() {
    effect(() => {
      const id = this.exerciceId();
      this.version();
      untracked(() => void this.charger(id));
    });
  }

  private async charger(id: number): Promise<void> {
    this.liberer();
    this.erreur.set(false);
    try {
      const blob = await this.api.schemaExercice(id);
      if (id === this.exerciceId()) this.url.set(URL.createObjectURL(blob));
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
