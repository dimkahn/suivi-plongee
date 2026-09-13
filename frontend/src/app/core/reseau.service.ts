import { Injectable, signal } from '@angular/core';

/**
 * État du réseau tel que le navigateur le rapporte.
 *
 * `navigator.onLine` ment régulièrement : il dit « en ligne » derrière un
 * portail captif ou un wifi de piscine qui ne route rien. On s'en sert pour
 * l'affichage et pour déclencher une tentative, jamais pour décider qu'un
 * envoi a réussi — seule une réponse du serveur fait foi.
 */
@Injectable({ providedIn: 'root' })
export class ReseauService {
  readonly enLigne = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.enLigne.set(true));
    window.addEventListener('offline', () => this.enLigne.set(false));
  }
}
