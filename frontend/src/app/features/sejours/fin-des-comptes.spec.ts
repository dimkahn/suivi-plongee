import { describe, expect, it } from 'vitest';
import { preuveEnAttente, preuvesAConfirmer, texteBilanDecompte } from './fin-des-comptes';
import { FraisVue, PreuveVirementVue } from './sejour-api';

function preuve(id: number, deId: number, aId: number | null, versementId: number | null = null): PreuveVirementVue {
  return { id, deId, aId, montantCentimes: 1000, jour: '2027-06-20', envoyeeLe: '2027-06-20T10:00:00',
           typeContenu: 'image/png', versementId };
}

function frais(preuves: PreuveVirementVue[], confirmables: number[] = []): FraisVue {
  return {
    depenses: [], versements: [], comptes: { totalCentimes: 0, soldes: [], remboursements: [] },
    closLe: null, preuves,
    droits: { moiId: 1, peutAjouter: true, pourLesAutres: false, depensesModifiables: [], versementsSupprimables: [],
              lireNotes: false, exporter: false, clore: false, preuvesConfirmables: confirmables, preuvesRetirables: [] }
  };
}

describe('preuveEnAttente', () => {
  it('trouve la preuve envoyée pour ce remboursement, tant qu’elle n’est pas confirmée', () => {
    const f = frais([preuve(5, 1, 2, 40), preuve(6, 1, 2), preuve(7, 1, null)]);
    expect(preuveEnAttente(f, { deId: 1, aId: 2, montantCentimes: 1000 })?.id).toBe(6);
    expect(preuveEnAttente(f, { deId: 1, aId: null, montantCentimes: 1000 })?.id).toBe(7);
    expect(preuveEnAttente(f, { deId: 3, aId: 2, montantCentimes: 1000 })).toBeUndefined();
  });

  it('le club ne rembourse jamais avec une preuve : rien pour un remboursement venant du club', () => {
    expect(preuveEnAttente(frais([preuve(6, 1, 2)]), { deId: null, aId: 2, montantCentimes: 1000 })).toBeUndefined();
  });
});

describe('preuvesAConfirmer', () => {
  it('ne garde que les preuves que le serveur laisse confirmer', () => {
    expect(preuvesAConfirmer(frais([preuve(5, 1, 2), preuve(6, 3, 1)], [6])).map(p => p.id)).toEqual([6]);
  });
});

describe('texteBilanDecompte', () => {
  it('dit à qui le décompte est parti, qui n’avait rien à régler et qui n’a rien reçu', () => {
    expect(texteBilanDecompte({ envoyes: ['Inès Roux', 'Sami Morel'], sansEmail: ['Léo Durand'], echecs: [],
                                sansFrais: ['Zoé Lenoir'] }))
      .toBe('Décompte envoyé à : Inès Roux, Sami Morel. Sans e-mail : Léo Durand. '
        + 'Aucun frais, rien envoyé : Zoé Lenoir.');
  });

  it('dit qu’aucun e-mail n’est parti', () => {
    expect(texteBilanDecompte({ envoyes: [], sansEmail: [], echecs: ['Paul'], sansFrais: [] }))
      .toBe("Aucun e-mail envoyé. Échec de l'envoi pour : Paul.");
  });
});
