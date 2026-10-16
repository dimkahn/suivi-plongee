import { nomEquipement } from './nom-equipement';

describe('Nom d\'un équipement', () => {
  it('Un matériel renuméroté montre toujours son ancien numéro à côté du nouveau', () => {
    expect(nomEquipement({ reference: 'B-12', ancienneReference: '12' })).toBe('B-12 (ancien n° 12)');
  });

  it('Sans ancien numéro, la référence seule', () => {
    expect(nomEquipement({ reference: 'G-03', ancienneReference: null })).toBe('G-03');
    expect(nomEquipement({ reference: 'G-03' })).toBe('G-03');
  });
});
