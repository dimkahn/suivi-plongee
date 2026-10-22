import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
  MAGASIN_CACHE, MAGASIN_REFUS_SEJOUR, MAGASIN_SEJOUR, ecrire, lire, lireTout, nouvelleReference, supprimer
} from '../../core/base-locale';
import { SejourVue } from './sejour-api';
import {
  ModificationEnAttente, ModificationRefusee, NouvelleModification, cleSejour, issueEchec, lectureEchouee, ranger,
  remplacerParticipant, requete
} from './sejour-hors-ligne';

/** Issue d'une modification du séjour, pour l'écran qui l'attend. */
export type IssueSejour<T = unknown> =
  | { etat: 'envoyee'; reponse: T | null }
  /** Gardée sur le téléphone : elle partira au retour du réseau. */
  | { etat: 'en-attente' }
  | { etat: 'refusee'; raison: string };

/** Une lecture, et la date de la copie du téléphone quand le réseau manquait (null : lue sur le serveur). */
export interface LectureAvecCopie<T> {
  valeur: T;
  copieDu: number | null;
}

interface Copie<T> { cle: string; valeur: T; majLe: number; }

/**
 * Le séjour sans réseau : la copie de ce qui a été lu, et la file des
 * modifications faites hors ligne (organisation, mes informations, frais),
 * rejouées dans l'ordre de leur saisie au retour du réseau. Comme les
 * fiches de sécurité ({@link FileEcrituresService}) : une file, jamais un
 * cache d'écriture ; un refus différé remonte au bandeau de synchronisation,
 * un refus immédiat est rendu à l'écran. La logique pure (rangement,
 * requêtes, séjour montré) est dans `sejour-hors-ligne.ts`.
 */
@Injectable({ providedIn: 'root' })
export class FileSejourService {
  private http = inject(HttpClient);

  readonly enAttente = signal<ModificationEnAttente[]>([]);
  readonly refus = signal<ModificationRefusee[]>([]);
  readonly synchronisation = signal(false);
  /** Le séjour renvoyé par le dernier envoi réussi, pour l'écran ouvert. */
  readonly sejourAJour = signal<SejourVue | null>(null);

  private demarree = false;
  /** Un envoi à la fois : la file part dans l'ordre, jamais deux fois en même temps. */
  private verrou: Promise<unknown> = Promise.resolve();

  async demarrer(): Promise<void> {
    if (this.demarree) return;
    this.demarree = true;
    await this.relire();
    window.addEventListener('online', () => void this.vider());
    setInterval(() => { if (navigator.onLine && this.enAttente().length > 0) void this.vider(); }, 60_000);
    if (navigator.onLine) void this.vider();
  }

  /** Les modifications qui attendent pour un séjour. */
  pour(sejourId: number): ModificationEnAttente[] {
    return this.enAttente().filter(e => e.sejourId === sejourId);
  }

  /**
   * Garde la modification sur le téléphone puis, si le réseau semble là,
   * envoie ce qui attend pour ce séjour, elle comprise, dans l'ordre.
   */
  enregistrer<T = SejourVue>(n: NouvelleModification): Promise<IssueSejour<T>> {
    return this.exclusif(async () => {
      const avant = await lireTout<ModificationEnAttente>(MAGASIN_SEJOUR);
      const apres = ranger(avant, n, nouvelleReference(), Date.now());
      await this.ecrireFile(avant, apres);
      const visee = apres.find(e => !avant.some(a => a.cle === e.cle && a.majLe === e.majLe));
      if (!navigator.onLine) return { etat: 'en-attente' };
      return this.envoyerSejour<T>(n.sejourId, visee?.cle ?? null);
    });
  }

  vider(): Promise<void> {
    return this.exclusif(async () => {
      const sejours = [...new Set(this.enAttente().map(e => e.sejourId))];
      if (sejours.length === 0) return;
      this.synchronisation.set(true);
      try {
        for (const id of sejours) await this.envoyerSejour(id, null);
      } finally {
        this.synchronisation.set(false);
      }
    });
  }

  async ecarterRefus(cle: string): Promise<void> {
    await supprimer(MAGASIN_REFUS_SEJOUR, cle);
    await this.relire();
  }

  /**
   * Réseau d'abord, copie du téléphone en repli : le séjour se consulte
   * sans réseau. Un refus du serveur (plus participant, séjour supprimé)
   * efface la copie : ce qu'on n'a plus le droit de lire ne reste pas.
   */
  async lireAvecCopie<T>(cle: string, appel: () => Observable<T>): Promise<LectureAvecCopie<T>> {
    try {
      const valeur = await firstValueFrom(appel());
      await ecrire<Copie<T>>(MAGASIN_CACHE, { cle, valeur, majLe: Date.now() });
      return { valeur, copieDu: null };
    } catch (e) {
      const action = lectureEchouee((e as HttpErrorResponse).status ?? 0);
      if (action === 'copie') {
        const copie = await lire<Copie<T>>(MAGASIN_CACHE, cle);
        if (copie) return { valeur: copie.valeur, copieDu: copie.majLe };
      } else if (action === 'effacer') {
        await supprimer(MAGASIN_CACHE, cle);
      }
      throw e;
    }
  }

  /** Efface la copie d'une lecture (déconnexion du lien d'un séjour). */
  oublierCopie(cle: string): Promise<undefined> {
    return supprimer(MAGASIN_CACHE, cle);
  }

  /**
   * Envoie dans l'ordre ce qui attend pour un séjour ; s'arrête au premier
   * envoi resté sans réponse. Rend l'issue de la modification visée (null :
   * aucune, un envoi de fond) ; un autre refus va au bandeau.
   */
  private async envoyerSejour<T>(sejourId: number, visee: string | null): Promise<IssueSejour<T>> {
    let issueVisee: IssueSejour<T> = { etat: 'envoyee', reponse: null };
    const file = (await lireTout<ModificationEnAttente>(MAGASIN_SEJOUR))
      .filter(e => e.sejourId === sejourId).sort((a, b) => a.ordre - b.ordre);
    for (const original of file) {
      // Un participant ajouté juste avant a pu changer d'id : relire l'entrée.
      const entree = await lire<ModificationEnAttente>(MAGASIN_SEJOUR, original.cle);
      if (!entree) continue;
      const issue = await this.envoyerUne<T>(entree);
      if (issue.etat === 'en-attente') {
        await this.relire();
        return { etat: 'en-attente' };
      }
      if (issue.etat === 'refusee' && entree.cle !== visee) {
        await ecrire<ModificationRefusee>(MAGASIN_REFUS_SEJOUR, { ...entree, raison: issue.raison, refuseeLe: Date.now() });
      }
      await this.retirerSiInchangee(entree);
      if (entree.cle === visee) issueVisee = issue;
    }
    await this.relire();
    return issueVisee;
  }

  private async envoyerUne<T>(entree: ModificationEnAttente): Promise<IssueSejour<T>> {
    const r = requete(entree.sejourId, entree.modification);
    const avant = await lire<Copie<SejourVue>>(MAGASIN_CACHE, cleSejour(entree.sejourId));
    try {
      const reponse = await firstValueFrom(this.http.request<T>(r.methode, r.url, {
        body: r.corps ?? undefined,
        headers: new HttpHeaders(r.creation ? { 'X-Reference-Client': entree.reference } : {})
      }));
      // Une dépense créée rend { depenseId, sejour } ; tout le reste, le séjour.
      const sejour = ((reponse as { sejour?: SejourVue }).sejour ?? reponse) as SejourVue;
      await ecrire<Copie<SejourVue>>(MAGASIN_CACHE, { cle: cleSejour(entree.sejourId), valeur: sejour, majLe: Date.now() });
      if (entree.modification.type === 'participant' && entree.idProvisoire !== null) {
        await this.reporterVraiId(entree, avant?.valeur ?? null, sejour);
      }
      this.sejourAJour.set(sejour);
      return { etat: 'envoyee', reponse };
    } catch (e) {
      const err = e as HttpErrorResponse;
      const issue = issueEchec(err.status ?? 0, r.methode);
      if (issue === 'en-attente') return { etat: 'en-attente' };
      if (issue === 'deja-faite') return { etat: 'envoyee', reponse: null };
      return { etat: 'refusee', raison: err.error?.detail ?? `${entree.libelle} : enregistrement refusé.` };
    }
  }

  /**
   * Le participant ajouté sans réseau a maintenant son vrai id (le nouveau
   * venu de ce nom dans le séjour renvoyé) : ce qui le cite encore par l'id
   * provisoire le cite par le vrai.
   */
  private async reporterVraiId(entree: ModificationEnAttente, avant: SejourVue | null, apres: SejourVue): Promise<void> {
    if (entree.modification.type !== 'participant') return;
    const d = entree.modification.demande;
    const connus = new Set(avant?.participants.map(p => p.id) ?? []);
    const nouveaux = apres.participants.filter(p => !connus.has(p.id));
    const reel = (nouveaux.find(p => p.nom === d.nom && p.prenom === d.prenom) ?? (nouveaux.length === 1 ? nouveaux[0] : null))?.id;
    if (reel === undefined) return;
    for (const e of await lireTout<ModificationEnAttente>(MAGASIN_SEJOUR)) {
      if (e.sejourId !== entree.sejourId || e.cle === entree.cle) continue;
      await ecrire(MAGASIN_SEJOUR, { ...e, modification: remplacerParticipant(e.modification, entree.idProvisoire!, reel) });
    }
  }

  private async ecrireFile(avant: ModificationEnAttente[], apres: ModificationEnAttente[]): Promise<void> {
    for (const e of avant) if (!apres.some(a => a.cle === e.cle)) await supprimer(MAGASIN_SEJOUR, e.cle);
    for (const e of apres) if (!avant.some(a => a.cle === e.cle && a.majLe === e.majLe)) await ecrire(MAGASIN_SEJOUR, e);
    await this.relire();
  }

  private async retirerSiInchangee(e: ModificationEnAttente): Promise<void> {
    const actuelle = await lire<ModificationEnAttente>(MAGASIN_SEJOUR, e.cle);
    if (actuelle && actuelle.majLe === e.majLe) await supprimer(MAGASIN_SEJOUR, e.cle);
  }

  private async relire(): Promise<void> {
    this.enAttente.set((await lireTout<ModificationEnAttente>(MAGASIN_SEJOUR)).sort((a, b) => a.ordre - b.ordre));
    this.refus.set(await lireTout<ModificationRefusee>(MAGASIN_REFUS_SEJOUR));
  }

  private exclusif<T>(action: () => Promise<T>): Promise<T> {
    const suite = this.verrou.then(action, action);
    this.verrou = suite.catch(() => undefined);
    return suite;
  }
}
