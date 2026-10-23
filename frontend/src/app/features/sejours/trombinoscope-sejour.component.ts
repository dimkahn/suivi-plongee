import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AvatarComponent } from '../../core/avatar.component';
import { DialogueComponent } from '../../core/dialogue.component';
import { OngletsComponent } from '../../core/onglets.component';
import { ReseauService } from '../../core/reseau.service';
import { RecadragePhotoComponent } from '../../core/recadrage-photo.component';
import { ExportTrombinoscopeComponent, PersonneExport } from '../../core/export-trombinoscope.component';
import { LigneTrombinoscopeSejour, PortTrombinoscope, duGroupe, filtresGroupes, titreImage } from './trombinoscope-sejour';

/** Ce que l'organisateur confirme : ajouter la photo d'un invité, ou montrer une photo aux participants. */
type Demande = { sorte: 'PHOTO' | 'VISIBLE'; ligne: LigneTrombinoscopeSejour };

/**
 * Le trombinoscope d'un séjour, pour tous ses participants (dans l'appli et
 * par la page du lien) : les visages, filtrés par groupe de plongeurs. Le
 * serveur filtre : un encadrant voit toutes les photos consenties (dossier
 * élève, compte d'encadrant, photo d'invité), un participant les seules
 * qu'un organisateur a rendues visibles avec l'accord de la personne ;
 * sinon les initiales. Un organisateur ajoute ici la photo d'un invité et
 * choisit les photos montrées aux participants. Réseau obligatoire : les
 * photos ne sont pas gardées sur le téléphone.
 */
@Component({
  selector: 'app-trombinoscope-sejour',
  imports: [FormsModule, AvatarComponent, DialogueComponent, OngletsComponent, RecadragePhotoComponent,
            ExportTrombinoscopeComponent],
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
        @if (vueParticipant()) {
          Une photo n'est montrée aux participants qu'avec l'accord de la personne : sinon, ses initiales.
        } @else {
          Sans photo si le droit à l'image n'a pas été recueilli.
          @if (gere()) { « Visible des participants » : les autres participants la voient aussi. }
        }
      </p>

      <!-- Export réservé aux organisateurs : ils recueillent les accords des photos du séjour. -->
      @if (gere()) {
        <div class="barre-export">
          <button type="button" class="bouton-discret exporter-image" (click)="exportOuvert.set(true)">Exporter en image</button>
        </div>
        <app-export-trombinoscope [ouvert]="exportOuvert()" [personnes]="personnesExport()"
                                  [titreInitial]="titreExport()" (fermer)="exportOuvert.set(false)" />
      }

      @if (message() && !demande()) { <div class="alerte" role="status">{{ message() }}</div> }

      <!-- L'accord de la personne, confirmé par l'organisateur (règle du club pour les photos de personnes).
           Une fenêtre par-dessus le trombinoscope : visible sans défiler, quelle que soit la carte touchée. -->
      <app-dialogue [ouvert]="!!demande()" [erreur]="message()" (fermer)="fermerDemande()"
                    [titre]="titreDemande()">
        @if (demande(); as d) {
          <div class="ajout-photo">
            <label class="case">
              <input type="checkbox" [(ngModel)]="accord" name="accordPhotoSejour">
              {{ d.ligne.prenom }} (ou son responsable légal s'il est mineur) accepte que sa photo figure dans le
              trombinoscope du séjour, vu des encadrants et des autres participants, et effacé de ce trombinoscope après le séjour.
            </label>
            <div class="actions-dialogue choix-photo">
              @if (d.sorte === 'PHOTO') {
                <!-- « capture » ouvre directement l'appareil photo ; sans lui, la galerie du téléphone. -->
                <label class="bouton-discret upload" [class.inactif]="!accord || envoi()">
                  📷 Prendre une photo
                  <input type="file" accept="image/*" capture="environment" hidden [disabled]="!accord || envoi()"
                         (change)="choisirPhoto($event, d.ligne)">
                </label>
                <label class="bouton-discret upload" [class.inactif]="!accord || envoi()">
                  🖼️ Choisir dans mes photos
                  <input type="file" accept="image/*" hidden [disabled]="!accord || envoi()" (change)="choisirPhoto($event, d.ligne)">
                </label>
              } @else {
                <button type="button" class="bouton-principal" [disabled]="!accord || envoi()"
                        (click)="rendreVisible(d.ligne, true)">Montrer aux participants</button>
              }
              <button type="button" class="bouton-discret" (click)="fermerDemande()">Annuler</button>
            </div>
            @if (envoi()) { <p class="secondaire">Envoi…</p> }
          </div>

          <!-- Même recadrage que le trombinoscope du club ; dans le contenu du dialogue, qui rend le reste inerte. -->
          @if (recadrage(); as r) {
            <app-recadrage-photo [fichier]="r.fichier" [titre]="'Recadrer la photo de ' + r.ligne.prenom + ' ' + r.ligne.nom"
                                 [enCours]="envoi()" (valide)="deposer(r.ligne, $event)"
                                 (annule)="recadrage.set(null)" (illisible)="imageIllisible()" />
          }
        }
      </app-dialogue>

      <ul class="grille">
        @for (l of affichees(); track l.participantId) {
          <li class="fiche">
            <app-avatar [url]="urls().get(l.participantId) ?? null" [nom]="{ prenom: l.prenom, nom: l.nom }"
                        [alt]="l.prenom + ' ' + l.nom" [libelleInitiales]="l.prenom + ' ' + l.nom" />
            <span class="nom">{{ l.prenom }} {{ l.nom }}</span>
            <span class="secondaire">{{ sousTitre(l) }}</span>
            @if (l.groupe && filtre() === '') { <span class="secondaire">{{ l.groupe }}</span> }
            @if (gere()) {
              @if (l.aPhoto) {
                @if (l.visibleParticipants) {
                  <span class="etiquette-etat ok">Visible des participants</span>
                  <button type="button" class="bouton-lien cacher-photo" (click)="rendreVisible(l, false)" [disabled]="envoi()"
                          [attr.aria-label]="'Ne plus montrer aux participants la photo de ' + l.prenom + ' ' + l.nom">
                    Ne plus la montrer</button>
                } @else {
                  <button type="button" class="bouton-lien montrer-photo" (click)="ouvrir('VISIBLE', l)"
                          [attr.aria-label]="'Montrer aux participants la photo de ' + l.prenom + ' ' + l.nom">
                    Montrer aux participants</button>
                }
              }
              @if (l.invite) {
                @if (l.aPhoto) {
                  <button type="button" class="bouton-lien retirer-photo" (click)="retirer(l)" [disabled]="envoi()"
                          [attr.aria-label]="'Retirer la photo de ' + l.prenom + ' ' + l.nom">Retirer la photo</button>
                } @else {
                  <button type="button" class="bouton-lien ajouter-photo" (click)="ouvrir('PHOTO', l)"
                          [attr.aria-label]="'Ajouter une photo de ' + l.prenom + ' ' + l.nom">Ajouter une photo</button>
                }
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
    .barre-export { margin-top: var(--pas); }
    .case { display: flex; align-items: flex-start; gap: var(--pas); min-height: 44px; }
    .case input { width: auto; flex: none; margin-top: 4px; }
    .upload { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; cursor: pointer;
              border: 1px solid var(--trait); border-radius: var(--r-s); }
    .upload.inactif { opacity: .5; cursor: not-allowed; }
  `]
})
export class TrombinoscopeSejourComponent implements OnInit, OnDestroy {
  private reseau = inject(ReseauService);

  readonly port = input.required<PortTrombinoscope>();
  /** Organisateur du séjour : photo des invités, photos montrées aux participants (le serveur revérifie). */
  readonly gere = input(false);
  /** Lu par un participant (ou « comme un participant ») : seulement les photos qu'on lui a rendues visibles. */
  readonly vueParticipant = input(false);
  /** Le nom du séjour, proposé comme titre de l'image exportée. */
  readonly nomSejour = input('');

  lignes = signal<LigneTrombinoscopeSejour[] | null>(null);
  erreur = signal<string | null>(null);
  /** Le groupe choisi ('' : tous). */
  filtre = signal('');
  /** Les photos chargées, par participant (adresses blob:, libérées à la fermeture). */
  urls = signal<Map<number, string>>(new Map());

  /** L'accord en cours de confirmation par l'organisateur. */
  demande = signal<Demande | null>(null);
  accord = false;
  envoi = signal(false);
  message = signal<string | null>(null);
  /** La photo choisie, en cours de recadrage avant l'envoi. */
  recadrage = signal<{ ligne: LigneTrombinoscopeSejour; fichier: File } | null>(null);

  filtres = computed(() => filtresGroupes(this.lignes() ?? []));
  affichees = computed(() => duGroupe(this.lignes() ?? [], this.filtre()));
  exportOuvert = signal(false);
  /** Export en image : les cartes affichées (groupe choisi), dans l'ordre de l'écran, avec les photos chargées. */
  personnesExport = computed<PersonneExport[]>(() => this.affichees().map(l => ({
    id: l.participantId, nom: `${l.prenom} ${l.nom}`, sousTitre: this.sousTitre(l),
    photo: this.urls().get(l.participantId) ?? null
  })));
  titreExport = computed(() => titreImage(this.nomSejour() || 'Séjour', this.filtre()));

  titreDemande = computed(() => {
    const d = this.demande();
    if (!d) return '';
    return `${d.sorte === 'PHOTO' ? 'Photo de' : 'Montrer aux participants la photo de'} ${d.ligne.prenom} ${d.ligne.nom}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      const lignes = await firstValueFrom(this.port().lister());
      this.lignes.set(lignes);
      for (const l of lignes) if (l.aPhoto) this.chargerPhoto(l.participantId);
    } catch {
      this.erreur.set(this.reseau.enLigne()
        ? 'Impossible de charger le trombinoscope.'
        : 'Le trombinoscope a besoin du réseau : réessayez quand vous en aurez.');
      this.lignes.set([]);
    }
  }

  sousTitre(l: LigneTrombinoscopeSejour): string {
    return l.aptitude ?? (l.plongeur ? 'Plongeur' : 'Accompagnant');
  }

  private chargerPhoto(participantId: number): void {
    firstValueFrom(this.port().photo(participantId)).then(
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

  private majLigne(participantId: number, maj: Partial<LigneTrombinoscopeSejour>): void {
    this.lignes.update(ls => (ls ?? []).map(l => l.participantId === participantId ? { ...l, ...maj } : l));
  }

  ouvrir(sorte: Demande['sorte'], ligne: LigneTrombinoscopeSejour): void {
    this.accord = false;
    this.message.set(null);
    this.demande.set({ sorte, ligne });
  }

  /** Annuler, la croix ou Échap : l'erreur affichée dans la fenêtre part avec elle. */
  fermerDemande(): void {
    this.demande.set(null);
    this.recadrage.set(null);
    this.message.set(null);
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
    const deposer = this.port().deposerPhotoInvite;
    if (!deposer) return;
    await this.ecrire(async () => {
      await firstValueFrom(deposer(l.participantId, fichier, this.accord));
      // L'accord d'un invité vaut aussi pour les participants (le serveur le note).
      this.majLigne(l.participantId, { aPhoto: true, visibleParticipants: true });
      this.chargerPhoto(l.participantId);
      this.demande.set(null);
    }, "La photo n'a pas pu être ajoutée.");
    this.recadrage.set(null);
  }

  async retirer(l: LigneTrombinoscopeSejour): Promise<void> {
    const retirer = this.port().retirerPhotoInvite;
    if (!retirer) return;
    await this.ecrire(async () => {
      await firstValueFrom(retirer(l.participantId));
      this.majLigne(l.participantId, { aPhoto: false, visibleParticipants: false });
      this.remplacerUrl(l.participantId, null);
    }, "La photo n'a pas pu être retirée.");
  }

  async rendreVisible(l: LigneTrombinoscopeSejour, visible: boolean): Promise<void> {
    const rendre = this.port().rendreVisible;
    if (!rendre || (visible && !this.accord)) return;
    await this.ecrire(async () => {
      await firstValueFrom(rendre(l.participantId, visible, visible && this.accord));
      this.majLigne(l.participantId, { visibleParticipants: visible });
      this.demande.set(null);
    }, "Le choix n'a pas pu être enregistré.");
  }

  private async ecrire(action: () => Promise<void>, defaut: string): Promise<void> {
    this.envoi.set(true);
    this.message.set(null);
    try {
      await action();
    } catch (e) {
      this.message.set(e instanceof HttpErrorResponse && e.error?.detail ? e.error.detail
        : this.reseau.enLigne() ? defaut : 'Pas de réseau : réessayez plus tard.');
    } finally {
      this.envoi.set(false);
    }
  }

  ngOnDestroy(): void {
    for (const url of this.urls().values()) URL.revokeObjectURL(url);
  }
}
