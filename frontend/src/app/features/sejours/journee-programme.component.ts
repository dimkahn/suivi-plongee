import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PalanqueesPlongeeComponent } from './palanquees-plongee.component';
import { PhotoJourneeComponent } from './photo-journee.component';
import { JourProgramme } from './programme-du-jour';
import { EvenementVue, LecturePhotoJournee, jourLong } from './sejour-api';

/**
 * Un jour du programme du séjour, présenté comme un carnet de voyage
 * (demande du club, 2026, d'après le carnet « Angola Tour ») : la date, le
 * titre du jour, le trajet, les photos des lieux deux par deux, puis les
 * rendez-vous et plongées, ce qu'on y verra, un conseil et l'hébergement.
 * Un jour sans présentation garde l'allure d'avant : la date et ses lignes.
 * Sert dans l'onglet « Programme » du séjour et dans le carnet de la page du lien.
 */
@Component({
  selector: 'app-journee-programme',
  imports: [PalanqueesPlongeeComponent, PhotoJourneeComponent],
  template: `
    @let j = jour();
    @let p = j.journee;
    <article class="carte jour" [class.aujourdhui]="aujourdhui()" [class.passe]="passe()" [class.presente]="!!p?.titre">
      @if (p?.titre) {
        <p class="surtitre">{{ jourLong(j.jour) }}@if (aujourdhui()) { <span class="pastille">aujourd'hui</span>}</p>
        <h3 class="titre">{{ p!.titre }}</h3>
      } @else {
        <h3>{{ jourLong(j.jour) }}@if (aujourdhui()) { <span class="pastille">aujourd'hui</span>}</h3>
      }
      @if (p?.trajet) { <p class="trajet">{{ p!.trajet }}</p> }

      @if (p && p.photos.length > 0 && lirePhoto(); as lire) {
        <div class="photos" [class.une]="p.photos.length === 1">
          @for (id of p.photos; track id) {
            <app-photo-journee [jour]="j.jour" [photoId]="id" [lire]="lire"
                               [alt]="'Photo du lieu' + (p.titre ? ' — ' + p.titre : '')" />
          }
        </div>
      }

      @if (j.lignes.length > 0) {
        @if (p) { <h4>Au programme</h4> }
        <ul class="lignes">
          @for (l of j.lignes; track $index) {
            <li>
              <span class="heure">{{ l.heure }}</span>
              <span class="quoi">
                <strong>{{ l.titre }}</strong>@if (l.lieu) { <span class="secondaire"> — {{ l.lieu }}</span>}
                @if (l.details) { <span class="texte-libre secondaire">{{ l.details }}</span> }
                @if (l.palanquees.length > 0) {
                  <app-palanquees-plongee [palanquees]="l.palanquees" [encadrant]="encadrant()" />
                }
              </span>
              @if (gere() && l.evenement; as e) {
                <span class="sans-impression boutons-ligne">
                  <button type="button" class="bouton-discret" (click)="modifierEvenement.emit(e)"
                          [attr.aria-label]="'Modifier ' + e.titre">Modifier</button>
                </span>
              }
            </li>
          }
        </ul>
      }

      @if (p?.descriptif) {
        <h4>À découvrir</h4>
        <p class="texte-libre">{{ p!.descriptif }}</p>
      }
      @if (p?.conseil) {
        <h4>Conseil pratique</h4>
        <p class="texte-libre">{{ p!.conseil }}</p>
      }
      @if (p?.hebergement) {
        <h4>Hébergement</h4>
        <p>{{ p!.hebergement }}</p>
      }

      @if (gere()) {
        <button type="button" class="bouton-discret presenter sans-impression" (click)="presenter.emit(j.jour)">
          {{ p ? 'Modifier la présentation' : 'Présenter la journée' }}
        </button>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host { display: block; }
    .jour { padding: var(--pas-2); margin-bottom: var(--pas-2); }
    .jour.presente { border-top: 4px solid var(--profond); }
    .jour.aujourdhui { border-left: 6px solid var(--profond); }
    .jour.passe { opacity: .6; }
    h3 { margin: 0 0 var(--pas); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .surtitre { margin: 0; font-size: .8125rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
                color: var(--profond-fonce); display: flex; flex-wrap: wrap; align-items: center; gap: var(--pas); }
    .titre { font-size: 1.375rem; color: var(--profond-fonce); margin: 2px 0 0; }
    .trajet { margin: 2px 0 0; color: var(--craie); }
    .pastille { padding: 2px 10px; border-radius: var(--r-s); font-size: .8125rem; background: var(--profond); color: #fff;
                text-transform: none; letter-spacing: 0; }
    .photos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pas); margin: var(--pas-2) 0 0; }
    .photos.une { grid-template-columns: 1fr; }
    .photos app-photo-journee { aspect-ratio: 4 / 3; }
    .photos.une app-photo-journee { aspect-ratio: 16 / 9; }
    h4 { margin: var(--pas-2) 0 var(--pas); font-size: .8125rem; font-weight: 700; letter-spacing: .04em;
         text-transform: uppercase; color: var(--profond-fonce); }
    h4 + p { margin: 0; }
    .texte-libre { white-space: pre-line; }
    span.texte-libre { display: block; }
    .lignes { list-style: none; margin: var(--pas) 0 0; padding: 0; display: grid; gap: var(--pas); }
    h4 + .lignes { margin-top: 0; }
    .lignes li { display: flex; gap: var(--pas-2); align-items: flex-start; }
    .heure { flex: none; width: 6.5rem; font-weight: 700; color: var(--profond-fonce); }
    .quoi { flex: 1; min-width: 0; }
    .presenter { margin-top: var(--pas-2); }
    @media (max-width: 640px) { .heure { width: 4.5rem; } }
    @media print {
      .jour { break-inside: avoid; }
      .photos app-photo-journee { max-height: 6cm; }
    }
  `]
})
export class JourneeProgrammeComponent {
  jour = input.required<JourProgramme>();
  /** Lit une photo de la journée (appli ou page du lien) ; null : pas de photos montrées. */
  lirePhoto = input<LecturePhotoJournee | null>(null);
  aujourdhui = input(false);
  passe = input(false);
  /** Encadrant : toutes les palanquées de chaque plongée, pas seulement la sienne. */
  encadrant = input(false);
  /** Organisateur : présenter la journée, modifier ses rendez-vous. */
  gere = input(false);
  presenter = output<string>();
  modifierEvenement = output<EvenementVue>();

  readonly jourLong = jourLong;
}
