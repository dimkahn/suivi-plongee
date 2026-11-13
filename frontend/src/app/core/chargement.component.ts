import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Ce qui s'affiche pendant qu'un écran ou une partie d'écran se charge.
 *
 * Par défaut, un squelette : la forme grise d'une carte, traversée d'un
 * reflet lent, avec le libellé au-dessus. Il n'apparaît qu'après 0,3 s, pour
 * ne pas clignoter quand la réponse est immédiate (données sur l'appareil).
 * Avec `enLigne`, pour une partie d'écran (un dialogue, une liste dépliée) :
 * un chargeur tournant devant le libellé, dans le texte.
 *
 * Toujours un mot : sous prefers-reduced-motion, plus rien ne bouge
 * (styles.css) et le libellé suffit. Affichage seul, ne charge rien.
 */
@Component({
  selector: 'app-chargement',
  template: `
    @if (enLigne()) {
      <p class="en-ligne secondaire" role="status">
        <span class="chargeur" aria-hidden="true"></span>{{ libelle() }}
      </p>
    } @else {
      <div class="squelette" role="status">
        <p class="libelle">{{ libelle() }}</p>
        <div class="carte fantome" aria-hidden="true">
          <span class="ligne titre"></span>
          <span class="ligne"></span>
          <span class="ligne courte"></span>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .en-ligne { display: flex; align-items: center; gap: 6px; margin: 0 0 var(--pas-2); }

    .squelette { padding: var(--pas-3) 0; animation: apparaitre .2s ease-out .3s both; }
    .libelle { margin: 0 0 var(--pas); color: var(--craie); text-align: center; }
    .fantome { display: grid; gap: var(--pas); padding: var(--pas-2); max-width: 520px; margin: 0 auto; }
    .ligne {
      display: block; height: 14px; border-radius: var(--r-s);
      background: linear-gradient(90deg, var(--trait) 0%, var(--fond) 50%, var(--trait) 100%);
      background-size: 200% 100%;
      animation: reflet 1.4s ease-in-out infinite;
    }
    .ligne.titre { height: 18px; width: 70%; }
    .ligne.courte { width: 55%; }

    @keyframes apparaitre { from { opacity: 0; } to { opacity: 1; } }
    @keyframes reflet { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  `]
})
export class ChargementComponent {
  /** Ce qui se charge, dit en toutes lettres. */
  readonly libelle = input('Chargement…');
  /** Dans le texte (chargeur tournant) plutôt qu'en squelette de carte. */
  readonly enLigne = input(false, { transform: booleanAttribute });
}
