import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
  CursusVue, Eligibilite, EleveVue, EvaluationVue, GrilleVue, LigneTrombinoscope, MatriceVue,
  MoniteurVue, RosterVue, SaisonVue, SeanceVue, Statut
} from './modeles';
import { MAGASIN_CACHE, ecrire, lire } from './base-locale';

interface Entree<T> { cle: string; valeur: T; majLe: number; }

interface DemandeSeance {
  dateSeance: string;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu?: string | null;
  profondeurMax?: number | null;
  commentaire?: string | null;
}

interface DemandeEleve {
  nom: string;
  prenom: string;
  dateNaissance?: string | null;
  numeroLicence?: string | null;
  certificatValideJusquAu?: string | null;
  autorisationLegale: boolean;
}

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

  /** Création/modification réservées aux ADMIN et MONITEUR côté serveur ; nécessitent le réseau. */
  creerSeance(demande: DemandeSeance): Observable<SeanceVue> {
    return this.http.post<SeanceVue>('/api/seances', demande);
  }

  modifierSeance(id: number, demande: DemandeSeance): Observable<SeanceVue> {
    return this.http.put<SeanceVue>(`/api/seances/${id}`, demande);
  }

  /** Réservée à l'ADMIN ; refusée côté serveur si la séance porte déjà présences/évaluations. */
  supprimerSeance(id: number): Observable<unknown> {
    return this.http.delete(`/api/seances/${id}`);
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

  /** Historique complet d'un critère (une ligne par saisie) : nécessite le réseau. */
  historique(cursusId: number, critereId: number): Observable<EvaluationVue[]> {
    return this.http.get<EvaluationVue[]>(
      `/api/cursus/${cursusId}/criteres/${critereId}/historique`);
  }

  /** Vue globale d'un élève : une colonne par séance, comme l'onglet du tableur. */
  matrice(cursusId: number): Observable<MatriceVue> {
    return this.http.get<MatriceVue>(`/api/cursus/${cursusId}/matrice`);
  }

  /** Vue d'ensemble de la saison, réservée aux encadrants (roster « Infos Élèves »). */
  roster(saisonId?: number): Observable<RosterVue> {
    const params = saisonId ? { params: { saisonId } } : {};
    return this.http.get<RosterVue>('/api/roster', params);
  }

  noterEnLigne(cursusId: number, critereId: number, statut: Statut,
               seanceId: number | null, referenceClient: string): Observable<unknown> {
    return this.http.post(`/api/cursus/${cursusId}/evaluations`, {
      critereId, statut, seanceId, referenceClient
    });
  }

  // ----------------------------------------------------------------
  //  Gestion des moniteurs, réservée aux ADMIN.
  // ----------------------------------------------------------------

  moniteurs(): Observable<MoniteurVue[]> {
    return this.http.get<MoniteurVue[]>('/api/admin/moniteurs');
  }

  creerMoniteur(demande: {
    email: string;
    nom: string;
    prenom: string;
    niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4';
    numeroLicence?: string | null;
  }): Observable<MoniteurVue> {
    return this.http.post<MoniteurVue>('/api/admin/moniteurs', demande);
  }

  changerActivationMoniteur(id: number, actif: boolean): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}/activation`, { actif });
  }

  changerMotDePasseMoniteur(id: number, nouveauMotDePasse: string): Observable<unknown> {
    return this.http.put(`/api/admin/moniteurs/${id}/mot-de-passe`, { nouveauMotDePasse });
  }

  supprimerMoniteur(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/moniteurs/${id}`);
  }

  // ----------------------------------------------------------------
  //  Trombinoscope. Une photo n'est jamais affichée sans le consentement
  //  autorisationImage (distinct de l'autorisation de pratiquer).
  // ----------------------------------------------------------------

  trombinoscope(niveau?: 'N1' | 'N2' | 'N3'): Observable<LigneTrombinoscope[]> {
    const params = niveau ? { params: { niveau } } : {};
    return this.http.get<LigneTrombinoscope[]>('/api/trombinoscope', params);
  }

  /** À convertir en URL d'objet côté composant : l'auth passe par un en-tête, pas par un cookie. */
  photoEleve(eleveId: number): Observable<Blob> {
    return this.http.get(`/api/eleves/${eleveId}/photo`, { responseType: 'blob' });
  }

  changerAutorisationImage(eleveId: number, autorisationImage: boolean): Observable<unknown> {
    return this.http.put(`/api/eleves/${eleveId}/autorisation-image`, { autorisationImage });
  }

  deposerPhotoEleve(eleveId: number, fichier: File): Observable<unknown> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post(`/api/eleves/${eleveId}/photo`, donnees);
  }

  supprimerPhotoEleve(eleveId: number): Observable<unknown> {
    return this.http.delete(`/api/eleves/${eleveId}/photo`);
  }

  // ----------------------------------------------------------------
  //  Saisons. Lecture pour les encadrants, écriture réservée à l'ADMIN.
  // ----------------------------------------------------------------

  saisons(): Observable<SaisonVue[]> {
    return this.http.get<SaisonVue[]>('/api/saisons');
  }

  creerSaison(demande: { libelle: string; dateDebut: string; dateFin: string }): Observable<SaisonVue> {
    return this.http.post<SaisonVue>('/api/saisons', demande);
  }

  changerOuvertureSaison(id: number, ouverte: boolean): Observable<SaisonVue> {
    return this.http.put<SaisonVue>(`/api/saisons/${id}/ouverture`, { ouverte });
  }

  // ----------------------------------------------------------------
  //  Élèves : dossier (identité, consentements), réservé à l'ADMIN en écriture.
  // ----------------------------------------------------------------

  eleves(): Observable<EleveVue[]> {
    return this.http.get<EleveVue[]>('/api/eleves');
  }

  creerEleve(demande: DemandeEleve): Observable<EleveVue> {
    return this.http.post<EleveVue>('/api/eleves', demande);
  }

  modifierEleve(id: number, demande: DemandeEleve): Observable<EleveVue> {
    return this.http.put<EleveVue>(`/api/eleves/${id}`, demande);
  }

  archiverEleve(id: number): Observable<EleveVue> {
    return this.http.post<EleveVue>(`/api/eleves/${id}/archivage`, {});
  }

  desarchiverEleve(id: number): Observable<EleveVue> {
    return this.http.delete<EleveVue>(`/api/eleves/${id}/archivage`);
  }

  // ----------------------------------------------------------------
  //  Inscription d'un élève dans une formation (cursus), réservée à l'ADMIN.
  // ----------------------------------------------------------------

  inscrireCursus(demande: {
    eleveId: number; saisonId: number; niveau: 'N1' | 'N2' | 'N3'; moniteurReferentId?: number | null;
  }): Observable<CursusVue> {
    return this.http.post<CursusVue>('/api/cursus', demande);
  }

  modifierCursus(id: number, demande: {
    moniteurReferentId: number | null; statut: string;
  }): Observable<CursusVue> {
    return this.http.put<CursusVue>(`/api/cursus/${id}`, demande);
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
