import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { MAGASIN_CACHE, ecrire, lire, supprimer } from '../../core/base-locale';
import { periode } from '../../core/date-fr';
import { SejourFraisComponent } from './sejour-frais.component';
import { FraisVue, ParticipantFrais, PortFrais, formulairePhoto } from './sejour-api';

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

/** Le jeton des frais, gardé sur l'appareil (IndexedDB, comme le reste : pas de localStorage). */
interface JetonGarde {
  cle: string;
  valeur: string;
}

/**
 * Les frais d'un séjour pour un participant sans compte, à l'adresse
 * envoyée par l'organisateur : il donne son e-mail, reçoit un code à
 * 6 chiffres, puis voit les frais et saisit ce qu'il a payé, avec la photo
 * de la note (élève : lecture seule, il passe par un moniteur). Sans
 * connexion à l'appli ; le jeton reste sur l'appareil jusqu'à
 * « Se déconnecter » ou 60 jours après le séjour.
 */
@Component({
  selector: 'app-frais-invite',
  imports: [FormsModule, SejourFraisComponent],
  template: `
    @if (entete(); as e) {
      <h1>{{ e.nom }}</h1>
      <p class="secondaire">{{ majuscule(periode(e.dateDebut, e.dateFin)) }}@if (e.lieu) { · {{ e.lieu }}} · frais partagés</p>

      @if (vue(); as v) {
        <div class="qui">
          <span>Vous êtes <strong>{{ v.moi.prenom }} {{ v.moi.nom }}</strong>.</span>
          <button type="button" class="bouton-discret" (click)="deconnecter()">Se déconnecter</button>
        </div>
        <app-sejour-frais [frais]="v.frais" [participants]="v.participants" [port]="port"
                          (maj)="majFrais($event)" />
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
        </section>
      }
    } @else if (erreur(); as m) {
      <div class="alerte" role="alert">{{ m }}</div>
    } @else {
      <p class="vide">Chargement…</p>
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
export class FraisInviteComponent {
  private http = inject(HttpClient);
  private readonly code = inject(ActivatedRoute).snapshot.paramMap.get('code') ?? '';
  private readonly base = `/api/public/frais/${encodeURIComponent(this.code)}`;
  private readonly cle = `jeton-frais:${this.code}`;
  private jeton: string | null = null;

  readonly periode = periode;

  entete = signal<EnteteVue | null>(null);
  vue = signal<FraisPublicVue | null>(null);
  chargement = signal(true);
  erreur = signal<string | null>(null);
  envoi = signal(false);
  etape = signal<'email' | 'code'>('email');
  email = '';
  /** Le code à 6 chiffres tapé (« code » est celui de l'adresse). */
  codeSaisi = '';

  /** Les écritures des frais, avec le jeton de l'invité. */
  readonly port: PortFrais = {
    enregistrerDepense: (depenseId, d) => depenseId === null
      ? this.http.post<{ depenseId: number; vue: FraisPublicVue }>(`${this.base}/depenses`, d, this.options())
        .pipe(map(r => { this.vue.set(r.vue); return { depenseId: r.depenseId, frais: r.vue.frais }; }))
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
    ajouterVersement: d => this.suivre(this.http.post<FraisPublicVue>(`${this.base}/versements`, d, this.options())),
    supprimerVersement: versementId => this.suivre(
      this.http.delete<FraisPublicVue>(`${this.base}/versements/${versementId}`, this.options()))
  };

  constructor() {
    void this.demarrer();
  }

  majuscule(t: string): string {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  majFrais(frais: FraisVue): void {
    const v = this.vue();
    if (v) this.vue.set({ ...v, frais });
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
      await this.chargerFrais();
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
        : 'Impossible d’ouvrir les frais du séjour (réseau nécessaire).');
      this.chargement.set(false);
      return;
    }
    try {
      this.jeton = (await lire<JetonGarde>(MAGASIN_CACHE, this.cle))?.valeur ?? null;
    } catch { this.jeton = null; }
    if (this.jeton) {
      try { await this.chargerFrais(); } catch { /* jeton expiré : on redemande le code */ }
    }
    this.chargement.set(false);
  }

  private async chargerFrais(): Promise<void> {
    try {
      this.vue.set(await firstValueFrom(this.http.get<FraisPublicVue>(`${this.base}/frais`, this.options())));
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
    this.vue.set(null);
    this.etape.set('email');
    try { await supprimer(MAGASIN_CACHE, this.cle); } catch { /* rien à effacer */ }
  }

  private suivre(o: Observable<FraisPublicVue>): Observable<FraisVue> {
    return o.pipe(map(v => { this.vue.set(v); return v.frais; }));
  }

  private entetes(): HttpHeaders {
    return new HttpHeaders(this.jeton ? { 'X-Jeton-Frais': this.jeton } : {});
  }

  private options() {
    return { headers: this.entetes() };
  }
}
