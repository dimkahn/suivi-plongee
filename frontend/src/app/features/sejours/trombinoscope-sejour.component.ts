import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AvatarComponent } from '../../core/avatar.component';
import { OngletsComponent } from '../../core/onglets.component';
import { ReseauService } from '../../core/reseau.service';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { SejourApi } from './sejour-api';
import { LigneTrombinoscopeSejour, duGroupe, filtresGroupes } from './trombinoscope-sejour';

/**
 * Le trombinoscope d'un séjour, ouvert par un encadrant depuis l'onglet
 * « Participants » : les visages, filtrés par groupe de plongeurs. Photo
 * reprise du dossier élève ou du compte d'encadrant, jamais sans le droit à
 * l'image (vérifié par le serveur) ; sinon les initiales. Un organisateur
 * ajoute ici la photo d'un invité (ni dossier ni compte), avec son accord ;
 * elle est effacée après le séjour. Réseau obligatoire : les photos ne
 * sont pas gardées sur le téléphone.
 */
@Component({
  selector: 'app-trombinoscope-sejour',
  imports: [FormsModule, AvatarComponent, OngletsComponent, RecadragePhotoComponent],
  template: `
    @if (lignes() === null) {
      <p class="vide">Chargement…</p>
    } @else if (erreur()) {
      <p class="vide">{{ erreur() }}</p>
    } @else if (lignes()!.length === 0) {
      <p class="vide">Personne d'inscrit pour l'instant.</p>
    } @else {
      @if (filtres().length > 2) {
        <app-onglets class="filtres-groupes" [options]="filtres()" [choisi]="filtre()" [boutons]="true"
                     libelle="Filtrer par groupe de plongeurs" (choisir)="filtre.set($event)" />
      }
      <p class="secondaire">{{ affichees().length }} personne{{ affichees().length > 1 ? 's' : '' }}.
        Sans photo si le droit à l'image n'a pas été recueilli.</p>

      @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }

      @if (choisi(); as c) {
        <!-- La photo d'un invité : seulement avec son accord (règle du club pour les photos de personnes). -->
        <section class="carte ajout-photo" aria-label="Ajouter une photo">
          <h3>Photo de {{ c.prenom }} {{ c.nom }}</h3>
          <label class="case">
            <input type="checkbox" [(ngModel)]="accord" name="accordPhotoInvite">
            {{ c.prenom }} (ou son responsable légal s'il est mineur) accepte que sa photo figure dans le
            trombinoscope du séjour, vu des seuls encadrants et effacé après le séjour.
          </label>
          <div class="choix-photo">
            <!-- « capture » ouvre directement l'appareil photo ; sans lui, la galerie du téléphone. -->
            <label class="bouton-discret upload" [class.inactif]="!accord || envoi()">
              📷 Prendre une photo
              <input type="file" accept="image/*" capture="environment" hidden [disabled]="!accord || envoi()"
                     (change)="choisirPhoto($event, c)">
            </label>
            <label class="bouton-discret upload" [class.inactif]="!accord || envoi()">
              🖼️ Choisir dans mes photos
              <input type="file" accept="image/*" hidden [disabled]="!accord || envoi()" (change)="choisirPhoto($event, c)">
            </label>
            <button type="button" class="bouton-discret" (click)="choisi.set(null)">Annuler</button>
          </div>
          @if (envoi()) { <p class="secondaire">Envoi…</p> }
        </section>
      }

      <!-- Même recadrage que le trombinoscope du club ; dans le contenu du dialogue, qui rend le reste inerte. -->
      @if (recadrage(); as r) {
        <app-recadrage-photo [fichier]="r.fichier" [titre]="'Recadrer la photo de ' + r.ligne.prenom + ' ' + r.ligne.nom"
                             [enCours]="envoi()" (valide)="deposer(r.ligne, $event)"
                             (annule)="recadrage.set(null)" (illisible)="imageIllisible()" />
      }

      <ul class="grille">
        @for (l of affichees(); track l.participantId) {
          <li class="fiche">
            <app-avatar [url]="urls().get(l.participantId) ?? null" [nom]="{ prenom: l.prenom, nom: l.nom }"
                        [alt]="l.prenom + ' ' + l.nom" [libelleInitiales]="l.prenom + ' ' + l.nom" />
            <span class="nom">{{ l.prenom }} {{ l.nom }}</span>
            <span class="secondaire">{{ l.aptitude ?? (l.plongeur ? 'Plongeur' : 'Accompagnant') }}</span>
            @if (l.groupe && filtre() === '') { <span class="secondaire">{{ l.groupe }}</span> }
            @if (gere() && l.invite) {
              @if (l.aPhoto) {
                <button type="button" class="bouton-lien retirer-photo" (click)="retirer(l)" [disabled]="envoi()"
                        [attr.aria-label]="'Retirer la photo de ' + l.prenom + ' ' + l.nom">Retirer la photo</button>
              } @else {
                <button type="button" class="bouton-lien ajouter-photo" (click)="ouvrirAjout(l)"
                        [attr.aria-label]="'Ajouter une photo de ' + l.prenom + ' ' + l.nom">Ajouter une photo</button>
              }
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .filtres-groupes { margin-top: 0; }
    .grille { list-style: none; padding: 0; margin: var(--pas-2) 0 0;
              display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--pas-2); }
    .fiche { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
    app-avatar { --taille-avatar: 96px; }
    .nom { font-weight: 700; margin-top: 4px; }
    .fiche .bouton-lien { min-height: 44px; }
    .ajout-photo { display: grid; gap: var(--pas); margin: var(--pas-2) 0; }
    .ajout-photo h3 { margin: 0; }
    .case { display: flex; align-items: flex-start; gap: var(--pas); min-height: 44px; }
    .case input { width: auto; flex: none; margin-top: 4px; }
    .choix-photo { display: flex; flex-wrap: wrap; gap: var(--pas); }
    .upload { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; cursor: pointer;
              border: 1px solid var(--trait); border-radius: var(--r-s); }
    .upload.inactif { opacity: .5; cursor: not-allowed; }
  `]
})
export class TrombinoscopeSejourComponent implements OnInit, OnDestroy {
  private api = inject(SejourApi);
  private reseau = inject(ReseauService);

  readonly sejourId = input.required<number>();
  /** Organisateur du séjour : il ajoute et retire la photo d'un invité (le serveur revérifie). */
  readonly gere = input(false);

  lignes = signal<LigneTrombinoscopeSejour[] | null>(null);
  erreur = signal<string | null>(null);
  /** Le groupe choisi ('' : tous). */
  filtre = signal('');
  /** Les photos chargées, par participant (adresses blob:, libérées à la fermeture). */
  urls = signal<Map<number, string>>(new Map());

  /** L'invité dont on ajoute la photo. */
  choisi = signal<LigneTrombinoscopeSejour | null>(null);
  accord = false;
  envoi = signal(false);
  message = signal<string | null>(null);
  /** La photo choisie, en cours de recadrage avant l'envoi. */
  recadrage = signal<{ ligne: LigneTrombinoscopeSejour; fichier: File } | null>(null);

  filtres = computed(() => filtresGroupes(this.lignes() ?? []));
  affichees = computed(() => duGroupe(this.lignes() ?? [], this.filtre()));

  async ngOnInit(): Promise<void> {
    try {
      const lignes = await firstValueFrom(this.api.trombinoscope(this.sejourId()));
      this.lignes.set(lignes);
      for (const l of lignes) if (l.aPhoto) this.chargerPhoto(l.participantId);
    } catch {
      this.erreur.set(this.reseau.enLigne()
        ? 'Impossible de charger le trombinoscope.'
        : 'Le trombinoscope a besoin du réseau : réessayez quand vous en aurez.');
      this.lignes.set([]);
    }
  }

  private chargerPhoto(participantId: number): void {
    firstValueFrom(this.api.photoParticipant(this.sejourId(), participantId)).then(
      blob => this.remplacerUrl(participantId, URL.createObjectURL(blob)),
      () => { /* pas de photo consultable : les initiales restent */ }
    );
  }

  private remplacerUrl(participantId: number, url: string | null): void {
    this.urls.update(m => {
      const copie = new Map(m);
      const ancienne = copie.get(participantId);
      if (ancienne) URL.revokeObjectURL(ancienne);
      if (url) copie.set(participantId, url); else copie.delete(participantId);
      return copie;
    });
  }

  private majLigne(participantId: number, aPhoto: boolean): void {
    this.lignes.update(ls => (ls ?? []).map(l => l.participantId === participantId ? { ...l, aPhoto } : l));
  }

  ouvrirAjout(l: LigneTrombinoscopeSejour): void {
    this.accord = false;
    this.message.set(null);
    this.choisi.set(l);
  }

  /** Ouvre le recadrage ; la photo n'est envoyée qu'une fois validée, comme dans le trombinoscope du club. */
  choisirPhoto(evenement: Event, l: LigneTrombinoscopeSejour): void {
    const entree = evenement.target as HTMLInputElement;
    const fichier = entree.files?.[0];
    entree.value = '';
    if (!fichier || !this.accord) return;
    this.message.set(null);
    this.recadrage.set({ ligne: l, fichier });
  }

  imageIllisible(): void {
    this.recadrage.set(null);
    this.message.set("Cette image n'a pas pu être lue.");
  }

  /** La photo recadrée (carrée, 480 px, 300 Ko au plus, par le recadrage du club). */
  async deposer(l: LigneTrombinoscopeSejour, fichier: File): Promise<void> {
    this.envoi.set(true);
    this.message.set(null);
    try {
      await firstValueFrom(this.api.deposerPhotoInvite(this.sejourId(), l.participantId, fichier));
      this.majLigne(l.participantId, true);
      this.chargerPhoto(l.participantId);
      this.choisi.set(null);
    } catch (e) {
      this.message.set(this.detail(e, "La photo n'a pas pu être ajoutée."));
    } finally {
      this.recadrage.set(null);
      this.envoi.set(false);
    }
  }

  async retirer(l: LigneTrombinoscopeSejour): Promise<void> {
    this.envoi.set(true);
    this.message.set(null);
    try {
      await firstValueFrom(this.api.retirerPhotoInvite(this.sejourId(), l.participantId));
      this.majLigne(l.participantId, false);
      this.remplacerUrl(l.participantId, null);
    } catch (e) {
      this.message.set(this.detail(e, "La photo n'a pas pu être retirée."));
    } finally {
      this.envoi.set(false);
    }
  }

  private detail(e: unknown, defaut: string): string {
    if (e instanceof HttpErrorResponse && e.error?.detail) return e.error.detail;
    if (!this.reseau.enLigne()) return 'Pas de réseau : réessayez plus tard.';
    return e instanceof Error && !(e instanceof HttpErrorResponse) ? "Cette image n'a pas pu être lue." : defaut;
  }

  ngOnDestroy(): void {
    for (const url of this.urls().values()) URL.revokeObjectURL(url);
  }
}
