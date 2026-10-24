import { describe, expect, it } from 'vitest';
import { Convive, listeDeCourses, presentsAuRepas, quantite, repasDuSejour, texteDeLaListe } from './liste-courses';

const tous = (n: number, c: Partial<Convive> = {}): Convive[] =>
  Array.from({ length: n }, () => ({ regimes: [], arrivee: null, depart: null, ...c }));

function article(liste: ReturnType<typeof listeDeCourses>, nom: string) {
  return liste.rayons.flatMap(r => r.articles).find(a => a.article === nom) ?? null;
}

describe('Repas du séjour', () => {
  it('compte trois repas par jour, du premier au dernier jour', () => {
    const repas = repasDuSejour('2027-06-10', '2027-06-11');
    expect(repas).toEqual([
      { jour: '2027-06-10', repas: 'PETIT_DEJEUNER' }, { jour: '2027-06-10', repas: 'DEJEUNER' },
      { jour: '2027-06-10', repas: 'DINER' }, { jour: '2027-06-11', repas: 'PETIT_DEJEUNER' },
      { jour: '2027-06-11', repas: 'DEJEUNER' }, { jour: '2027-06-11', repas: 'DINER' }
    ]);
  });
});

describe('Présents à un repas', () => {
  it("compte celui qui arrive avant l'heure du repas, pas celui qui arrive après", () => {
    const tot = { regimes: [], arrivee: { date: '2027-06-10', heure: '11:00:00' }, depart: null };
    const tard = { regimes: [], arrivee: { date: '2027-06-10', heure: '16:00' }, depart: null };
    expect(presentsAuRepas([tot, tard], '2027-06-10', 'DEJEUNER')).toEqual([tot]);
    expect(presentsAuRepas([tot, tard], '2027-06-10', 'DINER')).toEqual([tot, tard]);
  });

  it("ne compte plus celui qui est reparti avant l'heure du repas", () => {
    const matin = { regimes: [], arrivee: null, depart: { date: '2027-06-12', heure: '10:00' } };
    expect(presentsAuRepas([matin], '2027-06-12', 'PETIT_DEJEUNER')).toEqual([matin]);
    expect(presentsAuRepas([matin], '2027-06-12', 'DEJEUNER')).toEqual([]);
    expect(presentsAuRepas([matin], '2027-06-13', 'PETIT_DEJEUNER')).toEqual([]);
  });

  it("compte toute la journée celui dont on ne connaît pas l'heure : mieux vaut trop que pas assez", () => {
    const sansHeure = { regimes: [], arrivee: { date: '2027-06-10', heure: null }, depart: { date: '2027-06-12', heure: null } };
    expect(presentsAuRepas([sansHeure], '2027-06-10', 'PETIT_DEJEUNER')).toEqual([sansHeure]);
    expect(presentsAuRepas([sansHeure], '2027-06-12', 'DINER')).toEqual([sansHeure]);
    expect(presentsAuRepas([sansHeure], '2027-06-09', 'DINER')).toEqual([]);
  });
});

describe('Liste de courses', () => {
  it('additionne les besoins de chaque repas préparé, pour chaque présent', () => {
    // 4 personnes, 1 jour : 3 repas, 12 couverts.
    const liste = listeDeCourses(tous(4), '2027-06-10', '2027-06-10', []);
    expect(liste.repasPrepares).toBe(3);
    expect(liste.couverts).toBe(12);
    // Viande : 120 g au déjeuner + 150 g au dîner, pour 4.
    expect(article(liste, 'Viande (volaille, bœuf)')?.quantite).toBe('1,1 kg');
  });

  it("ne compte rien pour un repas pris au restaurant", () => {
    const liste = listeDeCourses(tous(4), '2027-06-10', '2027-06-10', [{ jour: '2027-06-10', repas: 'DINER' }]);
    expect(liste.repasPrepares).toBe(2);
    expect(liste.couverts).toBe(8);
    expect(article(liste, 'Pâtes')).toBeNull();
    expect(article(liste, 'Viande (volaille, bœuf)')?.quantite).toBe('500 g');
  });

  it("remplace la viande selon le régime de chacun", () => {
    const liste = listeDeCourses([
      ...tous(1), ...tous(1, { regimes: ['VEGETARIEN'] }), ...tous(1, { regimes: ['VEGETALIEN'] }),
      ...tous(1, { regimes: ['PESCETARIEN'] }), ...tous(1, { regimes: ['HALAL', 'SANS_PORC'] }),
      ...tous(1, { regimes: ['CASHER'] })
    ], '2027-06-10', '2027-06-10', [{ jour: '2027-06-10', repas: 'DEJEUNER' }]);
    expect(article(liste, 'Viande (volaille, bœuf)')?.quantite).toBe('150 g');
    expect(article(liste, 'Œufs')?.quantite).toBe('2');
    expect(article(liste, 'Tofu ou pois chiches')?.quantite).toBe('150 g');
    expect(article(liste, 'Poisson')?.quantite).toBe('150 g');
    expect(article(liste, 'Viande halal')?.quantite).toBe('150 g');
    expect(article(liste, 'Viande casher')?.quantite).toBe('150 g');
  });

  it('prévoit sans gluten et sans lactose pour qui en a besoin, et rien de laitier pour un végétalien', () => {
    const liste = listeDeCourses([...tous(2), ...tous(1, { regimes: ['SANS_GLUTEN'] }),
      ...tous(1, { regimes: ['VEGETALIEN'] }), ...tous(1, { regimes: ['SANS_LACTOSE'] })],
      '2027-06-10', '2027-06-10', [{ jour: '2027-06-10', repas: 'PETIT_DEJEUNER' }, { jour: '2027-06-10', repas: 'DEJEUNER' }]);
    expect(article(liste, 'Pâtes')?.quantite).toBe('400 g');
    expect(article(liste, 'Pâtes sans gluten')?.quantite).toBe('100 g');
    expect(article(liste, 'Fromage')?.quantite).toBe('100 g');
    expect(article(liste, 'Fromage sans lactose')?.quantite).toBe('50 g');
  });

  it('arrondit au-dessus : on ne coupe pas une baguette ni une bouteille', () => {
    expect(quantite(1001, 'g')).toBe('1,1 kg');
    expect(quantite(130, 'g')).toBe('150 g');
    expect(quantite(250, 'cl')).toBe('2,5 L');
    expect(quantite(40, 'cl')).toBe('50 cl');
    expect(quantite(2.1, 'baguette')).toBe('3 baguettes');
    expect(quantite(1, 'baguette')).toBe('1 baguette');
    expect(quantite(3.2, 'pièce')).toBe('4');
  });

  it("n'a rien à acheter sans participant ou sans repas à préparer", () => {
    expect(listeDeCourses([], '2027-06-10', '2027-06-11', []).rayons).toEqual([]);
    const auRestaurant = repasDuSejour('2027-06-10', '2027-06-10');
    expect(listeDeCourses(tous(3), '2027-06-10', '2027-06-10', auRestaurant).rayons).toEqual([]);
  });
});

describe('Liste à partager', () => {
  it('se copie en texte, rayon par rayon, avec des cases à cocher', () => {
    const liste = listeDeCourses(tous(2), '2027-06-10', '2027-06-10', [
      { jour: '2027-06-10', repas: 'PETIT_DEJEUNER' }, { jour: '2027-06-10', repas: 'DEJEUNER' }]);
    const texte = texteDeLaListe('Port-Cros', liste);
    expect(texte.startsWith('Courses — Port-Cros\n1 repas à préparer, 2 couverts\n')).toBe(true);
    expect(texte).toContain('\nBoucherie, poissonnerie\n☐ Viande (volaille, bœuf) : 300 g\n');
  });
});
