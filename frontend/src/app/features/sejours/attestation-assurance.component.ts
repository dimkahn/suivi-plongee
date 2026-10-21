import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { reduirePhoto } from '../../core/reduire-photo';
import { PortAttestationAssurance } from './sejour-api';
import { envoiCarte } from './voyage';
import { texteAvecLiens } from './texte-liens';
import { montrerCarte } from './carte-voyage.component';

/**
 * L'attestation d'assurance d'un participant au séjour (V99, demande du
 * club, 2026) : l'ajouter (PDF ou photo), l'ouvrir, la remplacer, la
 * retirer. Dans « Mon séjour » pour la sienne ; dans la fiche de chaque
 * participant pour les organisateurs. Comme la carte d'embarquement, une
 * photo est recodée par le téléphone (sans sa position GPS) avant l'envoi.
 */
@Component({
  selector: 'app-attestation-assurance',
  template: `
    <div class="attestation sans-impression" role="group" [attr.aria-label]="titre()">
      <span class="etiquette">{{ titre() }}</span>
      @if (type(); as t) {
        <p class="jointe">✓ Attestation jointe ({{ t === 'application/pdf' ? 'PDF' : 'photo' }})</p>
        <div class="boutons">
          <button type="button" class="bouton-principal" (click)="montrer()" [disabled]="envoi()">Ouvrir</button>
          <label class="bouton-discret" [class.inactif]="envoi()">
            Remplacer
            <input type="file" class="masque" [accept]="formats" [disabled]="envoi()" (change)="choisir($event)">
          </label>
          <button type="button" class="bouton-discret" (click)="retirer()" [disabled]="envoi()">Retirer</button>
        </div>
      } @else {
        @if (conseil(); as c) {
          <p class="conseil texte-libre" role="note">@for (m of morceaux(); track $index) {@if (m.lien) {<a [href]="m.lien" target="_blank" rel="noopener noreferrer">{{ m.texte }}</a>} @else {<span>{{ m.texte }}</span>}}</p>
        }
        <label class="bouton-discret ajout" [class.inactif]="envoi()">
          @if (envoi()) { Envoi… } @else { + Ajouter l'attestation d'assurance (PDF ou photo) }
          <input type="file" class="masque" [accept]="formats" [disabled]="envoi()" (change)="choisir($event)">
        </label>
      }
      @if (erreur(); as e) { <p class="erreur" role="alert">{{ e }}</p> }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .attestation { margin-top: var(--pas); padding: var(--pas) var(--pas-2); border: 1px solid var(--trait);
                   border-radius: var(--r-s); background: #F8FAFC; }
    .etiquette { display: block; margin-bottom: var(--pas); font-size: .75rem; font-weight: 700;
                 text-transform: uppercase; letter-spacing: .04em; color: var(--craie); }
    .jointe { margin: 0 0 var(--pas); font-weight: 700; color: #166534; }
    .boutons { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: var(--pas); }
    .boutons button, .boutons label, .ajout { min-height: 44px; margin: 0; width: 100%; box-sizing: border-box;
                                              display: inline-flex; align-items: center; justify-content: center;
                                              text-align: center; }
    @media (max-width: 340px) { .boutons { grid-auto-flow: row; } }
    label { cursor: pointer; }
    .inactif { opacity: .6; pointer-events: none; }
    .masque { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
    .erreur { margin: var(--pas) 0 0; color: #B91C1C; font-weight: 700; }
    .conseil { margin: 0 0 var(--pas); padding: var(--pas) var(--pas-2); border-radius: var(--r-s);
               border: 2px solid var(--en-cours); background: var(--en-cours-clair); }
    .conseil { white-space: pre-line; overflow-wrap: anywhere; }
    .conseil a { font-weight: 700; }
  `]
})
export class AttestationAssuranceComponent {
  /** Le type de l'attestation jointe (« application/pdf », « image/jpeg »), null sans attestation. */
  type = input<string | null | undefined>(null);
  port = input.required<PortAttestationAssurance>();
  participantId = input.required<number>();
  titre = input("Attestation d'assurance");
  /**
   * Dans « Mon séjour », sans attestation : le conseil d'assurance écrit
   * par l'organisateur du séjour (demande du club, 2026), adresses web
   * cliquables. Pas dans la fiche vue des organisateurs.
   */
  conseil = input<string | null | undefined>(null);
  readonly morceaux = computed(() => texteAvecLiens(this.conseil() ?? ''));

  readonly formats = 'application/pdf,image/*';
  envoi = signal(false);
  erreur = signal<string | null>(null);

  async choisir(e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    this.erreur.set(null);
    const envoi = envoiCarte(fichier.type, fichier.size);
    if (envoi === 'refus') {
      this.erreur.set(fichier.type === 'application/pdf' ? 'Ce PDF dépasse 5 Mo.' : 'Choisissez un PDF ou une photo.');
      return;
    }
    this.envoi.set(true);
    let aEnvoyer = fichier;
    if (envoi === 'reduire') {
      try {
        aEnvoyer = await reduirePhoto(fichier);
      } catch {
        this.envoi.set(false);
        this.erreur.set("Cette photo n'a pas pu être lue : choisissez un PDF, ou une photo JPEG ou PNG.");
        return;
      }
    }
    try {
      await firstValueFrom(this.port().deposer(this.participantId(), aEnvoyer));
    } catch (err) {
      this.erreur.set((err as HttpErrorResponse).error?.detail
        ?? "L'attestation n'a pas pu être envoyée (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  retirer(): void {
    this.envoi.set(true);
    this.erreur.set(null);
    this.port().retirer(this.participantId()).subscribe({
      next: () => this.envoi.set(false),
      error: (err: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreur.set(err.error?.detail ?? "L'attestation n'a pas pu être retirée (réseau nécessaire).");
      }
    });
  }

  montrer(): void {
    this.erreur.set(null);
    montrerCarte(this.port().lire(this.participantId()), () =>
      this.erreur.set("L'attestation n'a pas pu être ouverte (réseau nécessaire)."));
  }
}
