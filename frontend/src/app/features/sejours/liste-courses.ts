import { RegimeAlimentaire } from './sejour-api';

/**
 * La liste de courses du séjour (demande du club, 2026), calculée sur le
 * téléphone, jamais stockée : pour chaque repas que l'on prépare (ceux qui
 * ne sont pas au restaurant), les participants présents à l'heure du repas
 * (arrivée et départ du carnet), et pour chacun une assiette qui suit ses
 * régimes. Des quantités moyennes par personne, arrondies au-dessus : une
 * base à ajuster, pas une recette.
 */

export type Repas = 'PETIT_DEJEUNER' | 'DEJEUNER' | 'DINER';

export const REPAS: { code: Repas; libelle: string; heure: string }[] = [
  { code: 'PETIT_DEJEUNER', libelle: 'Petit-déjeuner', heure: '08:00' },
  { code: 'DEJEUNER', libelle: 'Déjeuner', heure: '12:30' },
  { code: 'DINER', libelle: 'Dîner', heure: '19:30' }
];

/** Un repas d'un jour du séjour (« 2027-06-10 »). */
export interface RepasDuJour {
  jour: string;
  repas: Repas;
}

/** Ce qui compte d'un participant pour les courses : ses régimes, quand il arrive et quand il repart. */
export interface Convive {
  regimes: RegimeAlimentaire[];
  arrivee: { date: string | null; heure: string | null } | null;
  depart: { date: string | null; heure: string | null } | null;
}

export type Unite = 'g' | 'cl' | 'pièce' | 'baguette';

export interface ArticleCourses {
  article: string;
  /** « 1,1 kg », « 3 baguettes », « 12 » ; vide pour un produit de base, à vérifier sur place. */
  quantite: string;
}

export interface RayonCourses {
  rayon: string;
  articles: ArticleCourses[];
}

export interface ListeCourses {
  repasPrepares: number;
  /** Repas préparés × présents à chacun. */
  couverts: number;
  rayons: RayonCourses[];
}

const LEGUMES = 'Fruits et légumes';
const BOULANGERIE = 'Boulangerie';
const BOUCHERIE = 'Boucherie, poissonnerie';
const CREMERIE = 'Crèmerie, œufs';
const EPICERIE = 'Épicerie';
const BOISSONS = 'Boissons';
const BASE = 'Produits de base, à vérifier sur place';

const ORDRE_RAYONS = [LEGUMES, BOULANGERIE, BOUCHERIE, CREMERIE, EPICERIE, BOISSONS];

const PRODUITS_DE_BASE = ['Sel, poivre', 'Huile, vinaigre', 'Sucre', 'Liquide vaisselle, éponges', 'Sacs poubelle',
  'Essuie-tout', 'Papier toilette'];

interface Besoin {
  rayon: string;
  article: string;
  quantite: number;
  unite: Unite;
}

/** Les jours du séjour, du premier au dernier (« 2027-06-10 »). */
export function joursDuSejour(debut: string, fin: string): string[] {
  const jours: string[] = [];
  const d = new Date(debut + 'T12:00:00Z');
  const f = new Date(fin + 'T12:00:00Z');
  while (d <= f) {
    jours.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return jours;
}

/** Tous les repas du séjour, trois par jour, dans l'ordre. */
export function repasDuSejour(debut: string, fin: string): RepasDuJour[] {
  return joursDuSejour(debut, fin).flatMap(jour => REPAS.map(r => ({ jour, repas: r.code })));
}

/**
 * Ceux qui sont là au repas : arrivés avant son heure, pas encore repartis.
 * Sans date, présent tout le séjour ; sans heure, toute la journée (mieux
 * vaut trop que pas assez).
 */
export function presentsAuRepas<C extends Convive>(convives: C[], jour: string, repas: Repas): C[] {
  const heure = REPAS.find(r => r.code === repas)!.heure;
  return convives.filter(c => {
    const a = c.arrivee?.date ? c.arrivee : null;
    const d = c.depart?.date ? c.depart : null;
    const arrive = !a || a.date! < jour || (a.date === jour && (!a.heure || a.heure.slice(0, 5) <= heure));
    const encoreLa = !d || d.date! > jour || (d.date === jour && (!d.heure || d.heure.slice(0, 5) >= heure));
    return arrive && encoreLa;
  });
}

function a(regimes: RegimeAlimentaire[], ...codes: RegimeAlimentaire[]): boolean {
  return codes.some(c => regimes.includes(c));
}

/** Viande, poisson, œufs ou protéines végétales : le régime le plus strict l'emporte (sans porc : la viande n'en a pas). */
function proteine(regimes: RegimeAlimentaire[], grammes: number): Besoin {
  if (a(regimes, 'VEGETALIEN')) return { rayon: EPICERIE, article: 'Tofu ou pois chiches', quantite: grammes, unite: 'g' };
  if (a(regimes, 'VEGETARIEN')) return { rayon: CREMERIE, article: 'Œufs', quantite: 2, unite: 'pièce' };
  if (a(regimes, 'PESCETARIEN')) return { rayon: BOUCHERIE, article: 'Poisson', quantite: grammes, unite: 'g' };
  if (a(regimes, 'HALAL')) return { rayon: BOUCHERIE, article: 'Viande halal', quantite: grammes, unite: 'g' };
  if (a(regimes, 'CASHER')) return { rayon: BOUCHERIE, article: 'Viande casher', quantite: grammes, unite: 'g' };
  return { rayon: BOUCHERIE, article: 'Viande (volaille, bœuf)', quantite: grammes, unite: 'g' };
}

function pain(regimes: RegimeAlimentaire[], baguette: number): Besoin {
  return a(regimes, 'SANS_GLUTEN')
    ? { rayon: BOULANGERIE, article: 'Pain sans gluten', quantite: Math.round(baguette * 250), unite: 'g' }
    : { rayon: BOULANGERIE, article: 'Pain', quantite: baguette, unite: 'baguette' };
}

function fromage(regimes: RegimeAlimentaire[]): Besoin[] {
  if (a(regimes, 'VEGETALIEN')) return [];
  return [{ rayon: CREMERIE, article: a(regimes, 'SANS_LACTOSE') ? 'Fromage sans lactose' : 'Fromage', quantite: 30, unite: 'g' }];
}

/** L'assiette d'une personne à un repas, selon ses régimes. */
function assiette(repas: Repas, regimes: RegimeAlimentaire[]): Besoin[] {
  const sansLait = a(regimes, 'VEGETALIEN', 'SANS_LACTOSE');
  if (repas === 'PETIT_DEJEUNER') {
    return [
      pain(regimes, 1 / 3),
      { rayon: CREMERIE, article: sansLait ? 'Margarine végétale' : 'Beurre', quantite: 10, unite: 'g' },
      { rayon: CREMERIE, article: sansLait ? 'Boisson végétale (avoine, soja)' : 'Lait', quantite: 20, unite: 'cl' },
      { rayon: CREMERIE, article: sansLait ? 'Yaourts végétaux' : 'Yaourts', quantite: 1, unite: 'pièce' },
      { rayon: EPICERIE, article: 'Confiture', quantite: 25, unite: 'g' },
      { rayon: EPICERIE, article: 'Café, thé', quantite: 10, unite: 'g' },
      { rayon: BOISSONS, article: 'Jus de fruits', quantite: 15, unite: 'cl' }
    ];
  }
  const dejeuner = repas === 'DEJEUNER';
  return [
    { rayon: LEGUMES, article: 'Légumes, crudités', quantite: dejeuner ? 150 : 200, unite: 'g' },
    { rayon: LEGUMES, article: 'Fruits', quantite: 1, unite: 'pièce' },
    pain(regimes, 1 / 4),
    proteine(regimes, dejeuner ? 120 : 150),
    ...fromage(regimes),
    dejeuner
      ? { rayon: EPICERIE, article: 'Riz', quantite: 80, unite: 'g' }
      : { rayon: EPICERIE, article: a(regimes, 'SANS_GLUTEN') ? 'Pâtes sans gluten' : 'Pâtes', quantite: 100, unite: 'g' },
    { rayon: BOISSONS, article: 'Eau', quantite: 50, unite: 'cl' }
  ];
}

const nombre = (n: number) => String(n).replace('.', ',');
const auDessus = (n: number, pas: number) => Math.ceil(n / pas - 1e-9) * pas;

/** Une quantité lisible, arrondie au-dessus : 50 g ou 0,1 kg, 25 cl ou 0,5 L, à l'unité sinon. */
export function quantite(n: number, unite: Unite): string {
  switch (unite) {
    case 'g':
      return n > 1000 ? `${nombre(auDessus(n, 100) / 1000)} kg` : `${auDessus(n, 50)} g`;
    case 'cl':
      return n > 100 ? `${nombre(auDessus(n, 50) / 100)} L` : `${auDessus(n, 25)} cl`;
    case 'baguette': {
      const b = auDessus(n, 1);
      return `${b} baguette${b > 1 ? 's' : ''}`;
    }
    default:
      return String(auDessus(n, 1));
  }
}

/** La liste, rayon par rayon, pour les repas du séjour qui ne sont pas au restaurant. */
export function listeDeCourses(convives: Convive[], debut: string, fin: string, auRestaurant: RepasDuJour[]): ListeCourses {
  const dehors = new Set(auRestaurant.map(r => r.jour + r.repas));
  const besoins = new Map<string, Besoin>();
  let repasPrepares = 0;
  let couverts = 0;
  for (const r of repasDuSejour(debut, fin)) {
    if (dehors.has(r.jour + r.repas)) continue;
    const presents = presentsAuRepas(convives, r.jour, r.repas);
    if (presents.length === 0) continue;
    repasPrepares++;
    couverts += presents.length;
    for (const c of presents) {
      for (const b of assiette(r.repas, c.regimes)) {
        const deja = besoins.get(b.article);
        if (deja) deja.quantite += b.quantite;
        else besoins.set(b.article, { ...b });
      }
    }
  }
  if (repasPrepares === 0) return { repasPrepares, couverts, rayons: [] };
  const rayons: RayonCourses[] = ORDRE_RAYONS
    .map(rayon => ({
      rayon,
      articles: [...besoins.values()].filter(b => b.rayon === rayon)
        .map(b => ({ article: b.article, quantite: quantite(b.quantite, b.unite) }))
    }))
    .filter(r => r.articles.length > 0);
  rayons.push({ rayon: BASE, articles: PRODUITS_DE_BASE.map(article => ({ article, quantite: '' })) });
  return { repasPrepares, couverts, rayons };
}

/** La liste en texte, à coller dans un message ou une note du téléphone. */
export function texteDeLaListe(titre: string, liste: ListeCourses): string {
  const lignes = [`Courses — ${titre}`,
    `${liste.repasPrepares} repas à préparer, ${liste.couverts} couvert${liste.couverts > 1 ? 's' : ''}`];
  for (const r of liste.rayons) {
    lignes.push('', r.rayon, ...r.articles.map(x => `☐ ${x.article}${x.quantite ? ' : ' + x.quantite : ''}`));
  }
  return lignes.join('\n') + '\n';
}
