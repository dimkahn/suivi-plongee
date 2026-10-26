import { Component, ChangeDetectionStrategy, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, map, tap, throwError } from 'rxjs';
import { MAGASIN_CACHE, ecrire, lire, supprimer } from '../../core/base-locale';
import { periode } from '../../core/date-fr';
import { OngletsComponent, OptionOnglet } from '../../core/onglets.component';
import { SejourFraisComponent } from './sejour-frais.component';
import { MesInformationsComponent } from './mes-informations.component';
import { SeanceSortieVue } from '../../core/modeles';
import { JourneeSejourComponent } from './journee-sejour.component';
import { CarnetSejourComponent } from './carnet-sejour.component';
import { CarnetImprimableComponent } from './carnet-imprimable.component';
import { programmeParJour } from './programme-du-jour';
import {
  AffaireVue, DemandeMesInformations, EvenementVue, FraisVue, JourneeVue, LecturePhotoJournee, NoteLue, PalanqueeVue, ParticipantFrais, ParticipantVue,
  PortAttestationAssurance, PortCartesEmbarquement, PortFrais, RegleLecture,
  PortPrets, PretsSejourVue, SejourVue, euros, formulairePhoto, remboursementsDe
} from './sejour-api';
import { SejourMaterielComponent } from './sejour-materiel.component';
import { PretsDuSejour } from './materiel-sejour';
import { cleJetonLienSejour, cleLienSejour, lectureEchouee } from './sejour-hors-ligne';
import { oublierSejour, retenirSejour, sejourRetenu, ticketQrCode } from './sejour-courant';
import { SwPush } from '@angular/service-worker';
import { NotificationsDuSejour } from './notifications-du-sejour';
import { NotificationsSejourComponent } from './notifications-sejour.component';
import { TrombinoscopeSejourComponent } from './trombinoscope-sejour.component';
import { LigneTrombinoscopeSejour, PortTrombinoscope } from './trombinoscope-sejour';
import { SejourRestaurantComponent } from './sejour-restaurant.component';
import { MenusVue, PortMenus } from './menus-restaurant';

type Onglet = 'carnet' | 'infos' | 'frais' | 'materiel' | 'restaurant' | 'trombinoscope';

interface EnteteVue {
  nom: string;
  lieu: string | null;
  dateDebut: string;
  dateFin: string;
}

interface FraisPublicVue {
  sejour: EnteteVue;
  moi: ParticipantFrais;
  participants: ParticipantFrais[];
  frais: FraisVue;
}

interface MesInformationsVue {
  sejour: EnteteVue;
  moi: ParticipantVue;
  /** Pour l'encart « Aujourd'hui ». */
  programme: { evenements: EvenementVue[]; plongees: SeanceSortieVue[]; affaires: AffaireVue[]; palanquees: PalanqueeVue[];
               journees?: JourneeVue[] };
}

/** Le jeton du lien, gardé sur l'appareil (IndexedDB, comme le reste : pas de localStorage). */
interface JetonGarde {
  cle: string;
  valeur: string;
}

/** Le carnet gardé sur l'appareil pour le lire sans réseau ; effacé par « Se déconnecter » ou un jeton refusé. */
interface CopieLien {
  cle: string;
  valeur: { entete: EnteteVue; frais: FraisPublicVue; infos: MesInformationsVue; carnet: SejourVue };
}

/**
 * Le séjour pour un participant qui n'est pas moniteur, à l'adresse reçue
 * par e-mail (/sejour/…, et l'ancienne /frais/… qui ouvre les frais) : il
 * donne son e-mail, reçoit un code à 6 chiffres, puis lit le carnet du
 * séjour, toujours à jour (programme, voitures, chambres, affaires, infos
 * pratiques), renseigne ses informations (voyage, repas, personne à prévenir), voit et saisit les
 * frais (ce qu'il a payé), déclare le matériel du club qu'il a emprunté et voit le
 * trombinoscope (les seules photos rendues visibles aux participants). Pendant le séjour, l'encart
 * « Aujourd'hui » : son voyage du jour, le programme, le rappel de la veille. Sans connexion à l'appli ; le
 * jeton reste sur l'appareil jusqu'à « Se déconnecter » ou 60 jours après
 * le séjour. Le QR code montré par l'organisateur (`#qr=…`, une minute)
 * connecte sans e-mail ni code, jusqu'à un mois après le séjour.
 */
@Component({
  selector: 'app-espace-participant',
  imports: [FormsModule, OngletsComponent, SejourFraisComponent, SejourMaterielComponent, MesInformationsComponent, JourneeSejourComponent,
            CarnetSejourComponent, CarnetImprimableComponent, TrombinoscopeSejourComponent, SejourRestaurantComponent,
            NotificationsSejourComponent],
  template: `
    @if (imprimable() && carnet(); as c) {
      <app-carnet-imprimable [sejour]="c" (fermer)="imprimable.set(false)" />
    } @else {
    @if (entete(); as e) {
      <h1>{{ e.nom }}</h1>
      <p class="secondaire">{{ majuscule(periode(e.dateDebut, e.dateFin)) }}@if (e.lieu) { · {{ e.lieu }}}</p>

      @if (frais(); as v) {
        <div class="qui">
          <span>Vous êtes <strong>{{ v.moi.prenom }} {{ v.moi.nom }}</strong>.</span>
          <button type="button" class="bouton-discret" (click)="deconnecter()">Se déconnecter</button>
        </div>
        <app-notifications-sejour [notifications]="notifications" />
        @if (voyageur(); as p) {
          <app-journee-sejour [participants]="[p]" [moiId]="p.id" [dateDebut]="e.dateDebut" [dateFin]="e.dateFin"
                              [programme]="programme()" [affaires]="affaires()" [comptes]="mesComptes()"
                              [cartes]="portCartes" ouCompleter="Mes informations" />
        }
        @if (horsLigne()) {
          <p class="alerte hors-ligne" role="status">
            Hors ligne : votre carnet tel qu'il était à la dernière ouverture sur ce téléphone. Pour enregistrer
            vos informations ou vos frais, attendez d'avoir du réseau.
          </p>
        }
        <app-onglets id="onglets-participant" [options]="onglets" [choisi]="onglet()" (choisir)="changerOnglet($event)" />
        @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }
        @if (onglet() === 'carnet') {
          @if (carnet(); as c) {
            <app-carnet-sejour [sejour]="c" [prets]="prets" [cartes]="portCartes" [lirePhoto]="lirePhotoJournee"
                               [attestations]="portAttestations" (ouvrirOnglet)="ouvrirDepuisCarnet($event)" />
            <p class="version-imprimable">
              <button type="button" class="bouton-discret" (click)="ouvrirImprimable()">Version imprimable</button>
            </p>
          } @else {
            <p class="vide">Chargement…</p>
          }
        } @else if (onglet() === 'infos') {
          @if (moi(); as p) {
            <p class="secondaire">Votre voyage, vos repas et la personne à prévenir : l'organisateur s'en sert pour
              les voitures, les chambres et la cuisine.</p>
            @if (erreur(); as m) { <div class="alerte" role="alert">{{ m }}</div> }
            <app-mes-informations [participant]="p" [envoi]="envoi()" [annulable]="false"
                                  (enregistrer)="enregistrerInfos($event)" />
          } @else {
            <p class="vide">Chargement…</p>
          }
        } @else if (onglet() === 'materiel') {
          <app-sejour-materiel [prets]="prets" />
        } @else if (onglet() === 'restaurant') {
          @if (horsLigne()) {
            <p class="vide">Les menus du restaurant demandent le réseau.</p>
          } @else {
            <app-sejour-restaurant [port]="portMenus" [dateDebut]="e.dateDebut" [dateFin]="e.dateFin" />
          }
        } @else if (onglet() === 'trombinoscope') {
          <app-trombinoscope-sejour [port]="portTrombinoscope" [vueParticipant]="true" />
        } @else {
          <app-sejour-frais [frais]="v.frais" [participants]="v.participants" [port]="port"
                            (maj)="majFrais($event)" />
        }
      } @else if (!chargement()) {
        <section class="carte connexion">
          <h2>Entrer</h2>
          @if (erreur(); as m) { <div class="alerte" role="alert">{{ m }}</div> }
          @if (etape() === 'email') {
            <p>Donnez l'adresse e-mail que vous avez donnée à l'organisateur du séjour : vous recevrez un code
              à 6 chiffres. Pas de compte ni de mot de passe à créer.</p>
            <form (ngSubmit)="demanderCode()">
              <label for="f-email">Votre e-mail</label>
              <input id="f-email" name="email" type="email" autocomplete="email" [(ngModel)]="email" required>
              <button type="submit" class="bouton-principal" [disabled]="envoi()">Recevoir le code</button>
            </form>
          } @else {
            <p>Si cette adresse est celle d'un participant, un code vient d'y partir (pensez aux indésirables).
              Il est valable 10 minutes.</p>
            <form (ngSubmit)="entrer()">
              <label for="f-code">Code reçu par e-mail</label>
              <input id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                     [(ngModel)]="codeSaisi" required>
              <div class="actions">
                <button type="submit" class="bouton-principal" [disabled]="envoi()">Entrer</button>
                <button type="button" class="bouton-discret" (click)="etape.set('email')">Changer d'adresse ou renvoyer</button>
              </div>
            </form>
          }
          <p class="secondaire">Moniteur du club ? Connectez-vous à l'appli : le séjour est dans « Séjours ».</p>
        </section>
      }
    } @else if (erreur(); as m) {
      <div class="alerte" role="alert">{{ m }}</div>
    } @else {
      <p class="vide">Chargement…</p>
    }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .qui { display: flex; justify-content: space-between; align-items: center; gap: var(--pas); flex-wrap: wrap;
           margin: var(--pas-2) 0; }
    .connexion { padding: var(--pas-2); max-width: 32rem; margin-top: var(--pas-2); }
    .connexion h2 { margin-top: 0; }
    label { display: block; margin: var(--pas-2) 0 var(--pas); font-weight: 700; }
    form .bouton-principal { margin-top: var(--pas-2); }
    .actions { display: flex; gap: var(--pas); flex-wrap: wrap; align-items: center; }
  `]
})
export class EspaceParticipantComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  private readonly base = `/api/public/sejour/${encodeURIComponent(this.code)}`;
  private readonly cle = cleJetonLienSejour(this.code);
  private jeton: string | null = null;

  readonly periode = periode;

  entete = signal<EnteteVue | null>(null);
  frais = signal<FraisPublicVue | null>(null);
  moi = signal<ParticipantVue | null>(null);
  /** Tout le séjour vu par ce participant (onglet « Carnet »). */
  carnet = signal<SejourVue | null>(null);
  /** Le carnet vient de la copie du téléphone, faute de réseau : lecture seule. */
  horsLigne = signal(false);
  /** Soi-même pour « Aujourd'hui » : la fiche du carnet, à jour de sa carte d'embarquement. */
  readonly voyageur = computed(() => this.carnet()?.participants.find(p => p.moi) ?? this.moi());
  /** Le carnet mis en page pour le papier, à la place de la page. */
  imprimable = signal(false);

  ouvrirImprimable(): void {
    this.imprimable.set(true);
    window.scrollTo(0, 0);
  }
  private contenu = signal<MesInformationsVue['programme'] | null>(null);
  readonly programme = computed(() => {
    const c = this.contenu();
    return c ? programmeParJour(c.evenements, c.plongees, c.palanquees, c.journees ?? []) : [];
  });
  readonly affaires = computed(() => this.contenu()?.affaires ?? []);
  /** « vous devez 25,00 € à Inès Roux », rappelé la veille du retour. */
  readonly mesComptes = computed(() => {
    const v = this.frais();
    if (!v) return [];
    const nom = (id: number) => {
      const p = v.participants.find(x => x.id === id);
      return p ? `${p.prenom} ${p.nom}` : '?';
    };
    return remboursementsDe(v.frais.comptes.remboursements, v.moi.id, nom);
  });
  /** L'ancienne adresse /frais/… ouvre directement les frais. */
  readonly onglets: OptionOnglet<Onglet>[] = [
    { valeur: 'carnet', libelle: 'Carnet' }, { valeur: 'infos', libelle: 'Mes informations' },
    { valeur: 'frais', libelle: 'Frais' }, { valeur: 'materiel', libelle: 'Matériel' },
    { valeur: 'restaurant', libelle: 'Restaurant' }, { valeur: 'trombinoscope', libelle: 'Trombinoscope' }
  ];
  onglet = signal<Onglet>(this.route.snapshot.url[0]?.path === 'frais' ? 'frais' : 'carnet');
  chargement = signal(true);
  erreur = signal<string | null>(null);
  message = signal<string | null>(null);
  envoi = signal(false);
  etape = signal<'email' | 'code'>('email');
  email = '';
  /** Le code à 6 chiffres tapé (« code » est celui de l'adresse). */
  codeSaisi = '';

  /** Les écritures des frais, avec le jeton du lien. */
  readonly port: PortFrais = {
    enregistrerDepense: (depenseId, d) => depenseId === null
      ? this.http.post<{ depenseId: number; vue: FraisPublicVue }>(`${this.base}/depenses`, d, this.options())
        .pipe(map(r => { this.frais.set(r.vue); return { depenseId: r.depenseId, frais: r.vue.frais }; }))
      : this.suivre(this.http.put<FraisPublicVue>(`${this.base}/depenses/${depenseId}`, d, this.options()))
        .pipe(map(frais => ({ depenseId, frais }))),
    supprimerDepense: depenseId => this.suivre(
      this.http.delete<FraisPublicVue>(`${this.base}/depenses/${depenseId}`, this.options())),
    ajouterPhoto: (depenseId, fichier) => this.suivre(
      this.http.post<FraisPublicVue>(`${this.base}/depenses/${depenseId}/photos`, formulairePhoto(fichier), this.options())),
    supprimerPhoto: (depenseId, photoId) => this.suivre(
      this.http.delete<FraisPublicVue>(`${this.base}/depenses/${depenseId}/photos/${photoId}`, this.options())),
    lirePhoto: (depenseId, photoId) => this.http.get(`${this.base}/depenses/${depenseId}/photos/${photoId}`,
      { headers: this.entetes(), responseType: 'blob' }),
    lireNote: fichier => this.http.post<NoteLue>(`${this.base}/depenses/lecture-note`, formulairePhoto(fichier),
      this.options()),
    reglesLecture: () => this.http.get<RegleLecture[]>(`${this.base}/lecture-notes/regles`, this.options()),
    apprendreLecture: lecon => this.http.post<void>(`${this.base}/lecture-notes/apprentissage`, lecon, this.options()),
    ajouterVersement: d => this.suivre(this.http.post<FraisPublicVue>(`${this.base}/versements`, d, this.options())),
    supprimerVersement: versementId => this.suivre(
      this.http.delete<FraisPublicVue>(`${this.base}/versements/${versementId}`, this.options()))
  };

  /** Le trombinoscope, avec le jeton du lien : les seules photos rendues visibles aux participants. */
  readonly portTrombinoscope: PortTrombinoscope = {
    lister: () => this.http.get<LigneTrombinoscopeSejour[]>(`${this.base}/trombinoscope`, this.options()),
    photo: p => this.http.get(`${this.base}/trombinoscope/${p}/photo`, { headers: this.entetes(), responseType: 'blob' })
  };

  /** Les menus des restaurants, avec le jeton du lien : on ne choisit que pour soi, ni import ni commande complète. */
  readonly portMenus: PortMenus = {
    lire: () => this.http.get<MenusVue>(`${this.base}/menus`, this.options()),
    importer: () => throwError(() => new Error('Réservé aux organisateurs')),
    supprimer: () => throwError(() => new Error('Réservé aux organisateurs')),
    regler: () => throwError(() => new Error('Réservé aux organisateurs')),
    modifier: () => throwError(() => new Error('Réservé aux organisateurs')),
    choisir: (menuId, _p, platIds) =>
      this.http.put<MenusVue>(`${this.base}/menus/${menuId}/choix`, { platIds }, this.options())
  };

  /** Le matériel emprunté, avec le jeton du lien. */
  readonly portPrets: PortPrets = {
    lire: () => this.http.get<PretsSejourVue>(`${this.base}/prets`, this.options()),
    declarer: d => this.http.post<PretsSejourVue>(`${this.base}/prets`, d, this.options()),
    annuler: pretId => this.http.delete<PretsSejourVue>(`${this.base}/prets/${pretId}`, this.options()),
    rienEmprunte: rien => this.http.put<PretsSejourVue>(`${this.base}/prets/rien-emprunte`, { rienEmprunte: rien },
      this.options())
  };

  /** Ses cartes d'embarquement, avec le jeton du lien : chaque écriture renvoie le carnet à jour. */
  readonly portCartes: PortCartesEmbarquement = {
    deposer: (_p, sens, fichier) => this.http.post<SejourVue>(`${this.base}/cartes-embarquement/${sens}`,
      formulairePhoto(fichier), this.options()).pipe(tap(c => this.carnet.set(c))),
    retirer: (_p, sens) => this.http.delete<SejourVue>(`${this.base}/cartes-embarquement/${sens}`, this.options())
      .pipe(tap(c => this.carnet.set(c))),
    lire: (_p, sens) => this.http.get(`${this.base}/cartes-embarquement/${sens}`,
      { headers: this.entetes(), responseType: 'blob' })
  };

  /** Les photos des lieux des journées du programme, avec le jeton du lien. */
  readonly lirePhotoJournee: LecturePhotoJournee = (jour, photoId) =>
    this.http.get(`${this.base}/journees/${jour}/photos/${photoId}`, { headers: this.entetes(), responseType: 'blob' });

  /** Son attestation d'assurance, avec le jeton du lien : chaque écriture renvoie le carnet à jour. */
  readonly portAttestations: PortAttestationAssurance = {
    deposer: (_p, fichier) => this.http.post<SejourVue>(`${this.base}/attestation-assurance`,
      formulairePhoto(fichier), this.options()).pipe(tap(c => this.carnet.set(c))),
    retirer: () => this.http.delete<SejourVue>(`${this.base}/attestation-assurance`, this.options())
      .pipe(tap(c => this.carnet.set(c))),
    lire: () => this.http.get(`${this.base}/attestation-assurance`, { headers: this.entetes(), responseType: 'blob' })
  };

  /** Les notifications du séjour sur ce téléphone, avec le jeton du lien. */
  readonly notifications = new NotificationsDuSejour(inject(SwPush), this.http, {
    activer: a => this.http.put<void>(`${this.base}/notifications`, a, this.options()),
    couper: endpoint => this.http.delete<void>(`${this.base}/notifications`, { ...this.options(), body: { endpoint } })
  }, this.code);

  /** Le matériel emprunté, partagé par la carte « Mon séjour » du carnet et l'onglet « Matériel ». */
  readonly prets = new PretsDuSejour(this.portPrets);
  private readonly materiel = viewChild(SejourMaterielComponent);
  private readonly injector = inject(Injector);

  /**
   * La fenêtre de déclaration de l'onglet « Matériel », une fois l'onglet
   * affiché : avant son rendu, le composant n'existe pas encore (un
   * setTimeout passait parfois avant, et rien ne s'ouvrait).
   */
  private ouvrirDeclarationApresRendu(): void {
    afterNextRender(() => this.materiel()?.ouvrir(), { injector: this.injector });
  }

  constructor() {
    void this.demarrer();
  }

  majuscule(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  majFrais(f: FraisVue): void {
    const v = this.frais();
    if (v) this.frais.set({ ...v, frais: f });
    // « Mes comptes » du carnet suit les frais.
    const c = this.carnet();
    if (c) this.carnet.set({ ...c, frais: f });
  }

  /** Depuis le carnet ; « declarer » : l'onglet « Matériel », fenêtre de déclaration ouverte. */
  ouvrirDepuisCarnet(o: Onglet | 'declarer'): void {
    this.changerOnglet(o === 'declarer' ? 'materiel' : o);
    if (o === 'declarer') this.ouvrirDeclarationApresRendu();
  }

  /** Un onglet, en haut de son contenu ; le message d'un autre onglet ne le suit pas. */
  changerOnglet(o: Onglet): void {
    this.message.set(null);
    this.erreur.set(null);
    this.onglet.set(o);
    this.remonter();
  }

  private remonter(): void {
    setTimeout(() => document.getElementById('onglets-participant')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async enregistrerInfos(d: DemandeMesInformations): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    this.message.set(null);
    try {
      const r = await firstValueFrom(this.http.put<MesInformationsVue>(`${this.base}/moi`, d, this.options()));
      this.moi.set(r.moi);
      this.contenu.set(r.programme);
      // Retour au carnet, en haut : le message, et « Mon séjour » à jour.
      this.carnet.set(await firstValueFrom(this.http.get<SejourVue>(`${this.base}/carnet`, this.options())));
      this.onglet.set('carnet');
      this.message.set('Vos informations sont enregistrées. Merci !');
      this.remonter();
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "L'enregistrement n'a pas abouti (réseau nécessaire).");
      this.remonter();
    } finally {
      this.envoi.set(false);
    }
  }

  async demanderCode(): Promise<void> {
    if (!this.email.trim()) {
      this.erreur.set('Indiquez votre adresse e-mail.');
      return;
    }
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      await firstValueFrom(this.http.post(`${this.base}/code`, { email: this.email.trim() }));
      this.codeSaisi = '';
      this.etape.set('code');
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "Le code n'a pas pu être envoyé (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  async entrer(): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const c = await firstValueFrom(this.http.post<{ jeton: string; expireLe: string }>(`${this.base}/connexion`,
        { email: this.email.trim(), code: this.codeSaisi.trim() }));
      await this.garderJeton(c.jeton, c.expireLe);
      await this.charger();
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "L'entrée n'a pas abouti (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  async deconnecter(): Promise<void> {
    // Un téléphone prêté ou partagé ne reçoit plus les nouvelles du séjour (le serveur les coupe aussi).
    if (this.notifications.etat() === 'activees') await this.notifications.couper();
    try { await firstValueFrom(this.http.post(`${this.base}/deconnexion`, {}, this.options())); } catch { /* déjà expiré */ }
    await this.oublierJeton();
  }

  private async demarrer(): Promise<void> {
    try {
      this.entete.set(await firstValueFrom(this.http.get<EnteteVue>(this.base)));
    } catch (e) {
      const action = lectureEchouee((e as HttpErrorResponse).status ?? 0);
      if (action === 'copie' && await this.reprendreCopie()) {
        this.chargement.set(false);
        return;
      }
      // Séjour supprimé ou adresse inconnue : sa copie ne reste pas sur le téléphone.
      if (action === 'effacer') await this.oublierJeton();
      this.erreur.set((e as HttpErrorResponse).status === 404
        ? 'Adresse inconnue : vérifiez le lien reçu, ou demandez-le à l’organisateur du séjour.'
        : 'Impossible d’ouvrir le séjour (réseau nécessaire).');
      this.chargement.set(false);
      return;
    }
    const ticket = ticketQrCode(this.route.snapshot.fragment);
    if (ticket) {
      // Le ticket ne sert qu'une fois : il quitte l'adresse, qu'on ne le rejoue pas en rechargeant la page.
      await this.router.navigate([], { fragment: undefined, replaceUrl: true });
      if (await this.entrerParQrCode(ticket)) {
        this.chargement.set(false);
        return;
      }
    }
    try {
      this.jeton = (await lire<JetonGarde>(MAGASIN_CACHE, this.cle))?.valeur ?? null;
    } catch { this.jeton = null; }
    if (this.jeton) {
      try {
        await this.charger();
        // Entré avant que le téléphone ne retienne son séjour : l'appli y revient désormais.
        if (!await sejourRetenu()) await retenirSejour(this.code, null);
      } catch { /* jeton expiré : on redemande le code */ }
    }
    this.chargement.set(false);
  }

  /** Le QR code montré par l'organisateur : connecté sans e-mail ni code ; faux si refusé. */
  private async entrerParQrCode(ticket: string): Promise<boolean> {
    try {
      const c = await firstValueFrom(this.http.post<{ jeton: string; expireLe: string }>(
        `${this.base}/connexion-qr-code`, { ticket }));
      await this.garderJeton(c.jeton, c.expireLe);
      await this.charger();
      return true;
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "L'entrée par QR code n'a pas abouti (réseau nécessaire).");
      return false;
    }
  }

  /** Le jeton sur ce téléphone, et son séjour, que l'appli installée rouvre au démarrage. */
  private async garderJeton(jeton: string, expireLe: string | null): Promise<void> {
    this.jeton = jeton;
    await ecrire<JetonGarde>(MAGASIN_CACHE, { cle: this.cle, valeur: jeton });
    await retenirSejour(this.code, expireLe);
  }

  /** Les frais et ses informations, ensemble ; un jeton refusé ramène à l'entrée. */
  private async charger(): Promise<void> {
    try {
      const [frais, infos, carnet] = await Promise.all([
        firstValueFrom(this.http.get<FraisPublicVue>(`${this.base}/frais`, this.options())),
        firstValueFrom(this.http.get<MesInformationsVue>(`${this.base}/moi`, this.options())),
        firstValueFrom(this.http.get<SejourVue>(`${this.base}/carnet`, this.options()))
      ]);
      this.frais.set(frais);
      this.carnet.set(carnet);
      this.moi.set(infos.moi);
      this.contenu.set(infos.programme);
      this.horsLigne.set(false);
      // Le carnet reste lisible sans réseau, sur ce téléphone, jusqu'à « Se déconnecter ».
      const entete = this.entete();
      if (entete) {
        await ecrire<CopieLien>(MAGASIN_CACHE, { cle: cleLienSejour(this.code), valeur: { entete, frais, infos, carnet } })
          .catch(() => undefined);
      }
    } catch (e) {
      const statut = (e as HttpErrorResponse).status ?? 0;
      if (lectureEchouee(statut) === 'effacer') {
        await this.oublierJeton();
        this.erreur.set('Votre connexion a expiré : demandez un nouveau code.');
      } else if (lectureEchouee(statut) === 'copie' && await this.reprendreCopie()) {
        return;
      }
      throw e;
    }
  }

  /** Sans réseau : le carnet tel qu'il était à la dernière ouverture sur ce téléphone ; faux s'il n'y en a pas. */
  private async reprendreCopie(): Promise<boolean> {
    const copie = (await lire<CopieLien>(MAGASIN_CACHE, cleLienSejour(this.code)).catch(() => undefined))?.valeur;
    if (!copie) return false;
    this.entete.set(copie.entete);
    this.frais.set(copie.frais);
    this.carnet.set(copie.carnet);
    this.moi.set(copie.infos.moi);
    this.contenu.set(copie.infos.programme);
    this.horsLigne.set(true);
    this.erreur.set(null);
    return true;
  }

  private async oublierJeton(): Promise<void> {
    try { await supprimer(MAGASIN_CACHE, cleLienSejour(this.code)); } catch { /* rien à effacer */ }
    this.horsLigne.set(false);
    this.jeton = null;
    this.frais.set(null);
    this.moi.set(null);
    this.carnet.set(null);
    this.etape.set('email');
    try { await supprimer(MAGASIN_CACHE, this.cle); } catch { /* rien à effacer */ }
    await oublierSejour(this.code);
  }

  private suivre(o: Observable<FraisPublicVue>): Observable<FraisVue> {
    return o.pipe(map(v => { this.frais.set(v); return v.frais; }));
  }

  private entetes(): HttpHeaders {
    return new HttpHeaders(this.jeton ? { 'X-Jeton-Sejour': this.jeton } : {});
  }

  private options() {
    return { headers: this.entetes() };
  }
}
