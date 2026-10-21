import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { DialogueComponent } from './dialogue.component';
import { NavigationService } from './navigation';
import { Manuel } from '../features/aide/manuel';
import { ManuelComponent } from '../features/aide/manuel.component';

/**
 * La barre en tête de chaque page : à gauche le retour vers l'écran
 * parent (« ← Matériel », même règle partout, voir core/navigation.ts),
 * à droite « Comment faire ? », qui ouvre sans quitter la page les manuels
 * de l'écran (features/aide/comment-faire.ts) : une saisie en cours n'est
 * pas perdue. Rien sur la page Aide elle-même, hormis son retour.
 */
@Component({
  selector: 'app-barre-page',
  imports: [RouterLink, DialogueComponent, ManuelComponent],
  template: `
    @if (retour() || avecAide()) {
      <nav class="barre-page" aria-label="Navigation de la page">
        @if (retour(); as r) {
          <a class="retour-page" [routerLink]="r.lien" [queryParams]="r.parametres ?? {}">← {{ r.libelle }}</a>
        }
        @if (avecAide()) {
          <button type="button" class="bouton-discret comment-faire" (click)="ouvrir()"
                  aria-haspopup="dialog" title="Les manuels et vidéos d'aide de cet écran">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
            Comment faire ?
          </button>
        }
      </nav>
    }

    <app-dialogue [ouvert]="ouvert()" [titre]="choisi()?.titre ?? 'Comment faire ?'" [large]="true"
                  (fermer)="fermer()">
      @if (choisi(); as m) {
        @if (manuels().length > 1) {
          <button type="button" class="bouton-discret autres" (click)="choisi.set(null)">
            ‹ Les autres questions de cet écran
          </button>
        }
        <app-manuel [manuel]="m" [avecTitre]="false" [avecEcran]="auth.connecte() && m.ecran !== navigation.chemin()"
                    (lienSuivi)="fermer()" />
      } @else {
        <p class="secondaire">Les manuels de cet écran, avec leur vidéo d'aide quand il y en a une.</p>
        <ul class="manuels">
          @for (m of manuels(); track m.id) {
            <li>
              <button type="button" class="manuel" (click)="choisi.set(m)">
                <span class="titre">
                  {{ m.titre }}
                  @if (m.videos.length) { <span class="pastille" title="Avec vidéo d'aide">▶ vidéo</span> }
                </span>
                @if (m.questions.length) { <span class="exemples">{{ m.questions.slice(0, 2).join(' · ') }}</span> }
              </button>
            </li>
          }
        </ul>
      }
      <div class="actions-dialogue">
        @if (auth.connecte()) {
          <a routerLink="/aide" class="bouton-discret" (click)="fermer()">Toutes les questions</a>
        }
        <button type="button" class="bouton-principal" (click)="fermer()">Revenir à l'écran</button>
      </div>
    </app-dialogue>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .barre-page {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      gap: var(--pas); margin-bottom: var(--pas-2);
    }
    .retour-page {
      display: inline-flex; align-items: center; min-height: 44px;
      font-weight: 700; text-decoration: none; color: var(--profond);
    }
    .retour-page:hover { text-decoration: underline; }
    .comment-faire { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
    .comment-faire svg {
      width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2;
      stroke-linecap: round; stroke-linejoin: round;
    }
    .autres { margin-bottom: var(--pas-2); }
    .manuels { list-style: none; margin: var(--pas-2) 0; padding: 0; display: grid; gap: var(--pas); }
    .manuel {
      display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%;
      min-height: 44px; padding: var(--pas-2); text-align: left; font: inherit; cursor: pointer;
      background: var(--carte); border: 1px solid var(--trait); border-radius: var(--r-s); color: inherit;
    }
    .manuel:hover .titre { text-decoration: underline; }
    .titre { font-weight: 700; color: var(--profond); }
    .pastille {
      display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem; font-weight: 700; vertical-align: 2px;
    }
    .exemples { font-size: .875rem; color: var(--craie); font-style: italic; }
    .actions-dialogue a { display: inline-flex; align-items: center; text-decoration: none; }
    @media print { :host { display: none; } }
  `]
})
export class BarrePageComponent {
  protected navigation = inject(NavigationService);
  protected auth = inject(AuthService);

  retour = this.navigation.retour;
  /**
   * La page Aide est elle-même l'aide. Sans compte, « Comment faire ? » ne
   * montre que l'aide des écrans publics (connexion, séjour par lien).
   */
  avecAide = computed(() => this.navigation.chemin() !== '/aide');

  ouvert = signal(false);
  manuels = signal<Manuel[]>([]);
  choisi = signal<Manuel | null>(null);

  /** Les manuels ne se chargent qu'au premier appui (ils sont embarqués, sans réseau). */
  async ouvrir(): Promise<void> {
    const [{ manuelsDeLEcran }, { droitsDe }] = await Promise.all([
      import('../features/aide/comment-faire'), import('../features/aide/droits')
    ]);
    const manuels = manuelsDeLEcran(this.navigation.chemin(), droitsDe(this.auth));
    this.manuels.set(manuels);
    this.choisi.set(manuels.length === 1 ? manuels[0] : null);
    this.ouvert.set(true);
  }

  fermer(): void {
    this.ouvert.set(false);
  }
}
