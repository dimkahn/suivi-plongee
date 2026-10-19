import { refusExerciceHorsListe } from './exercice-hors-liste';

describe('Exercice hors liste noté dans la fiche de suivi', () => {
  it('Un exercice hors liste a un intitulé et une phase', () => {
    expect(refusExerciceHorsListe('Gréage sous la pluie', 'INITIATION')).toBeNull();
    expect(refusExerciceHorsListe('   ', 'INITIATION')).toContain('intitulé');
    expect(refusExerciceHorsListe('Gréage sous la pluie', null)).toContain('phase');
  });

  it('L\'intitulé ne dépasse pas 200 caractères, comme sur le serveur', () => {
    expect(refusExerciceHorsListe('x'.repeat(200), 'MAITRISE')).toBeNull();
    expect(refusExerciceHorsListe('x'.repeat(201), 'MAITRISE')).toContain('200 caractères');
  });
});
