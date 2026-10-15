import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';

/**
 * Le mail de réservation d'une voiture de location (instructions du
 * loueur), dans un volet à déplier sous la voiture. Le HTML vient déjà
 * nettoyé par le serveur (texte, tableaux, liens ; ni script, ni image, ni
 * style) ; Angular le nettoie encore à l'affichage. Styles non encapsulés,
 * préfixés par .mail-loueur : ils s'appliquent au HTML inséré.
 */
@Component({
  selector: 'app-mail-loueur',
  template: `
    <details class="mail-loueur" [open]="ouvert()">
      <summary>Réservation du loueur</summary>
      <div class="mail-loueur-contenu" [innerHTML]="html()"></div>
    </details>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None,
  styles: [`
    app-mail-loueur { display: block; margin-top: var(--pas); }
    .mail-loueur summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 700; color: var(--profond-fonce); }
    .mail-loueur-contenu { max-height: 60vh; overflow: auto; padding: var(--pas) var(--pas-2); border: 1px solid var(--trait);
      border-radius: var(--r-s); background: var(--fond); overflow-wrap: anywhere; }
    .mail-loueur-contenu h1, .mail-loueur-contenu h2, .mail-loueur-contenu h3 { font-size: 1.05rem; margin: var(--pas) 0 4px; }
    .mail-loueur-contenu p { margin: 0 0 var(--pas); }
    .mail-loueur-contenu table { border-collapse: collapse; max-width: 100%; }
    .mail-loueur-contenu td, .mail-loueur-contenu th { padding: 2px 6px; vertical-align: top; text-align: left; }
    .mail-loueur-contenu a { color: var(--profond); text-decoration: underline; }
    @media print { .mail-loueur-contenu { max-height: none; overflow: visible; } }
  `]
})
export class MailLoueurComponent {
  readonly html = input.required<string>();
  /** Déplié d'office (aperçu dans la fenêtre de saisie, version imprimable). */
  readonly ouvert = input(false);
}
