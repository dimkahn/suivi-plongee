import { Injectable, signal } from '@angular/core';

/**
 * Sous 860 px, la barre d'onglets du bas de l'écran. Un écran qui a sa
 * propre barre (le séjour : ses cinq sections, demande du club, 2026) la
 * prend le temps qu'il est ouvert ; la barre de l'appli revient quand il se
 * ferme. Le retour « ← … » de la barre de page reste là pour en sortir.
 */
@Injectable({ providedIn: 'root' })
export class BarreDuBasService {
  private readonly prisePar = signal(0);

  /** Vrai tant qu'un écran montre sa propre barre du bas. */
  readonly prise = () => this.prisePar() > 0;

  /** À l'ouverture de l'écran ; rend la fonction qui la libère (à sa fermeture). */
  prendre(): () => void {
    this.prisePar.update(n => n + 1);
    let rendue = false;
    return () => {
      if (rendue) return;
      rendue = true;
      this.prisePar.update(n => n - 1);
    };
  }
}
