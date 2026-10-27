import { describe, expect, it } from 'vitest';
import { OngletSejour, ongletsSejour, ouvertureDemandee, rubriqueChoisie, rubriquesSejour } from './onglets-sejour';

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

describe('Sous-onglets du séjour : une rubrique à la fois', () => {
  const encadrant = { encadrant: true, fiches: true, alertes: { voitures: 0, logements: 0 } };
  const participant = { encadrant: false, fiches: false, alertes: { voitures: 0, logements: 0 } };
  const libelles = (o: OngletSejour, c = encadrant) => rubriquesSejour(o, c).map(r => r.libelle);

  it('chaque onglet a ses rubriques, dans l\'ordre', () => {
    expect(libelles('programme')).toEqual(['Programme', 'Fiches de sécurité']);
    expect(libelles('personnes')).toEqual(['Participants', 'Arrivées et départs', 'Voitures', 'Logements']);
    expect(libelles('repas')).toEqual(['Régimes', 'Courses', 'Restaurant']);
    expect(libelles('frais')).toEqual(['Frais']);
    expect(libelles('pratique')).toEqual(['Affaires à prévoir', 'Infos pratiques', 'Matériel emprunté']);
  });

  it('un participant ne voit pas les rubriques des encadrants', () => {
    expect(libelles('programme', participant)).toEqual(['Programme']);
    expect(libelles('personnes', participant)).toEqual(['Arrivées et départs', 'Voitures', 'Logements']);
    expect(libelles('repas', participant)).toEqual(['Restaurant']);
  });

  it('un encadrant qui ne lit pas les fiches de sécurité n\'a pas leur rubrique', () => {
    expect(libelles('programme', { ...encadrant, fiches: false })).toEqual(['Programme']);
  });

  it('les points à vérifier sont comptés sur la rubrique qui permet de les régler', () => {
    const r = rubriquesSejour('personnes', { ...encadrant, alertes: { voitures: 2, logements: 1 } });
    expect(r.find(x => x.valeur === 'voitures-sejour')?.alertes).toBe(2);
    expect(r.find(x => x.valeur === 'logements-sejour')?.alertes).toBe(1);
    expect(r.find(x => x.valeur === 'trajets-sejour')?.alertes).toBeUndefined();
  });

  it('la rubrique demandée si l\'onglet l\'a, sinon la première', () => {
    const r = rubriquesSejour('personnes', participant);
    expect(rubriqueChoisie(r, 'logements-sejour')).toBe('logements-sejour');
    expect(rubriqueChoisie(r, null)).toBe('trajets-sejour');
    expect(rubriqueChoisie(r, 'participants-sejour')).toBe('trajets-sejour');
    expect(rubriqueChoisie([], null)).toBeNull();
  });
});
