import { describe, expect, it } from 'vitest';
import { encartReplie } from './replis-sejour';

describe('« Mon séjour » replié par défaut pour un organisateur', () => {
  it('Un organisateur qui n\'a encore rien choisi sur ce téléphone le trouve replié', () => {
    expect(encartReplie(null, 'mon-sejour', true)).toBe(true);
  });

  it('Un participant ou un encadrant qui n\'organise pas le trouve déplié', () => {
    expect(encartReplie(null, 'mon-sejour', false)).toBe(false);
  });

  it('« Aujourd\'hui » reste déplié par défaut, même pour un organisateur', () => {
    expect(encartReplie(null, 'aujourdhui', true)).toBe(false);
  });

  it('Le choix gardé sur le téléphone l\'emporte : déplié s\'il l\'a déplié', () => {
    expect(encartReplie(new Set(), 'mon-sejour', true)).toBe(false);
    expect(encartReplie(new Set(['aujourdhui'] as const), 'mon-sejour', true)).toBe(false);
    expect(encartReplie(new Set(['mon-sejour'] as const), 'mon-sejour', false)).toBe(true);
  });
});
