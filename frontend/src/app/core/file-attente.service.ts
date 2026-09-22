import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Statut } from './modeles';
import {
  MAGASIN_ATTENTE, MAGASIN_REFUS, ecrire, lireTout, nouvelleReference, supprimer
} from './base-locale';

export interface SaisieEnAttente {
  referenceClient: string;
  cursusId: number;
  critereId: number;
  seanceId: number | null;
  statut: Statut;
  commentaire: string | null;
  dateEvaluation: string;
  creeLe: number;
  tentatives: number;
}

export interface SaisieRefusee extends SaisieEnAttente {
  raison: string;
  refuseeLe: number;
  eleve?: string;
  libelleCritere?: string;
}

type Etat = 'ACCEPTEE' | 'DEJA_ENREGISTREE' | 'REFUSEE';

interface Resultat {
  referenceClient: string;
  etat: Etat;
  raison: string | null;
  evaluationId: number | null;
}

/**
 * File de saisies hors ligne.
 *
 * Le fonctionnement est délibérément simple : on empile dans IndexedDB, on
 * vide dès qu'un réseau est disponible. Pas d'API Background Sync, dont le
 * support reste partiel sur iOS — un `online` plus un réveil périodique
 * couvrent les mêmes cas et sont vérifiables.
 */
@Injectable({ providedIn: 'root' })
export class FileAttenteService {
  private http = inject(HttpClient);

  readonly enAttente = signal<SaisieEnAttente[]>([]);
  readonly refus = signal<SaisieRefusee[]>([]);
  readonly synchronisation = signal(false);
  readonly derniereSync = signal<number | null>(null);

  private demarree = false;
  /** Envoi en cours, partagé par tous les appelants de {@link vider}. */
  private envoiEnCours: Promise<void> | null = null;
  /** Une saisie est arrivée pendant un envoi : la renvoyer sans attendre le réveil suivant. */
  private relancer = false;

  async demarrer(): Promise<void> {
    if (this.demarree) return;
    this.demarree = true;

    await this.relire();

    window.addEventListener('online', () => void this.vider());
    // Un « online » ne garantit pas que le serveur réponde : un réveil
    // régulier rattrape les portails captifs et les réseaux qui mentent.
    setInterval(() => { if (navigator.onLine) void this.vider(); }, 60_000);

    if (navigator.onLine) void this.vider();
  }

  /**
   * Enregistre la saisie localement puis tente de l'envoyer. Le geste du
   * moniteur est acquis dès l'écriture locale : l'interface n'attend jamais
   * le réseau pour confirmer.
   */
  async empiler(saisie: Omit<SaisieEnAttente, 'referenceClient' | 'creeLe' | 'tentatives'>)
      : Promise<SaisieEnAttente> {
    const complete: SaisieEnAttente = {
      ...saisie,
      referenceClient: nouvelleReference(),
      creeLe: Date.now(),
      tentatives: 0
    };
    await ecrire(MAGASIN_ATTENTE, complete);
    await this.relire();

    if (navigator.onLine) void this.vider();
    return complete;
  }

  /** Les saisies non encore confirmées pour un cursus, à superposer à la grille. */
  pourCursus(cursusId: number): SaisieEnAttente[] {
    return this.enAttente().filter(s => s.cursusId === cursusId);
  }

  /**
   * Attend que cette saisie ait quitté la file (acceptée ou refusée par le
   * serveur). Renvoie false si elle y est encore : hors ligne ou serveur
   * injoignable, elle partira plus tard, sans que l'écran ait à l'attendre.
   */
  async attendreEnvoi(referenceClient: string): Promise<boolean> {
    const enFile = () => this.enAttente().some(s => s.referenceClient === referenceClient);
    // Au plus : l'envoi déjà en cours, puis celui qui contient notre saisie.
    for (let essai = 0; essai < 3 && enFile() && navigator.onLine; essai++) {
      await this.vider();
    }
    return !enFile();
  }

  async vider(): Promise<void> {
    if (this.envoiEnCours) {
      this.relancer = true;
      return this.envoiEnCours;
    }
    this.envoiEnCours = this.envoyer();
    try {
      await this.envoiEnCours;
    } finally {
      this.envoiEnCours = null;
    }
    if (this.relancer) {
      this.relancer = false;
      if (navigator.onLine) await this.vider();
    }
  }

  private async envoyer(): Promise<void> {
    const file = [...this.enAttente()].sort((a, b) => a.creeLe - b.creeLe);
    if (file.length === 0) return;

    this.synchronisation.set(true);
    try {
      const resultats = await firstValueFrom(
        this.http.post<Resultat[]>('/api/synchronisation/evaluations',
          file.map(s => ({
            referenceClient: s.referenceClient,
            cursusId: s.cursusId,
            critereId: s.critereId,
            seanceId: s.seanceId,
            statut: s.statut,
            commentaire: s.commentaire,
            dateEvaluation: s.dateEvaluation
          })))
      );

      for (const r of resultats) {
        const saisie = file.find(s => s.referenceClient === r.referenceClient);
        if (!saisie) continue;

        if (r.etat === 'REFUSEE') {
          // Un refus n'est jamais absorbé : il remonte au moniteur, qui est
          // le seul à pouvoir décider quoi faire d'une évaluation invalide.
          const refusee: SaisieRefusee = {
            ...saisie,
            raison: r.raison ?? 'Saisie refusée par le serveur.',
            refuseeLe: Date.now()
          };
          await ecrire(MAGASIN_REFUS, refusee);
        }
        await supprimer(MAGASIN_ATTENTE, saisie.referenceClient);
      }

      this.derniereSync.set(Date.now());
    } catch {
      // Réseau toujours absent ou serveur indisponible : la file reste
      // intacte et sera retentée au prochain réveil.
      for (const s of file) {
        await ecrire(MAGASIN_ATTENTE, { ...s, tentatives: s.tentatives + 1 });
      }
    } finally {
      this.synchronisation.set(false);
      await this.relire();
    }
  }

  async ecarterRefus(referenceClient: string): Promise<void> {
    await supprimer(MAGASIN_REFUS, referenceClient);
    await this.relire();
  }

  /** Remet un refus dans la file, après correction du contexte par le moniteur. */
  async reessayer(refus: SaisieRefusee, seanceId: number | null): Promise<void> {
    await supprimer(MAGASIN_REFUS, refus.referenceClient);
    await this.empiler({
      cursusId: refus.cursusId,
      critereId: refus.critereId,
      seanceId,
      statut: refus.statut,
      commentaire: refus.commentaire,
      dateEvaluation: refus.dateEvaluation
    });
  }

  private async relire(): Promise<void> {
    this.enAttente.set(await lireTout<SaisieEnAttente>(MAGASIN_ATTENTE));
    this.refus.set(await lireTout<SaisieRefusee>(MAGASIN_REFUS));
  }
}
