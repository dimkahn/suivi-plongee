import { Component, ElementRef, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { manuelDeLaVideo } from '../aide/manuels';
import { Catalogue, Video, chargerCatalogue, dureeVideo, urlVideo } from './catalogue';

/** Ce qu'on dit de chaque rubrique, sous son titre. */
const PRESENTATION: Record<string, string> = {
  'Découverte': 'Pour qui découvre l\'appli.',
  'Moniteur': 'Au bord du bassin, téléphone en main : présences, notes, planning, fiches de sécurité.',
  'Administrateur': 'La gestion du club : saisons, séances, élèves, inscriptions, groupes, planning.',
  'Directeur technique': 'Le matériel du club : inventaire, contrôles, prêts.',
  'Élève': 'Suivre sa propre progression.'
};

/**
 * Page publique des vidéos d'aide, sans connexion : rangées par rôle, comme
 * la liste des scénarios (outils/videos/SCENARIOS.md). Les données filmées
 * sont celles de démonstration, noms fictifs.
 */
@Component({
  selector: 'app-videos',
  imports: [RouterLink],
  template: `
    @if (!auth.connecte()) {
      <p class="retour"><a routerLink="/connexion">← Se connecter</a></p>
    }
    <h1>Vidéos d'aide</h1>
    <p class="secondaire intro">
      Une vidéo par geste, rangées par rôle. Elles sont tournées sur des données de démonstration :
      les élèves et les encadrants qu'on y voit sont fictifs.
    </p>
    <p class="intro"><a routerLink="/aide">Une question ? Cherchez dans l'aide : le manuel de chaque écran, avec sa vidéo.</a></p>

    @if (etat() === 'chargement') {
      <p class="vide">Chargement…</p>
    } @else if (etat() === 'absent') {
      <div class="carte vide"><p>Les vidéos ne sont pas encore publiées.</p></div>
    } @else {
      <nav class="rubriques" aria-label="Rubriques">
        @for (r of rubriques(); track r.nom) {
          <button type="button" class="bouton-discret" (click)="allerA(r.nom)">
            {{ r.nom }} <span class="compte">{{ r.videos.length }}</span>
          </button>
        }
      </nav>

      @for (r of rubriques(); track r.nom) {
        <section [id]="ancre(r.nom)">
          <h2>{{ r.nom }}</h2>
          @if (presentation(r.nom); as p) { <p class="secondaire">{{ p }}</p> }
          <ul class="videos">
            @for (v of r.videos; track v.id) {
              <li class="carte">
                <button type="button" class="lire" [disabled]="!v.webm && !v.mp4" (click)="ouvrir(v)"
                        [attr.aria-label]="'Voir la vidéo : ' + v.titre">
                  <span class="apercu" [class.ordinateur]="v.format === 'ordinateur'">
                    @if (v.vignette) {
                      <img [src]="url(v.vignette, v)" alt="" loading="lazy">
                    }
                    @if (v.webm || v.mp4) {
                      <span class="icone-lecture" aria-hidden="true">▶</span>
                    } @else {
                      <span class="a-venir">À venir</span>
                    }
                  </span>
                  <span class="texte">
                    <span class="titre"><span class="code">{{ v.id }}</span> {{ v.titre }}</span>
                    <span class="secondaire">{{ v.resume }}</span>
                    @if (v.duree) { <span class="duree">{{ duree(v.duree) }}</span> }
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
    }

    <dialog #lecteur class="lecteur" aria-labelledby="titre-lecteur" (close)="fermer()">
      @if (enLecture(); as v) {
        <div class="entete-lecteur">
          <h2 id="titre-lecteur">{{ v.titre }}</h2>
          <button type="button" class="bouton-discret" (click)="lecteur.close()">Fermer</button>
        </div>
        <video controls autoplay playsinline [muted]="!v.voix" [class.ordinateur]="v.format === 'ordinateur'"
               [attr.poster]="v.vignette ? url(v.vignette, v) : null">
          @if (v.mp4) { <source [src]="url(v.mp4, v)" type="video/mp4"> }
          @if (v.webm) { <source [src]="url(v.webm, v)" type="video/webm"> }
        </video>
        <p class="secondaire">{{ v.resume }}</p>
        @if (manuel(v); as m) {
          <p><a class="lien-manuel" [routerLink]="['/aide']" [queryParams]="{ m: m.id }">Lire le manuel : {{ m.titre }}</a></p>
        }
        @if (v.texte?.length) {
          <details class="transcription">
            <summary>Le texte de la vidéo</summary>
            <ol>
              @for (t of v.texte; track $index) { <li>{{ t }}</li> }
            </ol>
          </details>
        }
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .retour { margin: 0 0 var(--pas-2); }
    .retour a { display: inline-flex; align-items: center; min-height: 44px; }
    h1 { margin-bottom: var(--pas); }
    .intro { max-width: 680px; }

    .rubriques { display: flex; flex-wrap: wrap; gap: var(--pas); margin: var(--pas-3) 0; }
    .compte {
      margin-left: 6px; padding: 0 8px; border-radius: 999px;
      background: var(--fond); color: var(--craie); font-size: .8125rem; font-weight: 700;
    }

    section { margin-top: var(--pas-4); scroll-margin-top: var(--pas-2); }
    h2 { color: var(--profond); margin-bottom: var(--pas); }
    .videos {
      list-style: none; margin: var(--pas-2) 0 0; padding: 0;
      display: grid; gap: var(--pas-2); grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .videos li { padding: 0; overflow: hidden; }
    .lire {
      display: flex; gap: var(--pas-2); width: 100%; height: 100%; padding: var(--pas-2);
      background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: pointer;
      min-height: 44px;
    }
    .lire:disabled { cursor: default; opacity: .7; }
    .apercu {
      position: relative; flex: none; width: 84px; height: 150px; border-radius: var(--r-s);
      background: var(--fond); overflow: hidden; display: flex; align-items: center; justify-content: center;
    }
    .apercu.ordinateur { width: 150px; height: 94px; align-self: center; }
    .apercu img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .icone-lecture {
      position: absolute; width: 40px; height: 40px; border-radius: 50%;
      background: rgba(12, 53, 71, .8); color: #fff; font-size: 1rem;
      display: flex; align-items: center; justify-content: center; padding-left: 3px;
    }
    .a-venir { color: var(--craie); font-size: .8125rem; font-weight: 700; }
    .texte { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .titre { font-weight: 700; }
    .code {
      display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: var(--r-s);
      background: var(--profond); color: #fff; font-size: .75rem; vertical-align: 2px;
    }
    .texte .secondaire { font-size: .875rem; }
    .duree { color: var(--craie); font-size: .8125rem; }

    .lecteur {
      width: min(960px, calc(100vw - 32px)); max-height: calc(100dvh - 32px);
      border: 0; border-radius: var(--r); padding: var(--pas-2);
    }
    .lecteur::backdrop { background: rgba(12, 53, 71, .7); }
    .entete-lecteur { display: flex; align-items: center; justify-content: space-between; gap: var(--pas-2); }
    .entete-lecteur h2 { margin: 0; color: var(--encre); font-size: 1.125rem; }
    video {
      display: block; margin: var(--pas-2) auto; background: #000; border-radius: var(--r-s);
      max-width: 100%; max-height: calc(100dvh - 200px);
    }
    video.ordinateur { width: 100%; }
    .lien-manuel { display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; }
    .transcription summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 700; }
    .transcription ol { margin: 0; padding-left: var(--pas-3); display: grid; gap: 4px; }
    @media (max-width: 600px) {
      .videos { grid-template-columns: 1fr; }
    }
  `]
})
export class VideosComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected auth = inject(AuthService);

  lecteur = viewChild.required<ElementRef<HTMLDialogElement>>('lecteur');

  catalogue = signal<Catalogue | null>(null);
  etat = signal<'chargement' | 'pret' | 'absent'>('chargement');
  enLecture = signal<Video | null>(null);

  /** Les rubriques dans l'ordre du catalogue, sans celles qui n'ont aucune vidéo. */
  rubriques = computed(() => {
    const c = this.catalogue();
    if (!c) return [];
    return c.publics
      .map(nom => ({ nom, videos: c.videos.filter(v => v.public === nom) }))
      .filter(r => r.videos.length > 0);
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      const c = await chargerCatalogue(this.http);
      this.catalogue.set(c);
      this.etat.set('pret');
      // Lien direct vers une vidéo : /videos?v=M04
      const demandee = this.route.snapshot.queryParamMap.get('v');
      const v = c.videos.find(x => x.id === demandee);
      if (v) this.ouvrir(v);
    } catch {
      this.etat.set('absent');
    }
  }

  url(fichier: string, v: Video): string {
    return urlVideo(fichier, v);
  }

  manuel(v: Video) {
    return manuelDeLaVideo(v.id, v.public);
  }

  presentation(rubrique: string): string | null {
    return PRESENTATION[rubrique] ?? null;
  }

  ancre(rubrique: string): string {
    return 'rubrique-' + rubrique.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();
  }

  allerA(rubrique: string): void {
    document.getElementById(this.ancre(rubrique))?.scrollIntoView({ behavior: 'smooth' });
  }

  duree(secondes: number): string {
    return dureeVideo(secondes);
  }

  ouvrir(v: Video): void {
    if (!v.webm && !v.mp4) return;
    this.enLecture.set(v);
    this.lecteur().nativeElement.showModal();
    void this.router.navigate([], { queryParams: { v: v.id }, replaceUrl: true });
  }

  fermer(): void {
    // Arrête la lecture : la vidéo disparaît avec le contenu du dialogue.
    this.enLecture.set(null);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
