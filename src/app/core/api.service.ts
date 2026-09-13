import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { CursusVue, Eligibilite, GrilleVue, SeanceVue, Statut } from './modeles';
import { MAGASIN_CACHE, ecrire, lire } from './base-locale';

interface Entree<T> { cle: string; valeur: T; majLe: number; }

interface Paquet {
  genereLe: string;
  cursus: CursusVue[];
  seances: SeanceVue[];
  grilles: GrilleVue[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ----------------------------------------------------------------
  //  Lectures : réseau d'abord, cache local en repli.
  // ----------------------------------------------------------------

  cursus(): Promise<CursusVue[]> {
    return this.lireOuRetomber('cursus', () => this.http.get<CursusVue[]>('/api/cursus'));
  }

  seances(): Promise<SeanceVue[]> {
    return this.lireOuRetomber('seances', () => this.http.get<SeanceVue[]>('/api/seances'));
  }

  grille(cursusId: number): Promise<GrilleVue> {
    return this.lireOuRetomber(`grille:${cursusId}`,
      () => this.http.get<GrilleVue>(`/api/cursus/${cursusId}/grille`));
  }

  /**
   * Amorce du mode hors ligne : un seul appel ramène les cursus, les séances
   * et toutes les grilles de la saison, puis alimente le cache local. À
   * déclencher pendant qu'on a encore du réseau, avant de partir en bord de
   * bassin ou sur le bateau.
   */
  async precharger(): Promise<number> {
    const paquet = await firstValueFrom(
      this.http.get<Paquet>('/api/synchronisation/paquet'));

    await this.deposer('cursus', paquet.cursus);
    await this.deposer('seances', paquet.seances);
    for (const g of paquet.grilles) {
      await this.deposer(`grille:${g.cursusId}`, g);
    }
    return paquet.grilles.length;
  }

  async dateDuCache(cle: string): Promise<number | null> {
    const entree = await lire<Entree<unknown>>(MAGASIN_CACHE, cle);
    return entree ? entree.majLe : null;
  }

  // ----------------------------------------------------------------
  //  Écritures nécessitant le réseau.
  //  La notation, elle, passe par FileAttenteService.
  // ----------------------------------------------------------------

  validerCompetence(cursusId: number, blocId: number, commentaire?: string): Observable<unknown> {
    return this.http.post(
      `/api/cursus/${cursusId}/competences/${blocId}/validation`,
      { commentaire: commentaire ?? null }
    );
  }

  eligibilite(cursusId: number): Observable<Eligibilite> {
    return this.http.get<Eligibilite>(`/api/cursus/${cursusId}/eligibilite`);
  }

  noterEnLigne(cursusId: number, critereId: number, statut: Statut,
               seanceId: number | null, referenceClient: string): Observable<unknown> {
    return this.http.post(`/api/cursus/${cursusId}/evaluations`, {
      critereId, statut, seanceId, referenceClient
    });
  }

  // ----------------------------------------------------------------

  private async lireOuRetomber<T>(cle: string, appel: () => Observable<T>): Promise<T> {
    try {
      const valeur = await firstValueFrom(appel());
      await this.deposer(cle, valeur);
      return valeur;
    } catch (erreur) {
      const entree = await lire<Entree<T>>(MAGASIN_CACHE, cle);
      if (entree) return entree.valeur;
      throw erreur;
    }
  }

  private deposer<T>(cle: string, valeur: T): Promise<IDBValidKey> {
    return ecrire<Entree<T>>(MAGASIN_CACHE, { cle, valeur, majLe: Date.now() });
  }
}
