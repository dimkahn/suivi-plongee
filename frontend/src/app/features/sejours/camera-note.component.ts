import { Component, ChangeDetectionStrategy, DestroyRef, ElementRef, afterNextRender, inject, output, signal, viewChild } from '@angular/core';
import { Coins, Pixels, detecterBords, lisserCoins } from './scan-note';

/** L'image de l'aperçu où l'on cherche la note : assez petite pour le faire plusieurs fois par seconde. */
const COTE_DETECTION = 240;
/** Intervalle entre deux recherches (ms) : environ cinq par seconde, sans vider la batterie. */
const INTERVALLE = 200;

/** Vrai si le navigateur sait ouvrir l'appareil photo dans la page (HTTPS, téléphone ou ordinateur récent). */
export function cameraDisponible(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * L'appareil photo ouvert dans l'appli pour photographier une note : sur
 * l'aperçu en direct, le contour de la note trouvé s'affiche (en bleu) et
 * suit le téléphone. « Déclencher » rend la photo par {@link photo} ; elle
 * passe ensuite au scanner (`ScanNoteComponent`) pour ajuster et filtrer.
 * Rien n'est enregistré ni envoyé ici. Si l'appareil photo ne s'ouvre pas
 * (refus, pas de caméra), {@link indisponible} : le parent propose celui du
 * téléphone.
 */
@Component({
  selector: 'app-camera-note',
  template: `
    <div class="voile" role="presentation">
      <div class="dialogue-camera" role="dialog" aria-labelledby="titre-camera">
        <h2 id="titre-camera">Photographier la note</h2>
        <p class="secondaire consigne-camera" role="status">
          @if (!pret()) { Ouverture de l'appareil photo… }
          @else if (trouvee()) { Note trouvée : déclenchez quand le cadre bleu suit ses bords. }
          @else { Cadrez toute la note, posée sur un fond plus sombre qu'elle. }
        </p>
        <div class="cadre-video">
          <video #video playsinline muted autoplay aria-label="Aperçu de l'appareil photo"></video>
          <canvas #contour aria-hidden="true"></canvas>
        </div>
        <div class="actions-dialogue">
          <button [attr.aria-busy]="prise() || null" type="button" class="bouton-principal declencher"
                  [disabled]="!pret() || prise()" (click)="declencher()">📷 Déclencher</button>
          <button type="button" class="bouton-discret" (click)="annule.emit()">Annuler</button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .voile { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
             padding: var(--pas); background: rgba(0,0,0,.75); }
    .dialogue-camera { width: 100%; max-width: 640px; max-height: 100%; overflow: auto; padding: var(--pas-2);
                       border-radius: var(--r-s); background: var(--carte); display: flex; flex-direction: column; }
    h2 { margin: 0 0 var(--pas); }
    .secondaire { margin: 0 0 var(--pas); }
    .cadre-video { position: relative; align-self: center; display: inline-block; line-height: 0;
                   background: #000; border-radius: var(--r-s); overflow: hidden; }
    video { display: block; max-width: 100%; max-height: 62vh; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .declencher { min-height: 56px; font-size: 1.125rem; }
    .actions-dialogue button { min-height: 44px; }
  `]
})
export class CameraNoteComponent {
  photo = output<File>();
  annule = output<void>();
  indisponible = output<void>();

  pret = signal(false);
  trouvee = signal(false);
  prise = signal(false);

  private video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private contour = viewChild.required<ElementRef<HTMLCanvasElement>>('contour');
  private flux: MediaStream | null = null;
  private minuterie: ReturnType<typeof setTimeout> | undefined;
  private coins: Coins | null = null;
  private fini = false;
  private readonly petite = document.createElement('canvas');

  constructor() {
    afterNextRender(() => this.ouvrir());
    inject(DestroyRef).onDestroy(() => {
      this.fini = true;
      clearTimeout(this.minuterie);
      this.flux?.getTracks().forEach(t => t.stop());
    });
  }

  private async ouvrir(): Promise<void> {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (this.fini) {
        flux.getTracks().forEach(t => t.stop());
        return;
      }
      this.flux = flux;
      const video = this.video().nativeElement;
      video.srcObject = flux;
      await video.play();
      this.pret.set(true);
      this.chercher();
    } catch {
      if (!this.fini) this.indisponible.emit();
    }
  }

  /** Cherche la note sur l'image en cours de l'aperçu et dessine son contour, puis recommence. */
  private chercher(): void {
    if (this.fini) return;
    const video = this.video().nativeElement;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const echelle = Math.min(1, COTE_DETECTION / Math.max(video.videoWidth, video.videoHeight));
      this.petite.width = Math.round(video.videoWidth * echelle);
      this.petite.height = Math.round(video.videoHeight * echelle);
      const ctx = this.petite.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, this.petite.width, this.petite.height);
      const d = ctx.getImageData(0, 0, this.petite.width, this.petite.height);
      const pixels: Pixels = { largeur: d.width, hauteur: d.height, donnees: d.data };
      this.coins = lisserCoins(this.coins, detecterBords(pixels), 0.5);
      this.trouvee.set(this.coins !== null);
      this.dessiner();
    }
    this.minuterie = setTimeout(() => this.chercher(), INTERVALLE);
  }

  /** Le contour, sur une toile aux proportions de l'aperçu (celles de l'image réduite). */
  private dessiner(): void {
    const canvas = this.contour().nativeElement;
    canvas.width = this.petite.width * 2;
    canvas.height = this.petite.height * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const c = this.coins;
    if (!c) return;
    const q = [c.hautGauche, c.hautDroit, c.basDroit, c.basGauche].map(p => ({ x: p.x * 2, y: p.y * 2 }));
    ctx.beginPath();
    q.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(56,189,248,.18)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38BDF8';
    ctx.stroke();
  }

  /** L'image de l'aperçu à pleine définition, en JPEG. */
  async declencher(): Promise<void> {
    const video = this.video().nativeElement;
    if (!video.videoWidth) return;
    this.prise.set(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Échec de la photo')), 'image/jpeg', 0.92));
      this.photo.emit(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    } catch {
      this.indisponible.emit();
    } finally {
      this.prise.set(false);
    }
  }
}
