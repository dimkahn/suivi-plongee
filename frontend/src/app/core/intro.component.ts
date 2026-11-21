import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';

/**
 * L'introduction d'un écran (à quoi il sert, les règles), repliée sur ses
 * deux premières lignes, avec « En savoir plus » : au téléphone, quinze
 * lignes d'explication passaient avant le contenu. Le texte reste entier
 * dans la page (un lecteur d'écran le lit tout) ; le bouton n'apparaît que
 * s'il dépasse vraiment deux lignes à cette largeur.
 */
@Component({
  selector: 'app-intro',
  template: `
    <div #texte class="texte-intro" [class.repliee]="!ouvert()" [class.deborde]="deborde() && !ouvert()">
      <ng-content />
    </div>
    @if (deborde()) {
      <button type="button" class="lien-intro" [attr.aria-expanded]="ouvert()" (click)="ouvert.set(!ouvert())">
        {{ ouvert() ? 'Moins' : 'En savoir plus' }}
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; margin-bottom: var(--pas-2); }
    .texte-intro ::ng-deep p { margin-bottom: var(--pas); }
    .texte-intro ::ng-deep p:last-child { margin-bottom: 0; }
    /* Deux lignes (texte secondaire, 1,5 d'interligne) ; le bas s'estompe s'il y a une suite. */
    .repliee { max-height: 2.9em; overflow: hidden; }
    .deborde { -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }
    .lien-intro {
      min-height: 44px; padding: 0; border: 0; background: none; color: var(--profond);
      font-weight: 700; text-decoration: underline; text-underline-offset: 3px;
    }
  `]
})
export class IntroComponent implements AfterViewInit {
  ouvert = signal(false);
  deborde = signal(false);
  private texte = viewChild.required<ElementRef<HTMLElement>>('texte');
  private destroy = inject(DestroyRef);

  ngAfterViewInit(): void {
    const el = this.texte().nativeElement;
    const mesurer = () => { if (!this.ouvert()) this.deborde.set(el.scrollHeight > el.clientHeight + 2); };
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    this.destroy.onDestroy(() => observateur.disconnect());
    mesurer();
  }
}
