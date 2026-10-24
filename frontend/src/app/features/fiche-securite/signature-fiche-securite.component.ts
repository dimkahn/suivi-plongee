import { Component, DestroyRef, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FicheSecuriteVue, SeanceVue } from '../../core/modeles';
import { DateFrPipe, dateDuJour } from '../../core/date-fr';
import { DialogueComponent } from '../../core/dialogue.component';
import { lieuEtSite } from '../../core/seance-lieu';
import { alerteIntegrite, libelleSignature, peutSignerFiche } from '../../core/fiche-securite';
import { detailErreurFichier, telechargerFichier } from '../../core/telecharger';

/**
 * La page de signature d'une fiche de sécurité, ouverte depuis la liste :
 * la feuille telle qu'elle s'imprime (image rendue par le serveur depuis le
 * PDF), puis la signature du DP en dessous. Signée, la page ne sert plus
 * qu'à la relire et l'imprimer. Réseau nécessaire.
 */
@Component({
  selector: 'app-signature-fiche-securite',
  imports: [RouterLink, DateFrPipe, DialogueComponent],
  template: `
    @if (seance(); as s) {
      <h1>Signer la fiche de sécurité — {{ s.date | dateFr }}{{ lieuEtSite(s) ? ' — ' + lieuEtSite(s) : '' }}</h1>
    } @else {
      <h1>Signer la fiche de sécurité</h1>
    }

    @if (chargement()) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <div class="carte vide"><p>{{ erreur() }}</p></div>
    } @else if (fiche(); as f) {
      @if (f.signature; as sig) {
        <div class="signature carte" [class.alteree]="!sig.integre" role="status">
          <strong>✍ {{ libelleSignature(sig) }}</strong>
          <span>{{ alerteIntegrite(sig) ?? 'La fiche signée ne se modifie plus : elle s\\'imprime.' }}</span>
        </div>
      } @else {
        <p class="secondaire">
          La fiche telle qu'elle s'imprime. Relisez-la : en rouge, une profondeur ou une durée
          réalisée au-delà du prévu. Signée, elle ne pourra plus être modifiée ni complétée.
        </p>
      }

      <figure class="feuille carte">
        @if (image(); as url) {
          <img [src]="url" alt="Fiche de sécurité telle qu'elle s'imprime">
        } @else {
          <p class="vide">Préparation de la fiche…</p>
        }
      </figure>

      <div class="actions-bas">
        @if (message(); as m) {
          <div class="alerte message-bas" role="alert">{{ m }}</div>
        }
        @if (peutSigner()) {
          <button type="button" class="bouton-principal bouton-signer" (click)="dialogueOuvert.set(true)">
            ✍ Signer la fiche
          </button>
        } @else if (!f.signature) {
          <span class="secondaire raison">{{ raisonSansSignature() }}</span>
        }
        <button type="button" class="bouton-discret" (click)="imprimer()" [disabled]="impression()">
          {{ impression() ? 'Génération…' : 'Imprimer (PDF)' }}
        </button>
        <a class="bouton-discret" [routerLink]="['/fiches-securite', seanceId]">Voir la fiche</a>
      </div>

      <app-dialogue [ouvert]="dialogueOuvert()" titre="Signer la fiche de sécurité" [erreur]="erreurSignature()"
                    (fermer)="dialogueOuvert.set(false)">
        <p>
          Vous signez, en tant que directeur de plongée, la fiche affichée :
          conditions, palanquées, plongeurs et profils réalisés.
        </p>
        <p class="secondaire">
          Une fois signée, <strong>elle ne pourra plus être modifiée ni complétée</strong>, par personne.
        </p>
        <div class="actions-dialogue">
          <button type="button" class="bouton-principal" [disabled]="envoi()" (click)="signer()">
            {{ envoi() ? 'Signature…' : 'Je signe la fiche' }}
          </button>
          <button type="button" class="bouton-discret" (click)="dialogueOuvert.set(false)">Annuler</button>
        </div>
      </app-dialogue>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin: var(--pas-3) 0 var(--pas); }
    .signature {
      display: flex; flex-direction: column; gap: var(--pas);
      padding: var(--pas-2) var(--pas-3); margin: var(--pas-2) 0;
      border-left: 4px solid var(--acquis); background: var(--acquis-clair);
    }
    .signature.alteree { border-left-color: #B3261E; background: #FDECEA; }
    .signature.alteree span { color: #B3261E; font-weight: 600; }
    /* La feuille A4 paysage garde sa largeur : au téléphone, on la fait défiler ou on zoome. */
    .feuille { margin: var(--pas-2) 0; padding: var(--pas); overflow-x: auto; background: #fff; }
    .feuille img { display: block; width: 100%; min-width: 720px; height: auto; }
    .actions-bas {
      position: sticky; bottom: var(--hauteur-onglets); z-index: 6;
      display: flex; gap: var(--pas-2); flex-wrap: wrap; align-items: center;
      margin: var(--pas-3) 0; padding: var(--pas-2) 0; background: var(--fond); border-top: 1px solid var(--trait);
    }
    .actions-bas .bouton-principal { width: auto; margin: 0; }
    .actions-bas a, .actions-bas button { min-height: 44px; }
    .message-bas { flex: 1 1 100%; margin: 0; }
    .raison { margin: 0; }
  `]
})
export class SignatureFicheSecuriteComponent {
  readonly lieuEtSite = lieuEtSite;
  readonly libelleSignature = libelleSignature;
  readonly alerteIntegrite = alerteIntegrite;
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  seanceId = Number(this.route.snapshot.paramMap.get('id'));
  seance = signal<SeanceVue | null>(null);
  fiche = signal<FicheSecuriteVue | null>(null);
  /** Adresse locale (blob:) de l'image de la feuille. */
  image = signal<string | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  message = signal<string | null>(null);

  peutSigner = computed(() => {
    const f = this.fiche();
    return !!f && peutSignerFiche(f, this.auth.session()?.id, this.seance()?.date, dateDuJour());
  });

  /** Pourquoi le bouton manque, sur une fiche pas encore signée. */
  raisonSansSignature = computed(() => {
    const f = this.fiche();
    if (!f) return '';
    if (f.dpId !== this.auth.session()?.id) return `Seul le directeur de plongée de la fiche, ${f.dp}, peut la signer.`;
    return 'La fiche se signe le jour de la plongée ou après.';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberer());
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const [seances, fiche] = await Promise.all([this.api.seances(), this.api.ficheSecurite(this.seanceId)]);
      this.seance.set(seances.find(s => s.id === this.seanceId) ?? null);
      this.fiche.set(fiche);
      this.chargerImage();
    } catch {
      this.erreur.set(navigator.onLine
        ? "Cette séance n'a pas encore de fiche de sécurité enregistrée."
        : 'Page impossible hors ligne : reconnectez-vous pour relire et signer la fiche.');
    } finally {
      this.chargement.set(false);
    }
  }

  private chargerImage(): void {
    this.api.ficheSecuriteApercu(this.seanceId).subscribe({
      next: blob => {
        this.liberer();
        this.image.set(URL.createObjectURL(blob));
      },
      error: async (e: HttpErrorResponse) => this.message.set(await detailErreurFichier(e) ?? (navigator.onLine
        ? "L'image de la fiche n'a pas pu être préparée."
        : 'Affichage impossible hors ligne : reconnectez-vous.'))
    });
  }

  private liberer(): void {
    const url = this.image();
    if (url) URL.revokeObjectURL(url);
  }

  dialogueOuvert = signal(false);
  envoi = signal(false);
  erreurSignature = signal<string | null>(null);

  /** Réseau nécessaire : la signature n'entre pas dans la file hors ligne. */
  signer(): void {
    this.envoi.set(true);
    this.erreurSignature.set(null);
    this.api.signerFicheSecurite(this.seanceId).subscribe({
      next: fiche => {
        this.fiche.set(fiche);
        this.envoi.set(false);
        this.dialogueOuvert.set(false);
        // La case signature de la feuille dit maintenant « signée électroniquement ».
        this.chargerImage();
      },
      error: (e: HttpErrorResponse) => {
        this.envoi.set(false);
        this.erreurSignature.set(e.error?.detail ?? (navigator.onLine
          ? 'La signature de la fiche a échoué.'
          : 'Signature impossible hors ligne : reconnectez-vous pour signer.'));
      }
    });
  }

  impression = signal(false);

  /** Avec l'autre plongée du jour sur la feuille, comme l'impression de la liste. */
  imprimer(): void {
    this.impression.set(true);
    this.message.set(null);
    this.api.ficheSecuritePdf(this.seanceId).subscribe({
      next: blob => {
        telechargerFichier(blob, `fiche-securite-${this.seance()?.date ?? this.seanceId}.pdf`);
        this.impression.set(false);
      },
      error: async (e: HttpErrorResponse) => {
        this.impression.set(false);
        this.message.set(await detailErreurFichier(e) ?? (navigator.onLine
          ? "Le PDF de la fiche n'a pas pu être généré."
          : 'Impression impossible hors ligne : reconnectez-vous pour générer le PDF.'));
      }
    });
  }
}
