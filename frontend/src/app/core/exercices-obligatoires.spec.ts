import { criteresSansObligatoire } from './exercices-obligatoires';

describe('Exercices de maîtrise obligatoires d\'une compétence', () => {
  const criteres = [{ id: 1, savoirFaire: 'Gréage' }, { id: 2, savoirFaire: 'Capelage' }, { id: 3, savoirFaire: 'Départ plage' }];
  const maitrise = (id: number, critereIds: number[], obligatoire: boolean, actif = true) =>
    ({ id, phase: 'MAITRISE' as const, actif, critereIds, obligatoire });

  it('Le MFT veut chaque critère validé : un critère qui a une maîtrise doit en avoir une obligatoire', () => {
    const exercices = [maitrise(17, [1], true), maitrise(18, [2], false)];
    expect(criteresSansObligatoire(criteres, exercices).map(c => c.savoirFaire)).toEqual(['Capelage']);
  });

  it('Un critère sans exercice de maîtrise n\'est pas signalé', () => {
    expect(criteresSansObligatoire(criteres, [maitrise(17, [1, 2], true)])).toEqual([]);
  });

  it('Un exercice obligatoire désactivé ne couvre plus son critère', () => {
    const exercices = [maitrise(17, [1], true, false), maitrise(19, [1], false)];
    expect(criteresSansObligatoire(criteres, exercices).map(c => c.id)).toEqual([1]);
  });

  it('Une initiation ne compte pas comme maîtrise', () => {
    const exercices = [{ id: 11, phase: 'INITIATION' as const, actif: true, critereIds: [2], obligatoire: false }];
    expect(criteresSansObligatoire(criteres, exercices)).toEqual([]);
  });
});
