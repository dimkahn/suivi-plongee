import { describe, expect, it } from 'vitest';
import { ongletsSejour, ouvertureDemandee } from './onglets-sejour';

describe('Onglets du séjour', () => {
  it('cinq onglets, dans l\'ordre du séjour, les mêmes pour tous', () => {
    expect(ongletsSejour({ transports: 0, hebergement: 0 }).map(o => o.libelle))
      .toEqual(['Programme', 'Qui et où', 'Repas', 'Frais', 'Pratique']);
  });

  it('« Qui et où » compte les points à vérifier des voitures et des chambres', () => {
    const qui = ongletsSejour({ transports: 1, hebergement: 2 }).find(o => o.valeur === 'personnes');
    expect(qui?.alertes).toBe(3);
  });

  it('sans demande, le programme', () => {
    expect(ouvertureDemandee(null)).toEqual({ onglet: 'programme', ancre: null });
    expect(ouvertureDemandee('inconnu')).toEqual({ onglet: 'programme', ancre: null });
    expect(ouvertureDemandee('constructor')).toEqual({ onglet: 'programme', ancre: null });
  });

  it('un nouvel onglet s\'ouvre en haut', () => {
    expect(ouvertureDemandee('frais')).toEqual({ onglet: 'frais', ancre: null });
    expect(ouvertureDemandee('repas')).toEqual({ onglet: 'repas', ancre: null });
  });

  it('un ancien onglet ouvre celui qui le contient, à sa section', () => {
    expect(ouvertureDemandee('fiches')).toEqual({ onglet: 'programme', ancre: 'fiches-securite-sejour' });
    expect(ouvertureDemandee('participants')).toEqual({ onglet: 'personnes', ancre: 'participants-sejour' });
    expect(ouvertureDemandee('transports')).toEqual({ onglet: 'personnes', ancre: 'trajets-sejour' });
    expect(ouvertureDemandee('hebergement')).toEqual({ onglet: 'personnes', ancre: 'logements-sejour' });
    expect(ouvertureDemandee('courses')).toEqual({ onglet: 'repas', ancre: 'courses-sejour' });
    expect(ouvertureDemandee('restaurant')).toEqual({ onglet: 'repas', ancre: 'restaurant-sejour' });
    expect(ouvertureDemandee('materiel')).toEqual({ onglet: 'pratique', ancre: 'materiel-sejour' });
  });
});
