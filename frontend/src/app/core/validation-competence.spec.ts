import { modeValidation } from './validation-competence';

describe('Validation d\'une compétence par les encadrants du groupe', () => {
  const groupe = { referentIds: [2], votantIds: [1, 2, 3], accordsRequis: 2 };

  it('Un élève sans groupe se valide par un seul encadrant, comme avant', () => {
    expect(modeValidation({ referentIds: [], votantIds: [], accordsRequis: 0 }, { accords: [] }, 1))
      .toEqual({ mode: 'SEUL', accords: 0, accordsRequis: 0 });
    // Grille gardée sur l'appareil avant l'arrivée des accords.
    expect(modeValidation({}, {}, 1).mode).toBe('SEUL');
  });

  it('Un référent du groupe valide seul', () => {
    expect(modeValidation(groupe, { accords: [] }, 2).mode).toBe('SEUL');
  });

  it('Le premier encadrant du groupe propose la validation, les suivants l\'acceptent', () => {
    expect(modeValidation(groupe, { accords: [] }, 1)).toEqual({ mode: 'PROPOSER', accords: 0, accordsRequis: 2 });
    expect(modeValidation(groupe, { accords: [{ moniteurId: 1, nom: 'A', le: '2026-10-19' }] }, 3))
      .toEqual({ mode: 'ACCEPTER', accords: 1, accordsRequis: 2 });
  });

  it('Un encadrant qui a déjà donné son accord attend les autres', () => {
    expect(modeValidation(groupe, { accords: [{ moniteurId: 1, nom: 'A', le: '2026-10-19' }] }, 1).mode)
      .toBe('ACCORD_DONNE');
  });

  it('Un encadrant hors du groupe ne fait que lire où en est la validation', () => {
    expect(modeValidation(groupe, { accords: [] }, 9).mode).toBe('HORS_GROUPE');
  });

  it('Seuls comptent les accords des encadrants encore dans le groupe', () => {
    expect(modeValidation(groupe, { accords: [{ moniteurId: 8, nom: 'Parti', le: '2026-10-01' }] }, 1))
      .toEqual({ mode: 'PROPOSER', accords: 0, accordsRequis: 2 });
  });
});
