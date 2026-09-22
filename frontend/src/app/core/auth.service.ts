import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, tap } from 'rxjs';
import { Session } from './modeles';

const ORDRE_ENCADREMENT = ['E1', 'E2', 'E3', 'E4'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Le jeton reste en mémoire : ni localStorage ni sessionStorage. */
  readonly session = signal<Session | null>(null);

  /**
   * Passe à `true` une fois {@link reprendre} terminé (succès ou échec), au
   * chargement de l'application. Les gardes de route doivent attendre ce
   * signal avant de statuer sur `connecte()` : sans ça, la navigation
   * initiale peut s'exécuter avant la réponse de `/api/auth/rafraichir` et
   * rediriger à tort vers /connexion alors que la session est valide.
   */
  readonly sessionResolue = signal(false);

  readonly connecte = computed(() => this.session() !== null);
  readonly roles = computed(() => this.session()?.roles ?? []);
  readonly estMoniteur = computed(() => this.roles().includes('MONITEUR'));
  readonly estAdmin = computed(() => this.roles().includes('ADMIN'));
  readonly niveau = computed(() => this.session()?.niveauEncadrement ?? null);

  get jeton(): string | null {
    return this.session()?.jetonAcces ?? null;
  }

  /** seSouvenir : la session survit à la fermeture du navigateur (sinon elle s'arrête avec lui). */
  connexion(email: string, motDePasse: string, seSouvenir: boolean): Observable<Session> {
    return this.http
      .post<Session>('/api/auth/connexion', { email, motDePasse, seSouvenir }, { withCredentials: true })
      .pipe(tap(s => this.session.set(s)));
  }

  /** Reprend la session au chargement grâce au cookie de rafraîchissement. */
  reprendre(): Observable<Session> {
    return this.http
      .post<Session>('/api/auth/rafraichir', {}, { withCredentials: true })
      .pipe(tap(s => this.session.set(s)));
  }

  /** À appeler une fois au démarrage de l'application : voir {@link sessionResolue}. */
  initialiser(): void {
    this.reprendre()
      .pipe(finalize(() => this.sessionResolue.set(true)))
      .subscribe({ error: () => {} });
  }

  /** Toujours la même réponse au moniteur, que le compte existe ou non. */
  motDePasseOublie(email: string): Observable<unknown> {
    return this.http.post('/api/auth/mot-de-passe-oublie', { email });
  }

  reinitialiserMotDePasse(jeton: string, nouveauMotDePasse: string): Observable<unknown> {
    return this.http.post('/api/auth/reinitialiser-mot-de-passe', { jeton, nouveauMotDePasse });
  }

  /*
   * Modification de son propre compte. Le serveur renvoie une session neuve
   * (nouveau jeton : l'ancien porte l'e-mail d'avant) qui remplace la
   * courante. Le niveau d'encadrement ne se modifie pas ici.
   */

  modifierIdentite(demande: { nom: string; prenom: string; numeroLicence: string | null }): Observable<Session> {
    return this.http.put<Session>('/api/auth/moi', demande).pipe(tap(s => this.session.set(s)));
  }

  changerEmail(nouvelEmail: string, motDePasseActuel: string): Observable<Session> {
    return this.http
      .put<Session>('/api/auth/moi/email', { nouvelEmail, motDePasseActuel })
      .pipe(tap(s => this.session.set(s)));
  }

  /** Ferme les sessions ouvertes sur les autres appareils ; celle-ci est rouverte (nouveau cookie). */
  changerMotDePasse(motDePasseActuel: string, nouveauMotDePasse: string): Observable<Session> {
    return this.http
      .put<Session>('/api/auth/moi/mot-de-passe', { motDePasseActuel, nouveauMotDePasse },
        { withCredentials: true })
      .pipe(tap(s => this.session.set(s)));
  }

  deconnexion(): void {
    this.http.post('/api/auth/deconnexion', {}, { withCredentials: true }).subscribe({
      complete: () => {
        this.session.set(null);
        this.router.navigate(['/connexion']);
      }
    });
  }

  /**
   * Sert uniquement à expliquer pourquoi une action est indisponible.
   * Le contrôle qui fait foi est celui du serveur.
   */
  peutValider(niveauRequis: string): boolean {
    const mien = this.niveau();
    if (!this.estMoniteur() || !mien) return false;
    return ORDRE_ENCADREMENT.indexOf(mien) >= ORDRE_ENCADREMENT.indexOf(niveauRequis);
  }
}
