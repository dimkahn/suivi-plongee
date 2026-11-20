import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { Atelier, FicheSecuriteVue, MoniteurOptionVue, PalanqueeVue, PlongeurVue, StatutPresence } from './modeles';
import { MAGASIN_CACHE, MAGASIN_ECRITURES, MAGASIN_REFUS_ECRITURES, ecrire, lire, lireTout, supprimer } from './base-locale';
import { EcriturePlongee, estProvisoire, rattacherALaSeance } from './plongee-imprevue';

/** Établissement de la fiche de sécurité : DP, conditions, composition et profil prévu. */
export interface DemandeFicheSecurite {
  dpId: number;
  /** Site de plongée de la séance, changé avec la fiche ; absent d'une fiche gardée avant son ajout : inchangé. */
  site?: string | null;
  meteo?: string | null;
  etatMer?: string | null;
  visibilite?: string | null;
  courant?: string | null;
  maree?: string | null;
  temperatureEau?: string | null;
  securiteSurface?: string | null;
  planSecours?: string | null;
  observations?: string | null;
  palanquees: { numero: number; profondeurPrevue: number | null; dureePrevue: number | null; membres: PlongeurVue[] }[];
}

/** Profil réellement plongé, palanquée par palanquée (repérée par son numéro). */
export interface ProfilRealise {
  numero: number;
  profondeurRealisee: number | null;
  dureeRealisee: number | null;
  paliers: string | null;
  heureImmersion: string | null;
  heureSortie: string | null;
}

/** Une plongée ajoutée à un séjour ; {@code ordre} null : la suivante de ce jour-là. */
export interface DemandePlongee {
  date: string;
  ordre: number | null;
  milieu: 'NATUREL' | 'ARTIFICIEL';
  lieu: string | null;
  site: string | null;
  profondeurMax: number | null;
  commentaire: string | null;
}

/**
 * Une écriture qui remplace un état côté serveur. Rejouer la même écriture
 * donne le même résultat : c'est ce qui permet de la garder hors ligne.
 * Un statut de présence nul veut dire « effacer ».
 */
export type Ecriture =
  | { type: 'presence'; seanceId: number; cursusId: number; statut: StatutPresence | null; atelier: Atelier | null;
      /** Théorie en plus de la nage ou du bloc ; absent d'une écriture gardée avant son ajout. */
      theorie?: boolean }
  | { type: 'fiche'; seanceId: number; demande: DemandeFicheSecurite }
  | { type: 'realise'; seanceId: number; profils: ProfilRealise[] }
  /**
   * Plongée imprévue d'un séjour, ajoutée sans réseau : `seanceId` est son n°
   * provisoire (`core/plongee-imprevue.ts`), `reference` la fait créer une
   * seule fois même rejouée. Sa fiche et son profil réalisé attendent derrière.
   */
  | { type: 'plongee'; seanceId: number; sortieId: number; reference: string; demande: DemandePlongee };

export interface EcritureEnAttente {
  /** Une entrée par cible : un nouveau choix remplace le précédent, rien ne s'empile. */
  cle: string;
  ecriture: Ecriture;
  /** Dit à qui et à quoi se rapporte l'écriture, pour le bandeau en cas de refus. */
  libelle: string;
  dateSeance: string;
  /**
   * Rang d'envoi : celui de la première version en attente pour cette cible.
   * Une fiche corrigée après la saisie du profil réalisé reste ainsi envoyée
   * avant lui, comme le serveur l'exige.
   */
  ordre: number;
  /** Version : un envoi ne retire l'entrée que si elle n'a pas changé entre-temps. */
  majLe: number;
}

export interface EcritureRefusee extends EcritureEnAttente {
  raison: string;
  refuseeLe: number;
}

/** Issue d'un envoi immédiat, quand l'écran attend la réponse du serveur. */
export type IssueEnvoi<T = unknown> =
  | { etat: 'envoyee'; reponse: T }
  | { etat: 'en-attente' }
  | { etat: 'refusee'; raison: string };

export function cleEcriture(e: Ecriture): string {
  return e.type === 'presence' ? `presence:${e.seanceId}:${e.cursusId}` : `${e.type}:${e.seanceId}`;
}

function clePlongeeCreee(provisoire: number): string {
  return `plongee-creee:${provisoire}`;
}

/**
 * File des écritures d'état hors ligne : présences, fiche de sécurité,
 * profil réalisé. Contrairement aux évaluations (table en ajout seul, voir
 * {@link FileAttenteService}), ces écritures remplacent un état et sont
 * idempotentes côté serveur : on ne garde que la dernière version par cible,
 * rejouée au retour du réseau.
 *
 * Même politique pour les refus : un refus différé n'est jamais absorbé, il
 * remonte dans le bandeau de synchronisation. Un refus immédiat, lui, est
 * rendu à l'écran qui l'affiche tout de suite.
 */
@Injectable({ providedIn: 'root' })
export class FileEcrituresService {
  private http = inject(HttpClient);

  readonly enAttente = signal<EcritureEnAttente[]>([]);
  readonly refus = signal<EcritureRefusee[]>([]);
  readonly synchronisation = signal(false);

  private demarree = false;
  private envoiEnCours: Promise<void> | null = null;
  private relancer = false;

  async demarrer(): Promise<void> {
    if (this.demarree) return;
    this.demarree = true;
    await this.relire();
    window.addEventListener('online', () => void this.vider());
    setInterval(() => { if (navigator.onLine) void this.vider(); }, 60_000);
    if (navigator.onLine) void this.vider();
  }

  /** Écritures en attente pour une séance, d'un type donné. */
  pourSeance<T extends Ecriture['type']>(seanceId: number, type: T): Extract<Ecriture, { type: T }>[] {
    return this.enAttente()
      .map(e => e.ecriture)
      .filter((e): e is Extract<Ecriture, { type: T }> => e.type === type && e.seanceId === seanceId);
  }

  /**
   * Garde l'écriture sur l'appareil, puis, si le réseau semble là, tente
   * aussitôt de l'envoyer, précédée de ce qui attend déjà pour la même
   * séance (une fiche avant son profil réalisé).
   */
  async enregistrer<T = unknown>(ecriture: Ecriture, libelle: string, dateSeance: string): Promise<IssueEnvoi<T>> {
    // Une plongée imprévue déjà créée entre-temps : l'écriture va à sa vraie séance.
    if (ecriture.type !== 'plongee' && estProvisoire(ecriture.seanceId)) {
      const creee = await this.seanceCreee(ecriture.seanceId);
      if (creee !== undefined) ecriture = { ...ecriture, seanceId: creee };
    }
    const cle = cleEcriture(ecriture);
    const precedente = await lire<EcritureEnAttente>(MAGASIN_ECRITURES, cle);
    const maintenant = Date.now();
    const entree: EcritureEnAttente = {
      cle, ecriture, libelle, dateSeance, ordre: precedente?.ordre ?? maintenant, majLe: maintenant
    };
    await ecrire(MAGASIN_ECRITURES, entree);
    await this.relire();
    if (!navigator.onLine) return { etat: 'en-attente' };
    // La fiche d'une plongée imprévue part derrière elle, avec toute la file.
    if (ecriture.type !== 'plongee' && estProvisoire(ecriture.seanceId)) {
      void this.vider();
      return { etat: 'en-attente' };
    }

    // Ce qui attend avant elle pour la même séance part d'abord.
    const avant = this.enAttente()
      .filter(e => e.ecriture.seanceId === ecriture.seanceId && e.cle !== cle && e.ordre < entree.ordre)
      .sort((a, b) => a.ordre - b.ordre);
    for (const e of avant) {
      const issue = await this.envoyerUne(e);
      if (issue.etat === 'en-attente') return issue;
      await this.solder(e, issue);
    }

    const issue = await this.envoyerUne<T>(entree);
    if (issue.etat === 'envoyee') await this.apresEnvoi(entree, issue.reponse);
    if (issue.etat !== 'en-attente') await this.retirerSiInchangee(entree);
    await this.relire();
    return issue;
  }

  /** La plongée imprévue qui attend le réseau sous ce n° provisoire, s'il y en a une. */
  plongeeEnAttente(seanceId: number): EcriturePlongee | undefined {
    return this.pourSeance(seanceId, 'plongee').at(0);
  }

  /** Le vrai n° de séance d'une plongée imprévue, une fois créée par le serveur. */
  async seanceCreee(provisoire: number): Promise<number | undefined> {
    return (await lire<{ cle: string; valeur: number }>(MAGASIN_CACHE, clePlongeeCreee(provisoire)))?.valeur;
  }

  async vider(): Promise<void> {
    if (this.envoiEnCours) {
      this.relancer = true;
      return this.envoiEnCours;
    }
    this.envoiEnCours = this.envoyerTout();
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

  async ecarterRefus(cle: string): Promise<void> {
    await supprimer(MAGASIN_REFUS_ECRITURES, cle);
    await this.relire();
  }

  /**
   * La fiche telle que le moniteur l'a laissée sur cet appareil : ce que le
   * serveur (ou le cache) connaît, recouvert par l'établissement et le profil
   * réalisé pas encore partis. `enAttente` dit si quelque chose reste à envoyer.
   */
  ficheAJour(seanceId: number, fiche: FicheSecuriteVue, moniteurs: MoniteurOptionVue[] = [])
      : { fiche: FicheSecuriteVue; enAttente: boolean; etablie: boolean } {
    const etablissement = this.pourSeance(seanceId, 'fiche').at(0);
    const realise = this.pourSeance(seanceId, 'realise').at(0);
    let resultat = fiche;
    if (etablissement) {
      const d = etablissement.demande;
      const connues = new Map(fiche.palanquees.map(p => [p.numero, p]));
      resultat = {
        ...fiche,
        dpId: d.dpId,
        dp: moniteurs.find(m => m.id === d.dpId)?.nomComplet ?? (d.dpId === fiche.dpId ? fiche.dp : null),
        meteo: d.meteo ?? null, etatMer: d.etatMer ?? null, visibilite: d.visibilite ?? null,
        courant: d.courant ?? null, maree: d.maree ?? null, temperatureEau: d.temperatureEau ?? null,
        securiteSurface: d.securiteSurface ?? null, planSecours: d.planSecours ?? null,
        observations: d.observations ?? null,
        palanquees: d.palanquees.map(p => ({
          ...palanqueeSansRealise(p.numero), ...realiseDe(connues.get(p.numero)),
          numero: p.numero, profondeurPrevue: p.profondeurPrevue, dureePrevue: p.dureePrevue, membres: p.membres
        }))
      };
    }
    if (realise) {
      const profils = new Map(realise.profils.map(p => [p.numero, p]));
      resultat = {
        ...resultat,
        palanquees: resultat.palanquees.map(p => ({ ...p, ...(profils.get(p.numero) ?? {}) }))
      };
    }
    return {
      fiche: resultat,
      enAttente: !!(etablissement || realise),
      etablie: fiche.id !== null || !!etablissement
    };
  }

  private async envoyerTout(): Promise<void> {
    const file = [...this.enAttente()].sort((a, b) => a.ordre - b.ordre);
    if (file.length === 0) return;
    this.synchronisation.set(true);
    try {
      for (const entree of file) {
        const issue = await this.envoyerUne(entree);
        // Serveur injoignable : inutile d'insister, on retentera au prochain réveil.
        if (issue.etat === 'en-attente') break;
        if (issue.etat === 'envoyee') await this.apresEnvoi(entree, issue.reponse);
        await this.solder(entree, issue);
        // Une plongée imprévue créée : sa fiche a changé de clé, la file se relit.
        if (entree.ecriture.type === 'plongee') {
          this.relancer = true;
          break;
        }
      }
    } finally {
      this.synchronisation.set(false);
      await this.relire();
    }
  }

  /**
   * Envoi différé terminé : un refus va au bandeau, puis l'entrée quitte la file.
   * Une plongée imprévue refusée emporte au bandeau sa fiche et son profil réalisé,
   * qui n'ont plus de séance où partir.
   */
  private async solder(entree: EcritureEnAttente, issue: IssueEnvoi): Promise<void> {
    if (issue.etat === 'refusee') {
      await ecrire<EcritureRefusee>(MAGASIN_REFUS_ECRITURES,
        { ...entree, raison: issue.raison, refuseeLe: Date.now() });
      if (entree.ecriture.type === 'plongee') {
        for (const e of this.enAttente().filter(x => x.ecriture.seanceId === entree.ecriture.seanceId && x.cle !== entree.cle)) {
          await ecrire<EcritureRefusee>(MAGASIN_REFUS_ECRITURES, {
            ...e, raison: `La plongée imprévue n'a pas été créée : ${issue.raison}`, refuseeLe: Date.now()
          });
          await supprimer(MAGASIN_ECRITURES, e.cle);
        }
      }
    }
    await this.retirerSiInchangee(entree);
  }

  /**
   * Une plongée imprévue créée : son vrai n° est gardé (l'écran ouvert sous le
   * provisoire s'y retrouve), et ce qui l'attendait passe sur sa séance.
   */
  private async apresEnvoi(entree: EcritureEnAttente, reponse: unknown): Promise<void> {
    if (entree.ecriture.type !== 'plongee') return;
    const reelle = (reponse as { plongeeAjoutee?: number | null } | null)?.plongeeAjoutee;
    if (reelle === undefined || reelle === null) return;
    const provisoire = entree.ecriture.seanceId;
    await ecrire(MAGASIN_CACHE, { cle: clePlongeeCreee(provisoire), valeur: reelle, majLe: Date.now() });
    const { retirees, rattachees } = rattacherALaSeance(
      await lireTout<EcritureEnAttente>(MAGASIN_ECRITURES), provisoire, reelle);
    for (const e of rattachees) await ecrire(MAGASIN_ECRITURES, e);
    for (const cle of retirees) await supprimer(MAGASIN_ECRITURES, cle);
  }

  private async envoyerUne<T>(entree: EcritureEnAttente): Promise<IssueEnvoi<T>> {
    try {
      const reponse = await firstValueFrom(this.requete(entree.ecriture) as Observable<T>);
      return { etat: 'envoyee', reponse };
    } catch (e) {
      const err = e as HttpErrorResponse;
      // Pas de réponse, erreur serveur ou session à rouvrir : l'écriture reste sur l'appareil.
      if (err.status === 0 || err.status === 401 || err.status >= 500) return { etat: 'en-attente' };
      return { etat: 'refusee', raison: err.error?.detail ?? `${entree.libelle} : enregistrement refusé.` };
    }
  }

  private requete(e: Ecriture): Observable<unknown> {
    switch (e.type) {
      case 'presence':
        return e.statut === null
          ? this.http.delete(`/api/seances/${e.seanceId}/presences/${e.cursusId}`)
          : this.http.put(`/api/seances/${e.seanceId}/presences`,
              [{ cursusId: e.cursusId, statut: e.statut, atelier: e.atelier, theorie: e.theorie ?? false }]);
      case 'fiche':
        return this.http.put<FicheSecuriteVue>(`/api/seances/${e.seanceId}/fiche-securite`, e.demande);
      case 'realise':
        return this.http.put<FicheSecuriteVue>(`/api/seances/${e.seanceId}/fiche-securite/realise`, e.profils);
      case 'plongee':
        return this.http.post(`/api/sejours/${e.sortieId}/plongees`, e.demande,
          { headers: { 'X-Reference-Client': e.reference } });
    }
  }

  private async retirerSiInchangee(p: EcritureEnAttente): Promise<void> {
    const actuelle = await lire<EcritureEnAttente>(MAGASIN_ECRITURES, p.cle);
    if (actuelle && actuelle.majLe === p.majLe) await supprimer(MAGASIN_ECRITURES, p.cle);
  }

  private async relire(): Promise<void> {
    this.enAttente.set(await lireTout<EcritureEnAttente>(MAGASIN_ECRITURES));
    this.refus.set(await lireTout<EcritureRefusee>(MAGASIN_REFUS_ECRITURES));
  }
}

function palanqueeSansRealise(numero: number): PalanqueeVue {
  return {
    numero, profondeurPrevue: null, dureePrevue: null, profondeurRealisee: null, dureeRealisee: null,
    paliers: null, heureImmersion: null, heureSortie: null, membres: []
  };
}

function realiseDe(p: PalanqueeVue | undefined): Partial<PalanqueeVue> {
  if (!p) return {};
  return {
    profondeurRealisee: p.profondeurRealisee, dureeRealisee: p.dureeRealisee, paliers: p.paliers,
    heureImmersion: p.heureImmersion, heureSortie: p.heureSortie
  };
}
