import { Component, DestroyRef, ElementRef, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { reduirePhoto } from '../../core/reduire-photo';

/** Lecteur de codes intégré à Chrome sur Android ; absent de Safari (iPhone) et de Firefox. */
interface LecteurCodes {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (options: { formats: string[] }): LecteurCodes } | undefined;

/** Une image analysée tous les tant de millisecondes : assez réactif, sans chauffer le téléphone. */
const INTERVALLE_ANALYSE_MS = 250;

/**
 * Retrouve la fiche d'un équipement à partir du QR code de son étiquette.
 * Caméra en direct quand le navigateur sait lire un QR code (Android) ;
 * sinon une photo de l'étiquette, lue par le serveur ; en dernier recours,
 * la référence tapée à la main.
 */
@Component({
  selector: 'app-scanner-materiel',
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/materiel" class="retour">← Matériel</a>
    <h1>Scanner une étiquette</h1>

    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    @if (lectureDirecte) {
      <section class="carte bloc">
        @if (cameraActive()) {
          <div class="viseur">
            <video #video playsinline muted></video>
            <div class="cadre" aria-hidden="true"></div>
          </div>
          <p class="secondaire">Visez le QR code de l'étiquette : la fiche s'ouvre toute seule.</p>
          <button type="button" class="bouton-discret" (click)="arreterCamera()">Arrêter la caméra</button>
        } @else {
          <button type="button" class="bouton-principal" (click)="demarrerCamera()" [disabled]="recherche()">
            Ouvrir la caméra
          </button>
        }
      </section>
    }

    <section class="carte bloc">
      @if (!lectureDirecte) {
        <p class="secondaire">
          Prenez l'étiquette en photo, bien à plat et nette. Vous pouvez aussi viser le QR code avec l'appareil
          photo du téléphone : il propose d'ouvrir la fiche.
        </p>
      }
      <label class="photo" [class.occupe]="recherche()" [class.bouton-discret]="lectureDirecte"
             [class.bouton-principal]="!lectureDirecte">
        {{ recherche() ? 'Lecture…' : "Prendre l'étiquette en photo" }}
        <input type="file" accept="image/*" capture="environment" [disabled]="recherche()" (change)="photo($event)">
      </label>
    </section>

    <section class="carte bloc">
      <form class="reference" (ngSubmit)="chercherReference()">
        <label for="reference">Étiquette illisible ? Référence du club</label>
        <div class="ligne">
          <input id="reference" name="reference" [(ngModel)]="reference" placeholder="B-12, G-07…" maxlength="30"
                 autocapitalize="characters">
          <button type="submit" class="bouton-discret" [disabled]="recherche() || !reference.trim()">Ouvrir</button>
        </div>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: var(--pas); }
    h1 { margin-bottom: var(--pas-2); }
    .bloc { padding: var(--pas-2); margin-bottom: var(--pas-2); max-width: 520px; }
    .viseur { position: relative; border-radius: var(--r-s); overflow: hidden; background: #000; margin-bottom: var(--pas); }
    video { display: block; width: 100%; max-height: 60vh; object-fit: cover; }
    .cadre {
      position: absolute; inset: 15%; border: 3px solid rgba(255,255,255,.85); border-radius: var(--r-s);
      box-shadow: 0 0 0 100vmax rgba(0,0,0,.25);
    }
    .photo { display: inline-flex; align-items: center; min-height: 44px; cursor: pointer; position: relative; }
    .photo input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .photo:focus-within { outline: 3px solid var(--profond); outline-offset: 1px; }
    .photo.occupe { opacity: .6; cursor: progress; }
    .reference label { display: block; font-weight: 700; margin-bottom: var(--pas); }
    .ligne { display: flex; gap: var(--pas); }
    .ligne input { flex: 1; min-width: 0; }
  `]
})
export class ScannerMaterielComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly lectureDirecte = typeof BarcodeDetector !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  message = signal<string | null>(null);
  cameraActive = signal(false);
  recherche = signal(false);
  reference = '';

  private flux: MediaStream | null = null;
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.arreterCamera());
    if (this.lectureDirecte) void this.demarrerCamera();
  }

  async demarrerCamera(): Promise<void> {
    this.message.set(null);
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      this.message.set("La caméra n'est pas accessible (autorisation refusée ?). Prenez l'étiquette en photo.");
      return;
    }
    this.cameraActive.set(true);
    // La vidéo n'existe qu'une fois l'affichage mis à jour.
    setTimeout(() => void this.brancherVideo());
  }

  arreterCamera(): void {
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = null;
    this.flux?.getTracks().forEach(piste => piste.stop());
    this.flux = null;
    this.cameraActive.set(false);
  }

  async photo(evenement: Event): Promise<void> {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    this.arreterCamera();
    await this.ouvrir(async () => this.api.retrouverEquipementSurPhoto(await reduirePhoto(fichier)));
  }

  async chercherReference(): Promise<void> {
    const r = this.reference.trim();
    if (r) await this.ouvrir(async () => this.api.retrouverEquipementParQrCode(r));
  }

  private async brancherVideo(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || !this.flux) return;
    video.srcObject = this.flux;
    await video.play().catch(() => undefined);
    const lecteur = new BarcodeDetector!({ formats: ['qr_code'] });
    const analyser = async () => {
      if (!this.flux) return;
      try {
        const codes = video.readyState >= 2 ? await lecteur.detect(video) : [];
        if (codes.length > 0) {
          this.arreterCamera();
          await this.ouvrir(async () => this.api.retrouverEquipementParQrCode(codes[0].rawValue));
          return;
        }
      } catch {
        // image pas encore prête : on réessaie
      }
      this.minuterie = setTimeout(() => void analyser(), INTERVALLE_ANALYSE_MS);
    };
    void analyser();
  }

  private async ouvrir(appel: () => Promise<Observable<{ equipementId: number }>>): Promise<void> {
    this.recherche.set(true);
    this.message.set(null);
    try {
      const { equipementId } = await firstValueFrom(await appel());
      await this.router.navigate(['/materiel', equipementId]);
    } catch (err) {
      this.message.set((err as HttpErrorResponse).error?.detail ?? "L'équipement n'a pas pu être retrouvé.");
    } finally {
      this.recherche.set(false);
    }
  }
}
