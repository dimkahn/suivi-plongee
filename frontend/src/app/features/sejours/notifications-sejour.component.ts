import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { NotificationsDuSejour } from './notifications-du-sejour';

/**
 * L'encart « Notifications » d'un participant, sur la page du lien comme
 * dans le séjour de l'appli : les activer sur ce téléphone, les couper, ou
 * ce qui manque (iPhone hors de l'appli installée, autorisation refusée).
 * Rien quand le navigateur ne sait pas en recevoir.
 */
@Component({
  selector: 'app-notifications-sejour',
  template: `
    @switch (notifications().etat()) {
      @case ('a-activer') {
        <div class="encart-notifications">
          <p>Recevez un message sur ce téléphone quand l'organisateur ajoute des informations au séjour.</p>
          <button type="button" class="bouton-principal activer-notifications" (click)="notifications().activer()"
                  [disabled]="notifications().envoi()">Activer les notifications</button>
        </div>
      }
      @case ('activees') {
        <div class="encart-notifications actives">
          <span>🔔 Notifications du séjour activées sur ce téléphone.</span>
          <button type="button" class="bouton-discret" (click)="notifications().couper()"
                  [disabled]="notifications().envoi()">Couper</button>
        </div>
      }
      @case ('refusees') {
        <p class="encart-notifications secondaire">Notifications bloquées pour ce site : autorisez-les dans les réglages
          du navigateur pour être prévenu des nouvelles du séjour.</p>
      }
      @case ('installer-d-abord') {
        <p class="encart-notifications secondaire">Pour être prévenu des nouvelles du séjour sur iPhone : installez
          l'appli sur l'écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil »), ouvrez-la, et activez les
          notifications.</p>
      }
    }
    @if (notifications().erreur(); as m) { <div class="alerte" role="alert">{{ m }}</div> }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .encart-notifications {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--pas);
      margin: var(--pas-2) 0; padding: var(--pas-2); border-radius: var(--r-s); background: var(--fond); border: 1px solid var(--trait);
    }
    .encart-notifications p { margin: 0; flex: 1 1 16rem; }
    .actives { padding: var(--pas) var(--pas-2); }
  `]
})
export class NotificationsSejourComponent {
  readonly notifications = input.required<NotificationsDuSejour>();
}
