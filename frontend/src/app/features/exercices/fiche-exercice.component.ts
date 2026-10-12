import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { FicheExerciceVue, VideoExerciceVue } from '../../core/modeles';
import { PastillePhaseComponent, libellePhase } from '../../core/phase-exercice';
import { SchemaExerciceComponent } from '../../core/schema-exercice.component';
import { PhotoExerciceComponent } from '../../core/photo-exercice.component';
import { plageMois } from '../../core/progression';

/** Une vidéo publiée par le club ou un fichier vidéo se lit dans la page ; le reste s'ouvre à part. */
export function videoDansLaPage(v: VideoExerciceVue): boolean {
  return v.adresse.startsWith('/medias/') || /\.(mp4|webm|m4v|mov)(\?.*)?$/i.test(v.adresse);
}

/**
 * Fiche complète d'un exercice de la base, pour l'encadrant qui prépare ou
 * mène sa séance : déroulement, critère de réussite, conseils, schéma,
 * photos et vidéos, critères travaillés, place dans le parcours de
 * formation, exercices précédent et suivant de la compétence. Lecture
 * seule ; les photos et vidéos se déposent dans la base d'exercices
 * (administration). Réseau obligatoire.
 */
@Component({
  selector: 'app-fiche-exercice',
  imports: [RouterLink, PastillePhaseComponent, SchemaExerciceComponent, PhotoExerciceComponent],
  template: `
    <a routerLink="/parcours" [queryParams]="fiche() ? { referentiel: fiche()!.referentielId } : {}" class="retour">
      ← Parcours de formation
    </a>
    @if (erreur(); as e) {
      <div class="alerte" role="alert">{{ e }}</div>
    } @else if (fiche(); as f) {
      <p class="secondaire contexte">
        {{ f.niveau }} · MFT {{ f.versionMft }} ·
        @if (f.regroupement) { <span class="regroupement">{{ f.regroupement }}</span> }
        {{ f.bloc }}
      </p>
      <h1 class="titre">
        <app-pastille-phase [phase]="f.phase" [numero]="f.numero" [intitule]="f.intitule" />
        {{ f.intitule }}
      </h1>
      <p class="phase">{{ libellePhase(f.phase) }}@if (!f.actif) { · <strong>désactivé</strong> (plus proposé) }</p>

      <section class="carte">
        <h2>Critères travaillés</h2>
        <ul class="criteres">
          @for (c of f.criteres; track c.id) { <li>{{ c.savoirFaire }}</li> }
        </ul>
        @if (f.phase === 'MAITRISE') {
          <p class="secondaire">Exercice de maîtrise : réussi, il rend ces critères acquis{{ f.niveau === 'N1' ? '' : ' (en milieu naturel seulement)' }}.</p>
        } @else {
          <p class="secondaire">Une note sur cet exercice met le critère en cours ; seule la maîtrise le rend acquis.</p>
        }
      </section>

      @if (f.deroulement) {
        <section class="carte">
          <h2>Organisation et déroulement</h2>
          <p class="texte">{{ f.deroulement }}</p>
        </section>
      }
      @if (f.critereReussite) {
        <section class="carte reussite">
          <h2>Critère de réussite</h2>
          <p class="texte">{{ f.critereReussite }}</p>
        </section>
      }
      @if (f.conseils) {
        <section class="carte conseils">
          <h2>Conseils de l'encadrant</h2>
          <p class="texte">{{ f.conseils }}</p>
        </section>
      }

      @if (f.aSchema) {
        <section class="carte">
          <h2>Schéma</h2>
          <app-schema-exercice [exerciceId]="f.id" [libelle]="f.numero + ' ' + f.intitule" />
        </section>
      }

      @if (f.photos.length > 0) {
        <section class="carte">
          <h2>Photos</h2>
          <div class="photos">
            @for (p of f.photos; track p.id) {
              <figure>
                <app-photo-exercice [exerciceId]="f.id" [photoId]="p.id" [legende]="p.legende" />
                @if (p.legende) { <figcaption>{{ p.legende }}</figcaption> }
              </figure>
            }
          </div>
        </section>
      }

      @if (f.videos.length > 0) {
        <section class="carte">
          <h2>Vidéos</h2>
          @for (v of f.videos; track v.id) {
            <div class="video">
              @if (videoDansLaPage(v)) {
                <video [src]="v.adresse" controls preload="metadata" playsinline></video>
              }
              <a [href]="v.adresse" target="_blank" rel="noopener noreferrer" class="bouton-discret">
                {{ v.legende || 'Voir la vidéo' }} ↗
              </a>
            </div>
          }
        </section>
      }

      @if (!f.aSchema && f.photos.length === 0 && f.videos.length === 0) {
        <p class="secondaire">Pas encore de schéma, de photo ni de vidéo pour cet exercice.</p>
      }

      <section class="carte">
        <h2>Dans le parcours de formation</h2>
        @if (f.periodes.length === 0) {
          <p class="secondaire">Cet exercice n'est prévu dans aucune période d'une progression type.</p>
        } @else {
          <ul class="periodes">
            @for (p of f.periodes; track p.progressionId + '-' + p.rang) {
              <li>
                <a routerLink="/parcours" [queryParams]="{ progression: p.progressionId }">
                  {{ p.progression }}</a> :
                <span class="plage">{{ plage(p.moisDebut, p.moisFin) }}</span>, {{ p.intitule }}
                @if (p.milieu) { <span class="secondaire">({{ p.milieu === 'NATUREL' ? 'milieu naturel' : 'piscine / fosse' }})</span> }
              </li>
            }
          </ul>
        }
      </section>

      <nav class="voisins" aria-label="Exercices de la même compétence">
        @if (f.precedent; as p) {
          <a [routerLink]="['/exercices', p.id]" class="bouton-discret">
            ← <app-pastille-phase [phase]="p.phase" [numero]="p.numero" [intitule]="p.intitule" /> {{ p.intitule }}
          </a>
        } @else { <span></span> }
        @if (f.suivant; as s) {
          <a [routerLink]="['/exercices', s.id]" class="bouton-discret">
            <app-pastille-phase [phase]="s.phase" [numero]="s.numero" [intitule]="s.intitule" /> {{ s.intitule }} →
          </a>
        }
      </nav>
    } @else {
      <p class="vide">Chargement…</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .retour { display: inline-flex; align-items: center; min-height: 44px; }
    .contexte { margin: var(--pas) 0 0; }
    .regroupement {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 6px; font-size: .75rem;
    }
    .titre { display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); margin: var(--pas) 0 0; }
    .phase { margin: 4px 0 var(--pas-2); color: var(--profond); font-weight: 700; }
    .carte { padding: var(--pas-2) var(--pas-3); margin-top: var(--pas-2); }
    .carte h2 { margin: 0 0 var(--pas); font-size: 1rem; }
    .texte { margin: 0; white-space: pre-line; }
    .reussite { border-left: 4px solid var(--acquis); }
    .conseils { border-left: 4px solid var(--en-cours); }
    .criteres, .periodes { margin: 0 0 var(--pas); padding-left: 1.25rem; display: grid; gap: 2px; }
    .plage { text-transform: capitalize; font-weight: 700; color: var(--profond); }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--pas-2); }
    figure { margin: 0; }
    figcaption { margin-top: 4px; font-size: .875rem; color: var(--craie); }
    .video { display: flex; flex-direction: column; gap: var(--pas); margin-bottom: var(--pas-2); }
    .video video { width: 100%; max-width: 640px; border-radius: var(--r-s); background: #000; }
    .video a { align-self: flex-start; }
    .voisins {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--pas); margin: var(--pas-3) 0;
    }
    .voisins a { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
  `]
})
export class FicheExerciceComponent {
  private api = inject(ApiService);
  private reseau = inject(ReseauService);

  /** Identifiant de l'exercice, tiré de l'adresse. */
  id = input.required<string>();

  fiche = signal<FicheExerciceVue | null>(null);
  erreur = signal<string | null>(null);

  readonly libellePhase = libellePhase;
  readonly plage = plageMois;
  readonly videoDansLaPage = videoDansLaPage;

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.charger(id));
    });
  }

  private async charger(id: number): Promise<void> {
    this.fiche.set(null);
    this.erreur.set(null);
    try {
      this.fiche.set(await firstValueFrom(this.api.ficheExercice(id)));
      window.scrollTo?.(0, 0);
    } catch (e) {
      this.erreur.set(!this.reseau.enLigne()
        ? 'La fiche d\'un exercice demande le réseau.'
        : (e as HttpErrorResponse).error?.detail ?? 'Impossible de charger cet exercice.');
    }
  }
}
