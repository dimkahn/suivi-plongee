import { Component, ChangeDetectionStrategy, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { MAGASIN_CACHE, ecrire, lire, supprimer } from '../../core/base-locale';
import { periode } from '../../core/date-fr';
import { SejourFraisComponent } from './sejour-frais.component';
import { MesInformationsComponent } from './mes-informations.component';
import { SeanceSortieVue } from '../../core/modeles';
import { JourneeSejourComponent } from './journee-sejour.component';
import { CarnetSejourComponent } from './carnet-sejour.component';
import { CarnetImprimableComponent } from './carnet-imprimable.component';
import { programmeParJour } from './programme-du-jour';
import {
  AffaireVue, DemandeMesInformations, EvenementVue, FraisVue, NoteLue, PalanqueeVue, ParticipantFrais, ParticipantVue,
  PortFrais, RegleLecture,
  PortPrets, PretsSejourVue, SejourVue, euros, formulairePhoto
} from './sejour-api';
import { SejourMaterielComponent } from './sejour-materiel.component';
import { PretsDuSejour } from './materiel-sejour';

type Onglet = 'carnet' | 'infos' | 'frais' | 'materiel';

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
  programme: { evenements: EvenementVue[]; plongees: SeanceSortieVue[]; affaires: AffaireVue[]; palanquees: PalanqueeVue[] };
}

/** Le jeton du lien, gardé sur l'appareil (IndexedDB, comme le reste : pas de localStorage). */
interface JetonGarde {
  cle: string;
  valeur: string;
}

/**
 * Le séjour pour un participant qui n'est pas moniteur, à l'adresse reçue
 * par e-mail (/sejour/…, et l'ancienne /frais/… qui ouvre les frais) : il
 * donne son e-mail, reçoit un code à 6 chiffres, puis lit le carnet du
 * séjour, toujours à jour (programme, voitures, chambres, affaires, infos
 * pratiques), renseigne ses informations (voyage, repas, personne à prévenir), voit et saisit les
 * frais (un élève les consulte seulement) et déclare le matériel du club qu'il a emprunté. Pendant le séjour, l'encart
 * « Aujourd'hui » : son voyage du jour, le programme, le rappel de la veille. Sans connexion à l'appli ; le
 * jeton reste sur l'appareil jusqu'à « Se déconnecter » ou 60 jours après
 * le séjour.
 */
@Component({
  selector: 'app-espace-participant',
  imports: [FormsModule, SejourFraisComponent, SejourMaterielComponent, MesInformationsComponent, JourneeSejourComponent,
            CarnetSejourComponent, CarnetImprimableComponent],
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
        @if (moi(); as p) {
          <app-journee-sejour [participants]="[p]" [moiId]="p.id" [dateDebut]="e.dateDebut" [dateFin]="e.dateFin"
                              [programme]="programme()" [affaires]="affaires()" [comptes]="mesComptes()"
                              ouCompleter="Mes informations" />
        }
        <div class="onglets" role="tablist" id="onglets-participant">
          <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'carnet'"
                  [attr.aria-selected]="onglet() === 'carnet'" (click)="changerOnglet('carnet')">Carnet</button>
          <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'infos'"
                  [attr.aria-selected]="onglet() === 'infos'" (click)="changerOnglet('infos')">Mes informations</button>
          <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'frais'"
                  [attr.aria-selected]="onglet() === 'frais'" (click)="changerOnglet('frais')">Frais</button>
          <button type="button" role="tab" class="bouton-discret" [class.actif]="onglet() === 'materiel'"
                  [attr.aria-selected]="onglet() === 'materiel'" (click)="changerOnglet('materiel')">Matériel</button>
        </div>
        @if (message(); as m) { <div class="alerte" role="status">{{ m }}</div> }
        @if (onglet() === 'carnet') {
          @if (carnet(); as c) {
            <app-carnet-sejour [sejour]="c" [prets]="prets" (ouvrirOnglet)="ouvrirDepuisCarnet($event)" />
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
    .onglets { display: flex; gap: var(--pas); margin: var(--pas-2) 0; flex-wrap: wrap; }
    .onglets .actif { background: var(--profond); color: #fff; border-color: var(--profond); font-weight: 700; }
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
  private readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  private readonly base = `/api/public/sejour/${encodeURIComponent(this.code)}`;
  private readonly cle = `jeton-sejour:${this.code}`;
  private jeton: string | null = null;

  readonly periode = periode;

  entete = signal<EnteteVue | null>(null);
  frais = signal<FraisPublicVue | null>(null);
  moi = signal<ParticipantVue | null>(null);
  /** Tout le séjour vu par ce participant (onglet « Carnet »). */
  carnet = signal<SejourVue | null>(null);
  /** Le carnet mis en page pour le papier, à la place de la page. */
  imprimable = signal(false);

  ouvrirImprimable(): void {
    this.imprimable.set(true);
    window.scrollTo(0, 0);
  }
  private contenu = signal<MesInformationsVue['programme'] | null>(null);
  readonly programme = computed(() => {
    const c = this.contenu();
    return c ? programmeParJour(c.evenements, c.plongees, c.palanquees) : [];
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
    return v.frais.comptes.remboursements
      .filter(r => r.deId === v.moi.id || r.aId === v.moi.id)
      .map(r => r.deId === v.moi.id
        ? `vous devez ${euros(r.montantCentimes)} à ${nom(r.aId)}`
        : `${nom(r.deId)} vous doit ${euros(r.montantCentimes)}`);
  });
  /** L'ancienne adresse /frais/… ouvre directement les frais. */
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

  /** Le matériel emprunté, avec le jeton du lien. */
  readonly portPrets: PortPrets = {
    lire: () => this.http.get<PretsSejourVue>(`${this.base}/prets`, this.options()),
    declarer: d => this.http.post<PretsSejourVue>(`${this.base}/prets`, d, this.options()),
    annuler: pretId => this.http.delete<PretsSejourVue>(`${this.base}/prets/${pretId}`, this.options()),
    rienEmprunte: rien => this.http.put<PretsSejourVue>(`${this.base}/prets/rien-emprunte`, { rienEmprunte: rien },
      this.options())
  };

  /** Le matériel emprunté, partagé par la carte « Mon séjour » du carnet et l'onglet « Matériel ». */
  readonly prets = new PretsDuSejour(this.portPrets);
  private readonly materiel = viewChild(SejourMaterielComponent);

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
    if (o === 'declarer') setTimeout(() => this.materiel()?.ouvrir());
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
      const c = await firstValueFrom(this.http.post<{ jeton: string }>(`${this.base}/connexion`,
        { email: this.email.trim(), code: this.codeSaisi.trim() }));
      this.jeton = c.jeton;
      await ecrire<JetonGarde>(MAGASIN_CACHE, { cle: this.cle, valeur: c.jeton });
      await this.charger();
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? "L'entrée n'a pas abouti (réseau nécessaire).");
    } finally {
      this.envoi.set(false);
    }
  }

  async deconnecter(): Promise<void> {
    try { await firstValueFrom(this.http.post(`${this.base}/deconnexion`, {}, this.options())); } catch { /* déjà expiré */ }
    await this.oublierJeton();
  }

  private async demarrer(): Promise<void> {
    try {
      this.entete.set(await firstValueFrom(this.http.get<EnteteVue>(this.base)));
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).status === 404
        ? 'Adresse inconnue : vérifiez le lien reçu, ou demandez-le à l’organisateur du séjour.'
        : 'Impossible d’ouvrir le séjour (réseau nécessaire).');
      this.chargement.set(false);
      return;
    }
    try {
      this.jeton = (await lire<JetonGarde>(MAGASIN_CACHE, this.cle))?.valeur ?? null;
    } catch { this.jeton = null; }
    if (this.jeton) {
      try { await this.charger(); } catch { /* jeton expiré : on redemande le code */ }
    }
    this.chargement.set(false);
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
    } catch (e) {
      if ((e as HttpErrorResponse).status === 403) {
        await this.oublierJeton();
        this.erreur.set('Votre connexion a expiré : demandez un nouveau code.');
      }
      throw e;
    }
  }

  private async oublierJeton(): Promise<void> {
    this.jeton = null;
    this.frais.set(null);
    this.moi.set(null);
    this.carnet.set(null);
    this.etape.set('email');
    try { await supprimer(MAGASIN_CACHE, this.cle); } catch { /* rien à effacer */ }
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
