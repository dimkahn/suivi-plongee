import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';

/** Marge blanche autour du QR code, en carrés : quatre, comme le prévoit la norme, pour qu'il se lise bien. */
const MARGE = 4;

/**
 * Dessine un QR code fabriqué par le serveur (lignes de « 0 » et « 1 »).
 * En SVG : net à l'impression, quelle que soit la taille de l'étiquette.
 */
@Component({
  selector: 'app-qr-code',
  template: `
    <svg [attr.viewBox]="cadre()" shape-rendering="crispEdges" role="img" [attr.aria-label]="libelle()">
      <rect [attr.x]="-marge" [attr.y]="-marge" [attr.width]="cote()" [attr.height]="cote()" fill="#fff" />
      <path [attr.d]="trace()" fill="#000" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; }
  `]
})
export class QrCodeComponent {
  readonly modules = input.required<string[]>();
  readonly libelle = input('QR code');
  readonly marge = MARGE;

  readonly cote = computed(() => this.modules().length + 2 * MARGE);
  readonly cadre = computed(() => `${-MARGE} ${-MARGE} ${this.cote()} ${this.cote()}`);

  /** Un carré par module noir, regroupés par suite horizontale pour alléger le dessin. */
  readonly trace = computed(() => {
    const morceaux: string[] = [];
    this.modules().forEach((ligne, y) => {
      let x = 0;
      while (x < ligne.length) {
        if (ligne[x] !== '1') { x++; continue; }
        const debut = x;
        while (x < ligne.length && ligne[x] === '1') x++;
        morceaux.push(`M${debut} ${y}h${x - debut}v1h${debut - x}z`);
      }
    });
    return morceaux.join('');
  });
}
