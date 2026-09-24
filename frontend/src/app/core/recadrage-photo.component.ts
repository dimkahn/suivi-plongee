import { Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Cadre carré présenté à l'écran pendant le recadrage (px). */
const TAILLE_APERCU = 280;
/** Résolution de la photo enregistrée (px, carré) : cohérent avec l'affichage en 120x120 ailleurs. */
const TAILLE_SORTIE = 480;
/** Une photo de trombinoscope ne doit jamais dépasser ce poids une fois compressée. */
const POIDS_MAX_OCTETS = 300 * 1024;

interface EtatRecadrage {
  image: HTMLImageElement;
  url: string;
  /** Échelle qui fait tenir le plus petit côté de l'image dans le cadre, à zoom 1. */
  echelleBase: number;
  zoom: number;
  decalageX: number;
  decalageY: number;
}

/**
 * Dialogue de recadrage carré d'une photo de trombinoscope (élève ou
 * moniteur). Le parent reçoit le fichier JPEG compressé via {@link valide}
 * et se charge lui-même de l'envoi ; il ferme le dialogue en retirant le
 * composant.
 */
@Component({
  selector: 'app-recadrage-photo',
  imports: [FormsModule],
  template: `
    @if (recadrage(); as r) {
      <div class="voile" role="presentation">
        <div class="dialogue-recadrage" role="dialog" aria-label="Recadrer la photo">
          <h2>{{ titre() }}</h2>
          <p class="secondaire">Glissez l'image pour la repositionner, ajustez le zoom si besoin.</p>
          <canvas #canvasRecadrage [width]="tailleApercu" [height]="tailleApercu" class="cadre-recadrage"
                  (pointerdown)="commencerGlissement($event)" (pointermove)="glisser($event)"
                  (pointerup)="finGlissement()" (pointerleave)="finGlissement()"></canvas>
          <label for="zoomRecadrage">Zoom</label>
          <input id="zoomRecadrage" type="range" min="1" max="3" step="0.02" [ngModel]="r.zoom"
                 name="zoomRecadrage" (ngModelChange)="changerZoom($event)">
          <div class="actions">
            <button type="button" class="bouton-principal" [disabled]="enCours() || preparation()"
                    (click)="valider()">
              {{ enCours() || preparation() ? 'Enregistrement…' : 'Valider' }}
            </button>
            <button type="button" class="bouton-discret" [disabled]="enCours()" (click)="annule.emit()">
              Annuler
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; margin-top: var(--pas-2); }
    .actions .bouton-principal { width: auto; margin-top: 0; }
    .voile {
      position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
      padding: var(--pas-2); background: rgba(0,0,0,.55);
    }
    .dialogue-recadrage {
      width: 100%; max-width: 340px; padding: var(--pas-3); border-radius: var(--r-s);
      background: var(--carte); display: flex; flex-direction: column; align-items: center;
    }
    .dialogue-recadrage h2 { align-self: flex-start; }
    .dialogue-recadrage label { align-self: flex-start; }
    .dialogue-recadrage input[type="range"] { width: 100%; margin: 0 0 var(--pas); }
    .cadre-recadrage {
      touch-action: none; cursor: grab; border-radius: 50%; background: var(--fond);
      box-shadow: 0 0 0 1px var(--trait);
    }
    .dialogue-recadrage .actions { width: 100%; justify-content: flex-end; }
  `]
})
export class RecadragePhotoComponent implements OnDestroy {
  fichier = input.required<File>();
  titre = input('Recadrer la photo');
  /** Envoi en cours côté parent : fige les boutons. */
  enCours = input(false);

  valide = output<File>();
  annule = output<void>();
  illisible = output<void>();

  readonly tailleApercu = TAILLE_APERCU;
  recadrage = signal<EtatRecadrage | null>(null);
  preparation = signal(false);
  private canvasRecadrage = viewChild<ElementRef<HTMLCanvasElement>>('canvasRecadrage');
  private origineGlissement: { x: number; y: number; decalageX: number; decalageY: number } | null = null;

  constructor() {
    effect(() => this.charger(this.fichier()));

    // Redessine l'aperçu à chaque déplacement/zoom, et dès que le canvas apparaît dans le DOM.
    effect(() => {
      const r = this.recadrage();
      const canvas = this.canvasRecadrage()?.nativeElement;
      if (!r || !canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, TAILLE_APERCU, TAILLE_APERCU);
      const echelle = r.echelleBase * r.zoom;
      ctx.drawImage(r.image, r.decalageX, r.decalageY, r.image.width * echelle, r.image.height * echelle);
    });
  }

  private charger(fichier: File): void {
    const precedent = this.recadrage();
    if (precedent) URL.revokeObjectURL(precedent.url);
    this.recadrage.set(null);

    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      const echelleBase = TAILLE_APERCU / Math.min(image.width, image.height);
      this.recadrage.set({
        image, url, echelleBase, zoom: 1,
        decalageX: (TAILLE_APERCU - image.width * echelleBase) / 2,
        decalageY: (TAILLE_APERCU - image.height * echelleBase) / 2
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      this.illisible.emit();
    };
    image.src = url;
  }

  commencerGlissement(evenement: PointerEvent): void {
    const r = this.recadrage();
    if (!r) return;
    (evenement.target as HTMLElement).setPointerCapture(evenement.pointerId);
    this.origineGlissement = { x: evenement.clientX, y: evenement.clientY,
                               decalageX: r.decalageX, decalageY: r.decalageY };
  }

  glisser(evenement: PointerEvent): void {
    const r = this.recadrage();
    if (!r || !this.origineGlissement) return;
    const o = this.origineGlissement;
    const suivant = { ...r, decalageX: o.decalageX + (evenement.clientX - o.x),
                      decalageY: o.decalageY + (evenement.clientY - o.y) };
    this.clamperDecalage(suivant);
    this.recadrage.set(suivant);
  }

  finGlissement(): void {
    this.origineGlissement = null;
  }

  /** Le point regardé au centre du cadre reste stable pendant le zoom. */
  changerZoom(zoom: number): void {
    const r = this.recadrage();
    if (!r) return;
    const centre = TAILLE_APERCU / 2;
    const rapport = (r.echelleBase * zoom) / (r.echelleBase * r.zoom);
    const suivant = {
      ...r, zoom,
      decalageX: centre - (centre - r.decalageX) * rapport,
      decalageY: centre - (centre - r.decalageY) * rapport
    };
    this.clamperDecalage(suivant);
    this.recadrage.set(suivant);
  }

  /** L'image doit toujours couvrir tout le cadre : jamais de bord vide. */
  private clamperDecalage(r: EtatRecadrage): void {
    const echelle = r.echelleBase * r.zoom;
    r.decalageX = Math.min(0, Math.max(TAILLE_APERCU - r.image.width * echelle, r.decalageX));
    r.decalageY = Math.min(0, Math.max(TAILLE_APERCU - r.image.height * echelle, r.decalageY));
  }

  async valider(): Promise<void> {
    const r = this.recadrage();
    if (!r) return;
    this.preparation.set(true);
    try {
      this.valide.emit(await this.produireFichier(r));
    } finally {
      this.preparation.set(false);
    }
  }

  /** Découpe le cadre choisi en une image carrée, puis la compresse sous {@link POIDS_MAX_OCTETS}. */
  private async produireFichier(r: EtatRecadrage): Promise<File> {
    const rapport = TAILLE_SORTIE / TAILLE_APERCU;
    const echelle = r.echelleBase * r.zoom * rapport;
    let sortie = document.createElement('canvas');
    sortie.width = TAILLE_SORTIE;
    sortie.height = TAILLE_SORTIE;
    sortie.getContext('2d')!.drawImage(r.image, r.decalageX * rapport, r.decalageY * rapport,
        r.image.width * echelle, r.image.height * echelle);

    let qualite = 0.9;
    let blob = await this.versBlob(sortie, qualite);
    while (blob.size > POIDS_MAX_OCTETS && qualite > 0.4) {
      qualite -= 0.1;
      blob = await this.versBlob(sortie, qualite);
    }
    // La qualité seule ne suffit pas toujours : on réduit alors la résolution.
    let taille = TAILLE_SORTIE;
    while (blob.size > POIDS_MAX_OCTETS && taille > 160) {
      taille = Math.round(taille * 0.85);
      const reduit = document.createElement('canvas');
      reduit.width = taille;
      reduit.height = taille;
      reduit.getContext('2d')!.drawImage(sortie, 0, 0, taille, taille);
      sortie = reduit;
      blob = await this.versBlob(sortie, 0.8);
    }
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  }

  private versBlob(canvas: HTMLCanvasElement, qualite: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Échec de la compression')), 'image/jpeg', qualite);
    });
  }

  ngOnDestroy(): void {
    const r = this.recadrage();
    if (r) URL.revokeObjectURL(r.url);
  }
}
