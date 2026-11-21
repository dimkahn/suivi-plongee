import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationService } from './navigation';

/**
 * « Comment faire ? » : le bouton est dans le bandeau du haut (connecté) ou
 * dans la barre de la page (sans compte) ; la fenêtre des manuels, elle, est
 * toujours celle de la barre de la page (core/barre-page.component.ts).
 */
@Injectable({ providedIn: 'root' })
export class AideEcranService {
  private navigation = inject(NavigationService);

  /** Chaque appui l'incrémente : la barre de la page ouvre alors sa fenêtre. */
  readonly demande = signal(0);
  /** La page Aide est elle-même l'aide. */
  readonly disponible = computed(() => this.navigation.chemin() !== '/aide');

  ouvrir(): void {
    this.demande.update(n => n + 1);
  }
}
