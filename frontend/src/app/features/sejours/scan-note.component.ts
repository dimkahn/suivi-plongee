import { Component, ChangeDetectionStrategy, ElementRef, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { OngletsComponent, OptionOnglet } from '../../core/onglets.component';
import { Coins, FiltreNote, Pixels, Point, coinsDeLaPhoto, detecterBords, filtrer, redresser } from './scan-note';

/** La photo travaillée : assez pour lire un ticket, comme `reduirePhoto`. */
const COTE_TRAVAIL = 1600;
/** La photo réduite où l'on cherche les bords : le calcul reste instantané. */
const COTE_DETECTION = 320;
/** Distance (px à l'écran) sous laquelle un toucher attrape un coin : assez pour un doigt mouillé. */
const PRISE_COIN = 44;

type NomCoin = keyof Coins;
const NOMS_COINS: NomCoin[] = ['hautGauche', 'hautDroit', 'basDroit', 'basGauche'];

/**
 * Met au propre la photo d'une note avant de la joindre à une dépense, comme
 * un scanner : les bords de la note sont cherchés (coins déplaçables au
 * doigt), la note est découpée et remise droite, puis un filtre la rend
 * lisible. Tout se fait sur le téléphone (`scan-note.ts`). Le parent reçoit
 * la note en JPEG par {@link valide}, ou la photo telle quelle si la personne
 * le préfère ; il retire le composant pour le fermer.
 */
@Component({
  selector: 'app-scan-note',
  imports: [OngletsComponent],
  template: `
    <div class="voile" role="presentation">
      <div class="dialogue-scan" role="dialog" aria-labelledby="titre-scan">
        <h2 id="titre-scan">{{ etape() === 'bords' ? 'Recadrer la note' : 'Rendre la note lisible' }}</h2>
        @if (photo() === null) {
          <p class="secondaire" role="status">Préparation de la photo…</p>
        } @else if (etape() === 'bords') {
          <p class="secondaire consigne-bords" role="status">
            @if (trouves()) { Bords de la note trouvés : glissez un coin pour l'ajuster. }
            @else { Bords non trouvés : glissez les quatre coins sur ceux de la note. }
          </p>
          <canvas #vue class="vue-bords" aria-label="La photo, les quatre coins de la note à ajuster"
                  (pointerdown)="prendreCoin($event)" (pointermove)="deplacerCoin($event)"
                  (pointerup)="lacherCoin()" (pointercancel)="lacherCoin()"></canvas>
          <div class="actions">
            @if (detectes) {
              <button type="button" class="bouton-discret bords-detectes" (click)="revenirAuxBords()">Bords trouvés</button>
            }
            <button type="button" class="bouton-discret toute-la-photo" (click)="toutePhoto()">Toute la photo</button>
          </div>
          <div class="actions-dialogue">
            <button type="button" class="bouton-principal recadrer-note" (click)="recadrer()">Recadrer</button>
            <button type="button" class="bouton-discret telle-quelle" (click)="valide.emit(fichier())">Garder la photo telle quelle</button>
            <button type="button" class="bouton-discret" (click)="annule.emit()">Annuler</button>
          </div>
        } @else {
          <app-onglets class="filtres-note" libelle="Filtre" [options]="filtres" [choisi]="filtre()"
                       (choisir)="choisirFiltre($event)" />
          <canvas #apercu class="apercu-note" aria-label="La note recadrée, avec le filtre choisi"></canvas>
          <div class="actions-dialogue">
            <button [attr.aria-busy]="preparation() || null" type="button" class="bouton-principal valider-scan"
                    [disabled]="preparation()" (click)="valider()">Joindre cette note</button>
            <button type="button" class="bouton-discret" (click)="etape.set('bords')">← Recadrer</button>
            <button type="button" class="bouton-discret" (click)="annule.emit()">Annuler</button>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .voile { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
             padding: var(--pas); background: rgba(0,0,0,.6); }
    .dialogue-scan { width: 100%; max-width: 640px; max-height: 100%; overflow: auto; padding: var(--pas-2);
                     border-radius: var(--r-s); background: var(--carte); display: flex; flex-direction: column; }
    h2 { margin: 0 0 var(--pas); }
    .secondaire { margin: 0 0 var(--pas); }
    canvas { display: block; align-self: center; max-width: 100%; max-height: 58vh; width: auto; height: auto;
             background: var(--fond); border-radius: var(--r-s); }
    .vue-bords { touch-action: none; cursor: crosshair; }
    .apercu-note { box-shadow: 0 0 0 1px var(--trait); }
    .filtres-note { margin-bottom: var(--pas); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; justify-content: center; margin-top: var(--pas); }
    .actions button, .actions-dialogue button { min-height: 44px; }
  `]
})
export class ScanNoteComponent {
  fichier = input.required<File>();

  valide = output<File>();
  annule = output<void>();
  illisible = output<void>();

  readonly filtres: OptionOnglet<FiltreNote>[] = [
    { valeur: 'document', libelle: 'Document' },
    { valeur: 'nettete', libelle: 'Netteté' },
    { valeur: 'couleur', libelle: 'Couleur d’origine' }
  ];

  etape = signal<'bords' | 'filtre'>('bords');
  photo = signal<Pixels | null>(null);
  coins = signal<Coins>(coinsDeLaPhoto(1, 1));
  /** Vrai tant que les coins sont ceux trouvés sur la photo. */
  trouves = signal(false);
  filtre = signal<FiltreNote>('document');
  preparation = signal(false);
  /** Les coins trouvés sur la photo (null : rien trouvé), pour y revenir. */
  detectes: Coins | null = null;

  private vue = viewChild<ElementRef<HTMLCanvasElement>>('vue');
  private apercu = viewChild<ElementRef<HTMLCanvasElement>>('apercu');
  /** La photo dessinée une fois, à la taille de la vue. */
  private imageVue: HTMLCanvasElement | null = null;
  private redressee = signal<Pixels | null>(null);
  private coinPris: NomCoin | null = null;
  private chargement = 0;

  constructor() {
    effect(() => {
      const fichier = this.fichier();
      untracked(() => this.charger(fichier));
    });
    effect(() => {
      const canvas = this.vue()?.nativeElement;
      const coins = this.coins();
      if (canvas && this.etape() === 'bords') this.dessinerBords(canvas, coins);
    });
    effect(() => {
      const canvas = this.apercu()?.nativeElement;
      const note = this.redressee();
      const filtre = this.filtre();
      if (canvas && note) dessinerPixels(canvas, filtrer(note, filtre));
    });
  }

  private async charger(fichier: File): Promise<void> {
    const numero = ++this.chargement;
    this.photo.set(null);
    this.etape.set('bords');
    this.redressee.set(null);
    try {
      const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
      if (numero !== this.chargement) return;
      const travail = toile(image, COTE_TRAVAIL);
      const petite = toile(image, COTE_DETECTION);
      this.imageVue = toile(image, 900);
      image.close();
      const photo = pixelsDe(travail);
      const trouves = detecterBords(pixelsDe(petite));
      const echelle = photo.largeur / petite.width;
      this.detectes = trouves && {
        hautGauche: agrandir(trouves.hautGauche, echelle), hautDroit: agrandir(trouves.hautDroit, echelle),
        basDroit: agrandir(trouves.basDroit, echelle), basGauche: agrandir(trouves.basGauche, echelle)
      };
      this.coins.set(this.detectes ?? coinsDeLaPhoto(photo.largeur, photo.hauteur));
      this.trouves.set(this.detectes !== null);
      this.photo.set(photo);
    } catch {
      if (numero === this.chargement) this.illisible.emit();
    }
  }

  revenirAuxBords(): void {
    if (!this.detectes) return;
    this.coins.set(this.detectes);
    this.trouves.set(true);
  }

  toutePhoto(): void {
    const p = this.photo();
    if (!p) return;
    this.coins.set(coinsDeLaPhoto(p.largeur, p.hauteur));
    this.trouves.set(false);
  }

  /** Le point touché, en pixels de la photo travaillée. */
  private pointPhoto(evenement: PointerEvent): Point | null {
    const p = this.photo();
    const canvas = this.vue()?.nativeElement;
    if (!p || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.min(p.largeur, Math.max(0, (evenement.clientX - r.left) * p.largeur / r.width)),
      y: Math.min(p.hauteur, Math.max(0, (evenement.clientY - r.top) * p.hauteur / r.height))
    };
  }

  prendreCoin(evenement: PointerEvent): void {
    const point = this.pointPhoto(evenement);
    const canvas = this.vue()?.nativeElement;
    if (!point || !canvas) return;
    const parPixelEcran = this.photo()!.largeur / canvas.getBoundingClientRect().width;
    const coins = this.coins();
    const plusProche = NOMS_COINS
      .map(nom => ({ nom, d: Math.hypot(coins[nom].x - point.x, coins[nom].y - point.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (plusProche.d > PRISE_COIN * parPixelEcran) return;
    this.coinPris = plusProche.nom;
    canvas.setPointerCapture(evenement.pointerId);
  }

  deplacerCoin(evenement: PointerEvent): void {
    const point = this.pointPhoto(evenement);
    if (!this.coinPris || !point) return;
    this.coins.set({ ...this.coins(), [this.coinPris]: point });
    this.trouves.set(false);
  }

  lacherCoin(): void {
    this.coinPris = null;
  }

  recadrer(): void {
    const p = this.photo();
    if (!p) return;
    this.redressee.set(redresser(p, this.coins(), COTE_TRAVAIL));
    this.etape.set('filtre');
  }

  choisirFiltre(filtre: FiltreNote): void {
    this.filtre.set(filtre);
  }

  async valider(): Promise<void> {
    const canvas = this.apercu()?.nativeElement;
    if (!canvas) return;
    this.preparation.set(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Échec de la compression')), 'image/jpeg', 0.85));
      this.valide.emit(new File([blob], 'note.jpg', { type: 'image/jpeg' }));
    } catch {
      this.illisible.emit();
    } finally {
      this.preparation.set(false);
    }
  }

  /** La photo, assombrie hors de la note, le contour et les quatre poignées. */
  private dessinerBords(canvas: HTMLCanvasElement, coins: Coins): void {
    const image = this.imageVue, p = this.photo();
    if (!image || !p) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    const e = image.width / p.largeur;
    const q = NOMS_COINS.map(n => ({ x: coins[n].x * e, y: coins[n].y * e }));
    ctx.drawImage(image, 0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    q.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fill('evenodd');

    const ecran = canvas.getBoundingClientRect().width || canvas.width;
    const trait = canvas.width / ecran;
    ctx.lineWidth = 3 * trait;
    ctx.strokeStyle = '#38BDF8';
    ctx.beginPath();
    q.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.stroke();
    for (const c of q) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 12 * trait, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(56,189,248,.35)';
      ctx.fill();
      ctx.stroke();
    }
  }
}

function agrandir({ x, y }: Point, echelle: number): Point {
  return { x: x * echelle, y: y * echelle };
}

/** L'image dessinée sur une toile, plus grand côté ramené à `coteMax`. */
function toile(image: ImageBitmap, coteMax: number): HTMLCanvasElement {
  const echelle = Math.min(1, coteMax / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * echelle));
  canvas.height = Math.max(1, Math.round(image.height * echelle));
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function pixelsDe(canvas: HTMLCanvasElement): Pixels {
  const d = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  return { largeur: d.width, hauteur: d.height, donnees: d.data };
}

function dessinerPixels(canvas: HTMLCanvasElement, p: Pixels): void {
  canvas.width = p.largeur;
  canvas.height = p.hauteur;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.donnees), p.largeur, p.hauteur), 0, 0);
}
