import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NomPersonne, initiales } from './initiales';

/**
 * Vignette ronde d'une personne : sa photo si l'écran en a une (`url`, déjà
 * chargée par lui, droit à l'image vérifié par le serveur), sinon ses
 * initiales. Affichage seul : l'écran charge et libère la photo
 * (`app-photo-eleve` le fait pour un élève).
 *
 * Taille : `--taille-avatar` dans les styles de l'écran (40 px par défaut),
 * pour pouvoir la changer sur téléphone.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (url(); as u) {
      <img [src]="u" [alt]="alt()">
    } @else {
      <span class="silhouette" [attr.role]="libelleInitiales() ? 'img' : null"
            [attr.aria-label]="libelleInitiales() ?? null"
            [attr.aria-hidden]="libelleInitiales() ? null : 'true'">{{ lettres() }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; flex: none; width: var(--taille-avatar, 40px); height: var(--taille-avatar, 40px); }
    img, .silhouette { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: var(--fond); }
    .silhouette { display: flex; align-items: center; justify-content: center;
                  font-family: var(--font-titres), sans-serif; font-weight: 700; color: var(--craie);
                  font-size: calc(var(--taille-avatar, 40px) * .3); }
  `]
})
export class AvatarComponent {
  readonly url = input<string | null>(null);
  /** Le nom tel qu'affiché, ou prénom et nom séparés : d'où viennent les initiales. */
  readonly nom = input.required<NomPersonne>();
  /** Texte de la photo ; vide quand le nom suit la vignette. */
  readonly alt = input('');
  /** Ce que lit un lecteur d'écran sur les initiales ; sans lui, elles sont ignorées. */
  readonly libelleInitiales = input<string>();

  lettres = computed(() => initiales(this.nom()));
}
