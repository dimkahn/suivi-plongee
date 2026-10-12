import { Component, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Video, chargerCatalogue, dureeVideo, urlVideo } from '../videos/catalogue';
import { Manuel } from './manuel';

/**
 * Un manuel d'utilisation affiché en entier : réponse courte, vidéos d'aide,
 * pas à pas. Sert à la page Aide et à la fenêtre « Comment faire ? » de
 * chaque écran. Les vidéos demandent le réseau (catalogue.json) ; le texte,
 * embarqué dans l'appli, non.
 */
@Component({
  selector: 'app-manuel',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <ng-template #texte let-segments>@for (s of segments; track $index) {@if (s.lien) {<a [routerLink]="s.lien" (click)="lienSuivi.emit()">{{ s.texte }}</a>} @else if (s.gras) {<strong>{{ s.texte }}</strong>} @else {<ng-container>{{ s.texte }}</ng-container>}}</ng-template>

    @let m = manuel();
    <article class="manuel">
      <p class="rubrique">{{ m.rubrique }}</p>
      @if (avecTitre()) { <h1>{{ m.titre }}</h1> }
      <p class="resume"><ng-container *ngTemplateOutlet="texte; context: { $implicit: m.resume }" /></p>

      @if (m.ecran && auth.connecte() && avecEcran()) {
        <p><a class="bouton-principal ouvrir-ecran" [routerLink]="m.ecran" (click)="lienSuivi.emit()">Ouvrir l'écran</a></p>
      }

      @if (m.videos.length) {
        <section class="videos" aria-label="Vidéos d'aide">
          @for (id of m.videos; track id) {
            @if (video(id); as v) {
              <figure class="carte">
                @if (v.webm || v.mp4) {
                  <video controls playsinline preload="none" [muted]="!v.voix"
                         [class.ordinateur]="v.format === 'ordinateur'"
                         [attr.poster]="v.vignette ? url(v.vignette, v) : null">
                    @if (v.mp4) { <source [src]="url(v.mp4, v)" type="video/mp4"> }
                    @if (v.webm) { <source [src]="url(v.webm, v)" type="video/webm"> }
                  </video>
                } @else {
                  <p class="a-venir">Vidéo à venir</p>
                }
                <figcaption>
                  <span class="code">{{ v.id }}</span> {{ v.titre }}
                  @if (v.duree) { <span class="duree">· {{ duree(v.duree) }}</span> }
                </figcaption>
              </figure>
            } @else if (catalogueAbsent()) {
              <p class="secondaire">
                <a routerLink="/videos" [queryParams]="{ v: id }" (click)="lienSuivi.emit()">Vidéo {{ id }}</a> (pas encore publiée).
              </p>
            }
          }
        </section>
      }

      @for (b of m.blocs; track $index) {
        @switch (b.type) {
          @case ('titre') { <h2>{{ b.texte }}</h2> }
          @case ('paragraphe') { <p><ng-container *ngTemplateOutlet="texte; context: { $implicit: b.segments }" /></p> }
          @case ('liste') {
            @if (b.ordonnee) {
              <ol>@for (e of b.elements; track $index) { <li><ng-container *ngTemplateOutlet="texte; context: { $implicit: e }" /></li> }</ol>
            } @else {
              <ul>@for (e of b.elements; track $index) { <li><ng-container *ngTemplateOutlet="texte; context: { $implicit: e }" /></li> }</ul>
            }
          }
        }
      }

      @if (m.questions.length) {
        <details class="questions">
          <summary>Les questions auxquelles ce manuel répond</summary>
          <ul>@for (q of m.questions; track q) { <li>{{ q }}</li> }</ul>
        </details>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .manuel { max-width: 760px; }
    .rubrique { color: var(--craie); font-size: .8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: 0; }
    h1 { margin-bottom: var(--pas); }
    .resume { font-size: 1.0625rem; }
    h2 { color: var(--profond); margin: var(--pas-3) 0 var(--pas); }
    ol, ul { padding-left: var(--pas-3); display: grid; gap: 6px; }
    .bouton-principal { display: inline-flex; align-items: center; min-height: 44px; text-decoration: none; }

    .videos { display: flex; flex-wrap: wrap; gap: var(--pas-2); margin: var(--pas-2) 0; }
    .videos figure { margin: 0; padding: var(--pas); display: flex; flex-direction: column; gap: var(--pas); }
    .videos video {
      display: block; background: #000; border-radius: var(--r-s);
      width: 240px; max-width: 100%; max-height: 60dvh;
    }
    .videos video.ordinateur { width: 480px; }
    .videos figcaption { font-size: .9375rem; font-weight: 700; max-width: 480px; }
    .code {
      display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem; vertical-align: 2px;
    }
    .duree { color: var(--craie); font-weight: 400; }
    .a-venir { color: var(--craie); font-weight: 700; margin: 0; }
    .questions { margin-top: var(--pas-3); }
    .questions summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700; }
    @media (max-width: 600px) {
      .videos video, .videos video.ordinateur { width: 100%; }
    }
  `]
})
export class ManuelComponent {
  private http = inject(HttpClient);
  protected auth = inject(AuthService);

  manuel = input.required<Manuel>();
  /** Faux dans la fenêtre « Comment faire ? », qui porte déjà le titre. */
  avecTitre = input(true);
  /** Faux quand on est déjà sur l'écran du manuel. */
  avecEcran = input(true);
  /** Un lien du manuel a été suivi : la fenêtre qui le montre se ferme. */
  lienSuivi = output<void>();

  private videos = signal<Map<string, Video>>(new Map());
  catalogueAbsent = signal(false);

  constructor() {
    chargerCatalogue(this.http).then(
      c => this.videos.set(new Map(c.videos.map(v => [v.id, v]))),
      () => this.catalogueAbsent.set(true)
    );
  }

  video(id: string): Video | null {
    return this.videos().get(id) ?? null;
  }

  url(fichier: string, v: Video): string {
    return urlVideo(fichier, v);
  }

  duree(secondes: number): string {
    return dureeVideo(secondes);
  }
}
