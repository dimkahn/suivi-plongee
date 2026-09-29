import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Vérification périodique tant que l'application reste ouverte. */
const INTERVALLE_VERIFICATION_MS = 15 * 60 * 1000;

/**
 * Nouvelles versions de l'application.
 *
 * Le service worker garde la version installée pour que l'appli s'ouvre
 * hors ligne ; une nouvelle version se télécharge en arrière-plan mais ne
 * s'applique pas d'elle-même. Sans ce service, il fallait fermer tous les
 * onglets, voire vider le cache, pour la voir. Ici on cherche une mise à jour
 * à l'ouverture, au retour sur l'appli et toutes les 15 minutes, puis on
 * propose de recharger : pas de rechargement imposé, un moniteur peut être
 * en pleine saisie (les saisies en file, elles, sont dans IndexedDB et
 * survivent au rechargement).
 */
@Injectable({ providedIn: 'root' })
export class MiseAJourService {
  private sw = inject(SwUpdate);

  /** Une nouvelle version est téléchargée et prête à être appliquée. */
  readonly disponible = signal(false);

  demarrer(): void {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.subscribe(evt => {
      if (evt.type === 'VERSION_READY') this.disponible.set(true);
    });
    // Cache du navigateur incohérent (fichiers d'une version effacés) :
    // seule issue, recharger depuis le serveur.
    this.sw.unrecoverable.subscribe(() => location.reload());

    this.verifier();
    setInterval(() => this.verifier(), INTERVALLE_VERIFICATION_MS);
    // Sur téléphone, l'appli reste souvent en arrière-plan des jours entiers.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.verifier();
    });
  }

  async appliquer(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      location.reload();
    }
  }

  private verifier(): void {
    if (!navigator.onLine) return;
    this.sw.checkForUpdate().catch(() => { /* réseau capricieux : on réessaiera */ });
  }
}
