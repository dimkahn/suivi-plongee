import { effect, inject, untracked } from '@angular/core';
import { FileEcrituresService } from '../../core/file-ecritures.service';
import { ReseauService } from '../../core/reseau.service';

/**
 * Relit la liste des fiches du séjour quand le réseau part ou revient et quand
 * la file du téléphone change : sans réseau, elle passe sur sa copie et ne
 * propose plus de signer ; au retour, elle quitte sa copie et montre ce qui
 * vient de partir. À appeler dans le constructeur d'un composant.
 */
export function relireSelonLeReseau(relire: () => void): void {
  const reseau = inject(ReseauService);
  const file = inject(FileEcrituresService);
  let premiere = true;
  effect(() => {
    reseau.enLigne();
    file.enAttente().length;
    untracked(() => {
      if (!premiere) relire();
      premiere = false;
    });
  });
}
