import { signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { Observable, firstValueFrom } from 'rxjs';
import { MAGASIN_CACHE, ecrire, lire, supprimer } from '../../core/base-locale';
import { AbonnementServeur, EtatNotifications, abonnementPourServeur, etatNotifications, iphoneHorsAppli } from './notifications-telephone';

/** L'abonnement de ce téléphone, enregistré par la page du lien (jeton) ou par le séjour de l'appli (compte). */
export interface PortNotifications {
  activer(a: AbonnementServeur): Observable<void>;
  couper(endpoint: string): Observable<void>;
}

/**
 * Les notifications du séjour sur ce téléphone, pour la page du lien comme
 * pour le séjour dans l'appli (`NotificationsSejourComponent`). Le
 * navigateur garde un seul abonnement, partagé par tous les séjours : le
 * couper pour un séjour le retire seulement du serveur pour celui-ci.
 * Retenu sur le téléphone (IndexedDB) : l'adresse abonnée pour ce séjour.
 */
export class NotificationsDuSejour {
  readonly etat = signal<EtatNotifications>('indisponibles');
  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  private readonly cle: string;

  /** {@code sejour} : le code de l'adresse (page du lien) ou l'id du séjour (appli). */
  constructor(private swPush: SwPush, private http: HttpClient, private port: PortNotifications, sejour: string) {
    this.cle = `notifications-sejour:${sejour}`;
    void this.lire();
  }

  async activer(): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const { clePublique } = await firstValueFrom(this.http.get<{ clePublique: string }>('/api/public/notifications/cle'));
      const abonnement = await this.swPush.requestSubscription({ serverPublicKey: clePublique });
      const a = abonnementPourServeur(abonnement.toJSON());
      if (!a) throw new Error('abonnement incomplet');
      await firstValueFrom(this.port.activer(a));
      await ecrire(MAGASIN_CACHE, { cle: this.cle, valeur: a.endpoint });
    } catch (e) {
      this.erreur.set(e instanceof HttpErrorResponse
        ? e.error?.detail ?? 'Les notifications n\'ont pas pu être activées (réseau nécessaire).'
        : Notification.permission === 'denied'
          ? 'Notifications refusées : autorisez-les dans les réglages du navigateur pour ce site.'
          : 'Ce téléphone n\'a pas pu activer les notifications.');
    } finally {
      this.envoi.set(false);
      await this.lire();
    }
  }

  async couper(): Promise<void> {
    this.envoi.set(true);
    this.erreur.set(null);
    try {
      const endpoint = (await lire<{ cle: string; valeur: string }>(MAGASIN_CACHE, this.cle))?.valeur;
      if (endpoint) await firstValueFrom(this.port.couper(endpoint));
      await supprimer(MAGASIN_CACHE, this.cle);
    } catch (e) {
      this.erreur.set((e as HttpErrorResponse).error?.detail ?? 'Les notifications n\'ont pas pu être coupées (réseau nécessaire).');
    } finally {
      this.envoi.set(false);
      await this.lire();
    }
  }

  /** L'état de ce téléphone : abonné pour ce séjour si l'adresse retenue est encore celle du navigateur. */
  private async lire(): Promise<void> {
    const pushPossible = this.swPush.isEnabled && typeof Notification !== 'undefined';
    let activees = false;
    if (pushPossible) {
      const retenue = (await lire<{ cle: string; valeur: string }>(MAGASIN_CACHE, this.cle).catch(() => undefined))?.valeur;
      const actuelle = await firstValueFrom(this.swPush.subscription).catch(() => null);
      activees = !!retenue && actuelle?.endpoint === retenue;
    }
    this.etat.set(etatNotifications({
      pushPossible, iphoneHorsAppli: iphoneHorsAppli(), activees,
      permission: typeof Notification === 'undefined' ? 'default' : Notification.permission
    }));
  }
}
