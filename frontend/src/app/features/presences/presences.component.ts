import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { libellePreparation } from '../../core/niveaux';
import { ApiService } from '../../core/api.service';
import { ReseauService } from '../../core/reseau.service';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { dateDuJour, dateFr } from '../../core/date-fr';
import { Atelier, LignePresence, SeanceVue, StatutPresence } from '../../core/modeles';
import { CalendrierSeancesComponent } from '../../core/calendrier-seances.component';

type Niveau = 'TOUS' | 'N1' | 'N2' | 'N3';

/** Un bouton de la ligne : l'atelier fait par un élève présent. */
interface Choix {
  cle: string;
  libelle: string;
  statut: StatutPresence;
  atelier: Atelier | null;
  classe: string;
}

/**
 * Pas de bouton « Absent » : un élève sans choix est absent. Plongée, Excusé et
 * Absent ne sont plus proposés ; une saisie ancienne de ce type reste affichée.
 */
const CHOIX: Choix[] = [
  { cle: 'NAGE', libelle: 'Nage', statut: 'PRESENT', atelier: 'NAGE', classe: 'present' },
  { cle: 'BLOC', libelle: 'Bloc', statut: 'PRESENT', atelier: 'BLOC', classe: 'present' },
  { cle: 'THEORIE', libelle: 'Théorie', statut: 'PRESENT', atelier: 'THEORIE', classe: 'present' }
];

function cleDe(l: LignePresence): string | null {
  if (!l.statut) return null;
  return l.statut === 'PRESENT' ? (l.atelier ?? 'PRESENT') : l.statut;
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Feuille de présence d'une séance : ce que chaque élève a fait (nage, bloc,
 * théorie) ; sans choix, il est absent. Remplace la grille de dates en
 * colonnes du tableur ; les compteurs « séances bloc / nage » de Infos élèves
 * en découlent. Enregistrement immédiat à chaque toucher ; hors ligne, le
 * choix est gardé sur l'appareil ({@link FileEcrituresService}) et part au
 * retour du réseau.
 *
 * Sur téléphone, les boutons de choix ne tiennent pas sur chaque carte sans
 * forcer une seule carte par ligne : on les remplace par une barre en bas
 * d'écran, ouverte en touchant la carte, ce qui laisse plusieurs élèves par
 * ligne (voir le média-query 600px plus bas).
 */
@Component({
  selector: 'app-presences',
  imports: [FormsModule, CalendrierSeancesComponent],
  template: `
    <h1>Présences</h1>
    <p class="secondaire">
      Pour chaque élève présent, touchez ce qu'il a fait pendant la séance ; un élève sans choix est
      absent. Chaque choix est enregistré tout de suite ; toucher de nouveau le choix actif l'efface.
    </p>

    @if (!reseau.enLigne()) {
      <div class="alerte" role="status">
        Hors ligne : vos choix sont gardés sur l'appareil et partiront au retour du réseau.
      </div>
    }
    @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

    <label for="seance">Séance</label>
    <button id="seance" type="button" class="choix-seance" aria-haspopup="dialog" (click)="ouvrirDialogueSeance()">
      <span class="icone-calendrier" aria-hidden="true">📅</span>
      <span class="libelle-choix">{{ seanceChoisie() ? libelleSeance(seanceChoisie()!) : 'Choisir une séance' }}</span>
      <span class="changer">Changer</span>
    </button>

    <dialog #dialogueSeance class="dialogue-seance" aria-labelledby="titre-dialogue-seance"
            (close)="dialogueSeanceOuvert.set(false)">
      @if (dialogueSeanceOuvert()) {
        <div class="entete-dialogue">
          <h2 id="titre-dialogue-seance">Choisir la séance</h2>
          <button type="button" class="bouton-discret" (click)="fermerDialogueSeance()">Fermer</button>
        </div>
        <app-calendrier-seances [seances]="seances()" [jourMax]="aujourdhui"
                                [seanceMarquee]="seanceId()"
                                [jourSelectionne]="jourDialogue()"
                                (jourSelectionneChange)="toucherJour($event)" />
        @if (jourDialogue(); as j) {
          @let duJour = seancesDuJour(j);
          @if (duJour.length === 0) {
            <p class="secondaire aucune">Aucune séance ce jour-là.</p>
          } @else {
            <ul class="seances-du-jour">
              @for (s of duJour; track s.id) {
                <li>
                  <button type="button" class="bouton-discret" [class.actif]="s.id === seanceId()"
                          (click)="choisirDepuisDialogue(s)">
                    {{ libelleSeance(s) }}
                    <span class="milieu">{{ s.milieu === 'NATUREL' ? 'Milieu naturel' : 'Piscine / fosse' }}</span>
                  </button>
                </li>
              }
            </ul>
          }
        }
      }
    </dialog>

    @if (seanceId()) {
      <div class="filtres">
        <div class="niveaux" role="group" aria-label="Filtrer par niveau">
          @for (n of niveaux; track n) {
            <button type="button" class="bouton-discret" [class.actif]="niveau() === n"
                    [attr.aria-pressed]="niveau() === n" (click)="niveau.set(n)">
              {{ n === 'TOUS' ? 'Tous' : libellePreparation(n) }}
            </button>
          }
        </div>
        <input type="search" class="recherche" aria-label="Rechercher un élève"
               placeholder="Rechercher un élève…"
               [ngModel]="rechercheEleve()" (ngModelChange)="rechercheEleve.set($event)">
      </div>

      @if (chargement()) {
        <p class="vide">Chargement…</p>
      } @else if (lignes().length === 0) {
        <div class="carte vide"><p>Aucun élève inscrit sur la saison de cette séance.</p></div>
      } @else {
        <p class="bilan" role="status">
          {{ bilan().presents }} présent(s) · {{ bilan().absents }} absent(s)
          @if (bilan().enAttente > 0) { · {{ bilan().enAttente }} en attente d'envoi }
        </p>

        @if (lignesFiltrees().length === 0) {
          <div class="carte vide"><p>Aucun élève ne correspond aux filtres.</p></div>
        }
        <ul class="eleves">
          @for (l of lignesFiltrees(); track l.cursusId) {
            <li class="carte">
              <button type="button" class="zone-identite" (click)="ouvrirChoixMobile(l)">
                @if (urlPhoto(l.eleveId); as url) {
                  <img class="avatar" [src]="url" [alt]="l.eleve" width="56" height="56">
                } @else {
                  <div class="avatar silhouette" [attr.aria-label]="l.eleve">{{ initiales(l.eleve) }}</div>
                }
                <span class="identite">
                  <span class="nom">{{ l.eleve }}</span>
                  <span class="niveau">{{ libellePreparation(l.niveau) }}</span>
                  @if (enregistrements().has(l.cursusId)) {
                    <span class="enregistrement" role="status">
                      <span class="chargeur" aria-hidden="true"></span>Enregistrement…
                    </span>
                  } @else if (choixActuel(l); as ca) {
                    <span class="etat-mini" [class]="ca.classe" [class.differe]="enAttente().has(l.cursusId)">{{ ca.libelle }}</span>
                  } @else if (!l.statut) {
                    <span class="secondaire">Absent</span>
                  } @else {
                    <span class="secondaire">{{ libelleAncien(l) }}</span>
                  }
                </span>
              </button>
              <div class="choix" role="group" [attr.aria-label]="'Présence de ' + l.eleve">
                @for (c of choix; track c.cle) {
                  <button type="button" [class]="'etat ' + c.classe"
                          [class.actif]="cleDe(l) === c.cle"
                          [class.differe]="cleDe(l) === c.cle && enAttente().has(l.cursusId)"
                          [attr.aria-pressed]="cleDe(l) === c.cle"
                          [disabled]="enregistrements().has(l.cursusId)"
                          (click)="choisir(l, c)">
                    {{ c.libelle }}
                  </button>
                }
              </div>
            </li>
          }
        </ul>

        @if (ligneSelectionnee(); as l) {
          <div class="barre-choix" role="dialog" [attr.aria-label]="'Présence de ' + l.eleve">
            <p><strong>{{ l.eleve }}</strong> — qu'a-t-il fait ?</p>
            <div class="choix-rapide">
              @for (c of choix; track c.cle) {
                <button type="button" [class]="'etat ' + c.classe" [class.actif]="cleDe(l) === c.cle"
                        (click)="choisirEtFermer(l, c)">
                  {{ c.libelle }}
                </button>
              }
              <button type="button" class="bouton-discret" (click)="ligneSelectionnee.set(null)">Annuler</button>
            </div>
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    h1 { margin-bottom: var(--pas); }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; font-size: .9375rem; }

    .choix-seance {
      display: flex; align-items: center; gap: var(--pas); width: 100%; max-width: 420px; min-height: 44px;
      padding: var(--pas) var(--pas-2); background: var(--carte); color: var(--encre);
      border: 1px solid var(--trait); border-radius: var(--r-s); font: inherit; text-align: left; cursor: pointer;
    }
    .libelle-choix { flex: 1; min-width: 0; font-weight: 700; }
    .changer { color: var(--profond); font-size: .875rem; text-decoration: underline; }

    .dialogue-seance {
      width: min(640px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); padding: var(--pas-2);
      border: none; border-radius: var(--r); box-shadow: var(--ombre); background: var(--carte); color: var(--encre);
    }
    .dialogue-seance::backdrop { background: rgba(15, 23, 42, .5); }
    .entete-dialogue { display: flex; align-items: center; justify-content: space-between; gap: var(--pas); margin-bottom: var(--pas); }
    .entete-dialogue h2 { margin: 0; }
    .aucune { text-align: center; margin: var(--pas-2) 0 0; }
    .seances-du-jour { list-style: none; margin: var(--pas-2) 0 0; padding: 0; display: grid; gap: var(--pas); }
    .seances-du-jour button { display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left; }
    .seances-du-jour button.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .seances-du-jour .milieu { font-size: .8125rem; font-weight: 400; }

    .filtres {
      display: flex; flex-wrap: wrap; gap: var(--pas-2); align-items: center;
      margin: var(--pas-3) 0 var(--pas-2);
    }
    .niveaux { display: flex; gap: var(--pas); flex-wrap: wrap; }
    .niveaux .bouton-discret.actif { background: var(--profond); color: #fff; border-color: var(--profond); }
    .recherche { max-width: 320px; margin: 0; }

    .bilan { color: var(--craie); font-size: .875rem; margin-bottom: var(--pas-2); }

    /* Plusieurs élèves par ligne dès que la largeur le permet. */
    .eleves {
      list-style: none; margin: 0; padding: 0; display: grid; gap: var(--pas-2);
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
    .eleves li {
      padding: var(--pas-2); display: flex; justify-content: space-between; align-items: center;
      gap: var(--pas-2); flex-wrap: wrap;
    }
    /* Grand écran : identité en haut, les quatre choix alignés dessous. */
    @media (min-width: 601px) {
      .eleves li { flex-direction: column; align-items: stretch; }
    }
    .zone-identite {
      display: flex; align-items: center; gap: var(--pas); flex: 1 1 auto; min-width: 0;
      padding: 0; text-align: left; background: none; border: none;
    }
    .avatar {
      width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: var(--fond);
      flex-shrink: 0;
    }
    .avatar.silhouette {
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-titres), sans-serif; font-weight: 700; font-size: 1.125rem; color: var(--craie);
    }
    .identite { display: flex; align-items: center; gap: var(--pas); flex-wrap: wrap; min-width: 0; }
    .nom { font-weight: 700; }
    .niveau {
      border: 1px solid var(--trait); border-radius: var(--r-s); padding: 0 8px;
      font-size: .8125rem; font-weight: 700; color: var(--craie);
    }
    .etat-mini {
      display: none; /* superflu sur grand écran : les boutons montrent déjà l'état actif */
      font-size: .8125rem; font-weight: 700; padding: 0 8px; border-radius: var(--r-s);
    }

    /* Les quatre choix sur une seule ligne, à largeur égale, sous l'identité. */
    .choix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
    .choix .etat { min-width: 0; padding: 8px 4px; }
    .etat {
      min-height: 44px; min-width: 72px; padding: 8px 12px;
      border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--carte);
      color: var(--encre); font-weight: 600;
    }
    .etat.present.actif, .etat-mini.present { background: var(--acquis); border-color: var(--acquis); color: #fff; }
    /* Le pointillé dit « gardé sur l'appareil, pas encore chez le serveur », comme dans la grille. */
    .etat.differe, .etat-mini.differe { border: 1px dashed #fff; outline: 2px dashed var(--acquis); outline-offset: 1px; }
    .etat:disabled { opacity: .6; cursor: not-allowed; }

    .enregistrement {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--profond); font-size: .875rem; font-weight: 700;
    }
    .chargeur {
      display: inline-block; width: 1em; height: 1em;
      border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
      animation: tourner .8s linear infinite;
    }
    @keyframes tourner { to { transform: rotate(360deg); } }

    .barre-choix {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
      padding: var(--pas-2) var(--pas-3) calc(var(--pas-2) + env(safe-area-inset-bottom, 0px));
      background: var(--carte); border-top: 1px solid var(--trait);
      box-shadow: 0 -6px 16px rgba(0,0,0,.15);
    }
    .barre-choix p { margin: 0 0 var(--pas); }
    .choix-rapide { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .choix-rapide .etat { flex: 1 1 72px; }

    /*
     * Sur téléphone : la carte devient compacte (avatar + nom + état), sans
     * les boutons de choix qui ne tiendraient pas à plusieurs par ligne.
     * Toucher la carte ouvre la barre de choix en bas d'écran à la place.
     */
    @media (max-width: 600px) {
      .eleves { grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
      .eleves li { flex-direction: column; padding: var(--pas); gap: 4px; }
      .zone-identite { flex-direction: column; text-align: center; gap: 4px; }
      .avatar { width: 56px; height: 56px; }
      .avatar.silhouette { font-size: 1.125rem; }
      .identite { flex-direction: column; gap: 2px; }
      .etat-mini { display: inline-block; }
      .choix { display: none; }
      .recherche { max-width: none; }
    }
  `]
})
export class PresencesComponent implements OnDestroy {
  private api = inject(ApiService);
  reseau = inject(ReseauService);
  private file = inject(FileEcrituresService);

  /** Élèves de la séance affichée dont le dernier choix n'est pas encore parti. */
  enAttente = computed(() => {
    const seanceId = this.seanceId();
    return new Set(seanceId ? this.file.pourSeance(seanceId, 'presence').map(p => p.cursusId) : []);
  });

  readonly choix = CHOIX;
  readonly niveaux: Niveau[] = ['TOUS', 'N1', 'N2', 'N3'];
  readonly libellePreparation = libellePreparation;
  readonly cleDe = cleDe;

  /** La saisie correspond-elle à un bouton affiché ? Sinon (plongée, excusé...), on l'indique en texte. */
  choixConnu(l: LignePresence): boolean {
    const cle = cleDe(l);
    return cle === null || CHOIX.some(c => c.cle === cle);
  }

  choixActuel(l: LignePresence): Choix | null {
    if (!this.choixConnu(l)) return null;
    const cle = cleDe(l);
    return CHOIX.find(c => c.cle === cle) ?? null;
  }

  libelleAncien(l: LignePresence): string {
    if (l.statut === 'ABSENT') return 'Absent';
    if (l.statut === 'EXCUSE') return 'Excusé';
    if (l.atelier === 'PLONGEE') return 'Présent, plongée';
    return 'Présent, atelier non précisé';
  }

  seances = signal<SeanceVue[]>([]);
  seanceId = signal<number | null>(null);

  lignes = signal<LignePresence[]>([]);
  chargement = signal(false);
  message = signal<string | null>(null);
  enregistrements = signal<Set<number>>(new Set());

  niveau = signal<Niveau>('TOUS');
  rechercheEleve = signal('');

  /** Élève dont la carte a été touchée sur téléphone : barre de choix ouverte en bas d'écran. */
  ligneSelectionnee = signal<LignePresence | null>(null);

  private urlsPhotos = signal<Map<number, string>>(new Map());

  /** On ne remplit pas une séance à venir : le serveur la refuserait. */
  seancesPassees = computed(() => {
    const aujourdhui = dateDuJour();
    return this.seances().filter(s => s.date <= aujourdhui);
  });

  seanceChoisie = computed(() => this.seances().find(s => s.id === this.seanceId()) ?? null);

  readonly aujourdhui = dateDuJour();
  private dialogueSeance = viewChild.required<ElementRef<HTMLDialogElement>>('dialogueSeance');
  dialogueSeanceOuvert = signal(false);
  /** Jour touché dans le calendrier du dialogue. */
  jourDialogue = signal<string | null>(null);

  lignesFiltrees = computed(() => {
    const niveau = this.niveau();
    const recherche = normaliser(this.rechercheEleve());
    return this.lignes().filter(l =>
      (niveau === 'TOUS' || l.niveau === niveau)
      && (!recherche || normaliser(l.eleve).includes(recherche)));
  });

  bilan = computed(() => {
    const lignes = this.lignes();
    return {
      presents: lignes.filter(l => l.statut === 'PRESENT').length,
      absents: lignes.filter(l => l.statut !== 'PRESENT').length,
      enAttente: this.enAttente().size
    };
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    try {
      this.seances.set(await this.api.seances());
      // Par défaut : la dernière séance passée ou du jour.
      const derniere = this.seancesPassees().at(-1);
      if (derniere) this.choisirSeance(derniere);
    } catch {
      this.message.set('Impossible de charger les séances.');
    }
  }

  libelleSeance(s: SeanceVue): string {
    const memeJour = this.seances().filter(x => x.date === s.date).length > 1;
    return `${dateFr(s.date)}${memeJour ? ' (séance ' + s.ordre + ')' : ''} — ${s.lieu ?? 'lieu non précisé'}`;
  }

  ouvrirDialogueSeance(): void {
    // Le calendrier s'ouvre sur le mois de la séance en cours.
    this.jourDialogue.set(this.seanceChoisie()?.date ?? this.aujourdhui);
    this.dialogueSeanceOuvert.set(true);
    this.dialogueSeance().nativeElement.showModal();
  }

  fermerDialogueSeance(): void {
    this.dialogueSeance().nativeElement.close();
  }

  seancesDuJour(jour: string): SeanceVue[] {
    return this.seancesPassees().filter(s => s.date === jour);
  }

  /** Un seul choix possible ce jour-là : on le prend tout de suite, sans second toucher. */
  toucherJour(jour: string | null): void {
    this.jourDialogue.set(jour);
    const duJour = jour ? this.seancesDuJour(jour) : [];
    if (duJour.length === 1) this.choisirDepuisDialogue(duJour[0]);
  }

  choisirDepuisDialogue(s: SeanceVue): void {
    this.choisirSeance(s);
    this.fermerDialogueSeance();
  }

  choisirSeance(s: SeanceVue): void {
    if (this.seanceId() === s.id) return;
    this.seanceId.set(s.id);
    void this.chargerFeuille(s.id);
  }

  private async chargerFeuille(seanceId: number): Promise<void> {
    this.chargement.set(true);
    this.message.set(null);
    try {
      const feuille = await this.api.feuillePresence(seanceId);
      // Une autre séance a pu être choisie pendant le chargement.
      if (this.seanceId() === seanceId) {
        // Les choix pas encore partis priment sur ce que le serveur (ou le cache) connaît.
        const enAttente = new Map(this.file.pourSeance(seanceId, 'presence').map(p => [p.cursusId, p]));
        const lignes = feuille.eleves.map(l => {
          const p = enAttente.get(l.cursusId);
          return p ? { ...l, statut: p.statut, atelier: p.atelier } : l;
        });
        this.lignes.set(lignes);
        this.chargerPhotosManquantes(lignes);
      }
    } catch (e) {
      this.lignes.set([]);
      this.message.set(!this.reseau.enLigne()
        ? "Cette feuille n'est pas disponible hors ligne. Utilisez « Préparer hors ligne » avec du réseau, "
          + 'avant de partir, pour l\'embarquer.'
        : (e as HttpErrorResponse).error?.detail ?? 'Impossible de charger la feuille de présence.');
    } finally {
      this.chargement.set(false);
    }
  }

  private chargerPhotosManquantes(lignes: LignePresence[]): void {
    const deja = this.urlsPhotos();
    for (const l of lignes) {
      if (l.aPhoto && !deja.has(l.eleveId)) this.chargerPhoto(l.eleveId);
    }
  }

  private chargerPhoto(eleveId: number): void {
    this.api.photoEleve(eleveId).subscribe({
      next: blob => {
        const copie = new Map(this.urlsPhotos());
        copie.set(eleveId, URL.createObjectURL(blob));
        this.urlsPhotos.set(copie);
      },
      error: () => { /* pas de photo consultable : la silhouette reste affichée */ }
    });
  }

  urlPhoto(eleveId: number): string | null {
    return this.urlsPhotos().get(eleveId) ?? null;
  }

  initiales(nom: string): string {
    return nom.split(' ').filter(Boolean).map(m => m[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Sur téléphone (voir le média-query 600px), la carte n'affiche plus les boutons : la toucher ouvre la barre du bas. */
  ouvrirChoixMobile(l: LignePresence): void {
    if (window.innerWidth > 600) return;
    if (this.enregistrements().has(l.cursusId)) return;
    this.ligneSelectionnee.set(l);
  }

  async choisirEtFermer(ligne: LignePresence, c: Choix): Promise<void> {
    this.ligneSelectionnee.set(null);
    await this.choisir(ligne, c);
  }

  /** Enregistre le choix ; toucher de nouveau le choix actif l'efface. */
  async choisir(ligne: LignePresence, c: Choix): Promise<void> {
    const seanceId = this.seanceId();
    if (!seanceId) return;
    const effacer = cleDe(ligne) === c.cle;
    const avant = { statut: ligne.statut, atelier: ligne.atelier };

    const apres = effacer ? { statut: null, atelier: null } : { statut: c.statut, atelier: c.atelier };
    this.remplacer(ligne.cursusId, apres);
    this.marquer(ligne.cursusId, true);
    this.message.set(null);
    try {
      const seance = this.seances().find(s => s.id === seanceId);
      const issue = await this.file.enregistrer(
        { type: 'presence', seanceId, cursusId: ligne.cursusId, ...apres },
        `Présence de ${ligne.eleve}`, seance?.date ?? dateDuJour());
      if (issue.etat === 'refusee') {
        this.remplacer(ligne.cursusId, avant);
        this.message.set(issue.raison);
      }
    } catch {
      // Écriture sur l'appareil impossible (stockage plein, navigation privée…).
      this.remplacer(ligne.cursusId, avant);
      this.message.set(`La présence de ${ligne.eleve} n'a pas pu être enregistrée.`);
    } finally {
      this.marquer(ligne.cursusId, false);
    }
  }

  private remplacer(cursusId: number, valeur: Pick<LignePresence, 'statut' | 'atelier'>): void {
    this.lignes.set(this.lignes().map(l => l.cursusId === cursusId ? { ...l, ...valeur } : l));
  }

  private marquer(cursusId: number, enCours: boolean): void {
    const suivant = new Set(this.enregistrements());
    if (enCours) suivant.add(cursusId); else suivant.delete(cursusId);
    this.enregistrements.set(suivant);
  }

  ngOnDestroy(): void {
    for (const url of this.urlsPhotos().values()) URL.revokeObjectURL(url);
  }
}
