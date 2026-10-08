import { ChangeDetectionStrategy, Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Schéma d'un exercice : celui de la base (`exerciceId`) ou celui d'un
 * exercice libre du programme d'une séance (`seanceId` + `schemaId`).
 * L'image demande le jeton d'accès, elle est donc lue par l'API (et gardée
 * sur l'appareil pour le hors ligne) puis affichée par une adresse locale,
 * libérée quand le composant disparaît.
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

  /** Exercice de la base. */
  exerciceId = input<number | null>(null);
  /** Exercice libre du programme : sa séance et son schéma. */
  seanceId = input<number | null>(null);
  schemaId = input<number | null>(null);
  /** Numéro et intitulé, pour le texte de remplacement. */
  libelle = input<string | null>(null);
  /** Change après un nouveau dépôt, pour relire l'image. */
  version = input(0);

  url = signal<string | null>(null);
  erreur = signal(false);

  constructor() {
    effect(() => {
      const cle = this.cle();
      this.version();
      untracked(() => void this.charger(cle));
    });
  }

  private cle(): string {
    return `${this.exerciceId()}/${this.seanceId()}/${this.schemaId()}`;
  }

  private async charger(cle: string): Promise<void> {
    this.liberer();
    this.erreur.set(false);
    const exerciceId = this.exerciceId();
    const seanceId = this.seanceId();
    const schemaId = this.schemaId();
    try {
      const blob = exerciceId != null ? await this.api.schemaExercice(exerciceId)
        : seanceId != null && schemaId != null ? await this.api.schemaProgramme(seanceId, schemaId)
        : null;
      if (!blob) { this.erreur.set(true); return; }
      if (cle === this.cle()) this.url.set(URL.createObjectURL(blob));
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
