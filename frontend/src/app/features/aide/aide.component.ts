import { Component, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { droitsDe, manuelPermis } from './droits';
import { RUBRIQUES, chercher } from './manuel';
import { ManuelComponent } from './manuel.component';
import { MANUELS } from './manuels';

/**
 * Page d'aide, pour un compte connecté : les questions fréquentes, limitées
 * aux manuels des écrans que ses droits lui ouvrent (droits.ts). On tape
 * sa question, l'appli retrouve le manuel qui y répond (manuels/*.md) et
 * montre la vidéo d'aide qui va avec. La recherche se fait dans le
 * navigateur, sur les manuels embarqués : elle marche sans réseau ; seules
 * les vidéos demandent le réseau (catalogue.json, comme la page /videos).
 */
@Component({
  selector: 'app-aide',
  imports: [RouterLink, NgTemplateOutlet, ManuelComponent],
  template: `
    <ng-template #texte let-segments>@for (s of segments; track $index) {@if (s.lien) {<a [routerLink]="s.lien">{{ s.texte }}</a>} @else if (s.gras) {<strong>{{ s.texte }}</strong>} @else {<ng-container>{{ s.texte }}</ng-container>}}</ng-template>

    <!-- Le lien de retour (« ← Toutes les questions », « ← Se connecter ») est dans la barre de page, comme partout. -->
    @if (manuelOuvert(); as m) {
      <app-manuel [manuel]="m" />
    } @else {
      <h1>Aide</h1>
      <p class="secondaire intro">
        Posez votre question : l'appli retrouve le manuel de l'écran concerné, avec sa vidéo d'aide.
      </p>

      <label for="question" class="visuellement-cache">Votre question</label>
      <input id="question" type="search" class="recherche" autocomplete="off" enterkeyhint="search"
             placeholder="Ex. : comment faire l'appel ?" [value]="question()" (input)="saisir($any($event.target).value)">

      @if (question().trim()) {
        @if (resultats().length) {
          <p class="secondaire">{{ resultats().length === 1 ? 'Une réponse' : resultats().length + ' réponses' }}, la plus proche d'abord.</p>
          <ul class="manuels">
            @for (m of resultats(); track m.id) {
              <ng-container *ngTemplateOutlet="carte; context: { $implicit: m, rubrique: true }" />
            }
          </ul>
        } @else {
          <div class="carte vide">
            <p>Aucun manuel ne répond à cette question. Essayez avec d'autres mots, parcourez les rubriques
              ci-dessous, ou demandez à un administrateur du club.</p>
          </div>
        }
      }

      @if (!question().trim() || !resultats().length) {
        <nav class="rubriques" aria-label="Rubriques">
          @for (r of rubriques(); track r.nom) {
            <button type="button" class="bouton-discret" (click)="allerA(r.nom)">
              {{ r.nom }} <span class="compte">{{ r.manuels.length }}</span>
            </button>
          }
          <a routerLink="/videos" class="bouton-discret">Toutes les vidéos</a>
        </nav>
        @for (r of rubriques(); track r.nom) {
          <section [id]="ancre(r.nom)">
            <h2>{{ r.nom }}</h2>
            <ul class="manuels">
              @for (m of r.manuels; track m.id) {
                <ng-container *ngTemplateOutlet="carte; context: { $implicit: m, rubrique: false }" />
              }
            </ul>
          </section>
        }
      }
    }

    <ng-template #carte let-m let-rubrique="rubrique">
      <li class="carte">
        <a class="ouvrir" [routerLink]="[]" [queryParams]="{ m: m.id, q: question() || null }">
          <span class="titre">
            {{ m.titre }}
            @if (m.videos.length) { <span class="pastille" title="Avec vidéo d'aide">▶ vidéo</span> }
          </span>
          @if (rubrique) { <span class="rubrique">{{ m.rubrique }}</span> }
          <span class="secondaire"><ng-container *ngTemplateOutlet="texte; context: { $implicit: m.resume }" /></span>
          @if (m.questions.length) {
            <span class="exemples">{{ m.questions.slice(0, 3).join(' · ') }}</span>
          }
        </a>
      </li>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    .intro { max-width: 680px; }
    .visuellement-cache {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }
    .recherche { width: 100%; max-width: 680px; min-height: 48px; font-size: 1.0625rem; margin: var(--pas-2) 0; }

    .rubriques { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-3) 0; }
    .rubriques a { display: inline-flex; align-items: center; }
    .compte {
      margin-left: 6px; padding: 0 8px; border-radius: 999px;
      background: var(--fond); color: var(--craie); font-size: .8125rem; font-weight: 700;
    }
    section { margin-top: var(--pas-4); scroll-margin-top: var(--pas-2); }
    h2 { color: var(--profond); margin-bottom: var(--pas); }

    .manuels {
      list-style: none; margin: var(--pas-2) 0 0; padding: 0;
      display: grid; gap: var(--pas-2); grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .manuels li { padding: 0; }
    .ouvrir {
      display: flex; flex-direction: column; gap: 6px; height: 100%; padding: var(--pas-2);
      color: inherit; text-decoration: none; min-height: 44px;
    }
    .ouvrir:hover .titre { text-decoration: underline; }
    .titre { font-weight: 700; color: var(--profond); }
    .pastille {
      display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem; font-weight: 700; vertical-align: 2px;
    }
    .rubrique { color: var(--craie); font-size: .8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: 0; }
    .ouvrir .secondaire { font-size: .9375rem; }
    .exemples { font-size: .8125rem; color: var(--craie); font-style: italic; }

    @media (max-width: 600px) {
      .manuels { grid-template-columns: 1fr; }
    }
  `]
})
export class AideComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  /** Les manuels que le compte connecté peut lire. */
  private manuels = computed(() => {
    const droits = droitsDe(this.auth);
    return MANUELS.filter(m => manuelPermis(m, droits));
  });

  private parametres = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /** Ce qui est tapé, gardé dans l'adresse (?q=…) pour revenir aux réponses. */
  question = signal(this.route.snapshot.queryParamMap.get('q') ?? '');

  manuelOuvert = computed(() => {
    const id = this.parametres().get('m');
    return this.manuels().find(m => m.id === id) ?? null;
  });

  resultats = computed(() => chercher(this.manuels(), this.question()));

  rubriques = computed(() => RUBRIQUES
    .map(nom => ({ nom, manuels: this.manuels().filter(m => m.rubrique === nom) }))
    .filter(r => r.manuels.length > 0));

  constructor() {
    // Ouvrir un manuel, ou revenir à la liste, repart du haut de la page.
    effect(() => {
      this.manuelOuvert();
      window.scrollTo({ top: 0 });
    });
  }

  saisir(texte: string): void {
    this.question.set(texte);
    void this.router.navigate([], { queryParams: { q: texte.trim() ? texte : null }, replaceUrl: true });
  }

  ancre(rubrique: string): string {
    return 'rubrique-' + rubrique.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();
  }

  allerA(rubrique: string): void {
    document.getElementById(this.ancre(rubrique))?.scrollIntoView({ behavior: 'smooth' });
  }
}
