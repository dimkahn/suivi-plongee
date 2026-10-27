import { describe, expect, it } from 'vitest';
import { texteBilanParametres } from './envoi-parametres';

describe('texteBilanParametres', () => {
  it('dit à qui les paramètres sont partis, avec le nombre de plongées, et qui n’a rien reçu', () => {
    expect(texteBilanParametres({
      envoyes: [{ nom: 'Inès Roux', email: 'ines@exemple.fr', nombrePlongees: 3 },
        { nom: 'Sami Morel', email: 'sami@exemple.fr', nombrePlongees: 1 }],
      sansEmail: ['Léo Durand'],
      sansPlongee: ['Zoé Lenoir'],
      echecs: []
    })).toBe('Paramètres envoyés à : Inès Roux (3 plongées), Sami Morel (1 plongée). '
      + 'Dans aucune palanquée des fiches de sécurité : Zoé Lenoir. Sans e-mail : Léo Durand.');
  });

  it('dit qu’aucun e-mail n’est parti', () => {
    expect(texteBilanParametres({ envoyes: [], sansEmail: [], sansPlongee: ['Zoé Lenoir'], echecs: ['Paul'] }))
      .toBe("Aucun e-mail envoyé. Dans aucune palanquée des fiches de sécurité : Zoé Lenoir. Échec de l'envoi pour : Paul.");
  });
});
