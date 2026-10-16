import { CategorieDepense, NoteLue } from './sejour-api';

// ----------------------------------------------------------------
//  Lecture d'un ticket sans intelligence artificielle : le texte rendu
//  par la reconnaissance de caractères (Tesseract, sur le téléphone) est
//  parcouru avec des règles simples. Ce n'est qu'une proposition : seules
//  les cases vides sont remplies, et on vérifie avant d'enregistrer.
// ----------------------------------------------------------------

/** Au-delà, plus probablement une erreur de lecture (comme la limite du serveur). */
const MONTANT_MAX_CENTIMES = 10_000_000;

/** Un montant avec deux chiffres après la virgule : « 38,83 », « 1 234.50 ». */
const MONTANT = /(?<![\d,.])(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?![\d%])/g;
/** Un montant où la reconnaissance a pris des chiffres pour des lettres : « 3B,83 », « 4O,5O ». */
const MONTANT_ABIME = /(?<![A-Z0-9])([0-9OSBIL]{1,6})([,.])([0-9OSBIL]{2})(?![0-9%])/g;
const CHIFFRE_POUR_LETTRE: Record<string, string> = { O: '0', S: '5', B: '8', I: '1', L: '1' };
/** Sur une ligne de total, un montant dont la virgule s'est perdue : « TOTAL 12 40 € ». */
const MONTANT_SANS_VIRGULE = /(?<![\d,.])(\d{1,4}) (\d{2})\s*(?:€|EUR|E)?\s*$/;

/**
 * Les lignes qui donnent ce qui a été payé, de la plus sûre à la moins sûre :
 * le total annoncé, puis un total ou un montant, puis le paiement (qui peut
 * n'être qu'une partie, en deux moyens de paiement).
 */
const NIVEAUX_TOTAL = [
  /\b(TOTAL TTC|TOTAL A PAYER|NET A PAYER|A PAYER|A REGLER|SOMME DUE|MONTANT TTC|MONTANT DU|TOTAL EUR|TOTAL EUROS)\b/,
  /\b(TOTAL|MONTANT|NET)\b/,
  /\b(CB|CARTE BANCAIRE|CARTE|VISA|MASTERCARD|MAESTRO|SANS CONTACT|CONTACTLESS|PAIEMENT|REGLEMENT|ESPECES|PAYE)\b/
];
/** Les lignes qui ressemblent à un total sans l'être. */
const LIGNE_PAS_TOTAL = new RegExp([
  'SOUS[- ]?TOTAL', 'S/TOTAL', '\\bTVA\\b', '\\bHT\\b', '\\bBASE\\b', 'RENDU', 'MONNAIE', 'REMISE', 'ECONOMI',
  'FIDELITE', 'POINTS', 'CAGNOTTE', 'TICKET RESTO', 'TITRE RESTAURANT', 'TITRES RESTAURANT', 'ACOMPTE', 'AU KG',
  '/KG', 'EUR/L', 'PRIX AU'
].join('|'));

const DATE_CHIFFRES = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;
const DATE_ISO = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const MOIS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE',
  'NOVEMBRE', 'DECEMBRE'];
const DATE_LETTRES = new RegExp(`(?<!\\d)(\\d{1,2})(?:ER)?\\s+(${MOIS.join('|')})\\s+(\\d{4}|\\d{2})(?!\\d)`, 'g');

/** Mots du commerçant ou des achats, par catégorie ; à égalité, la première de la liste l'emporte. */
const MOTS_CATEGORIE: [CategorieDepense, string[]][] = [
  ['PLONGEE', ['PLONGEE', 'PLONGEES', 'SUBAQUATIQUE', 'GONFLAGE', 'GONFLAGES', 'NITROX', 'SCUBA', 'DIVE', 'DIVING',
    'BAPTEME', 'BAPTEMES', 'EXPLORATION', 'EXPLORATIONS', 'PLONGEUR', 'PLONGEURS', 'PALANQUEE', 'SORTIE BATEAU',
    'LOCATION COMBINAISON', 'LOCATION DETENDEUR', 'LOCATION GILET', 'FFESSM', 'PADI', 'CENTRE DE PLONGEE']],
  ['HEBERGEMENT', ['HOTEL', 'HOTELS', 'GITE', 'GITES', 'CAMPING', 'CHAMBRE', 'CHAMBRES', 'CHAMBRE D\'HOTES', 'AIRBNB',
    'BOOKING', 'NUITEE', 'NUITEES', 'NUIT', 'NUITS', 'HEBERGEMENT', 'RESIDENCE', 'TAXE DE SEJOUR', 'MOBIL-HOME',
    'MOBIL HOME', 'IBIS', 'CAMPANILE', 'KYRIAD', 'B&B', 'NOVOTEL', 'MERCURE', 'FORMULE 1', 'PREMIERE CLASSE',
    'BEST WESTERN', 'VVF', 'AZUREVA', 'PIERRE & VACANCES', 'ODALYS', 'BELAMBRA', 'AUBERGE DE JEUNESSE']],
  ['TRANSPORT', ['CARBURANT', 'CARBURANTS', 'GAZOLE', 'GASOIL', 'DIESEL', 'SP95', 'SP98', 'SP95-E10', 'E10', 'E85',
    'ESSENCE', 'STATION', 'STATION-SERVICE', 'POMPE', 'PEAGE', 'GARE DE PEAGE', 'AUTOROUTE', 'AUTOROUTES', 'VINCI',
    'ESCOTA', 'ASF', 'SANEF', 'APRR', 'AREA', 'COFIROUTE', 'SNCF', 'TGV', 'TER', 'OUIGO', 'INOUI', 'BILLET',
    'BILLETS', 'PARKING', 'STATIONNEMENT', 'HORODATEUR', 'TAXI', 'UBER', 'BLABLACAR', 'FERRY', 'TRAVERSEE',
    'NAVETTE', 'BATEAU', 'VEDETTES', 'TLV', 'TVM', 'ALLER-RETOUR', 'ALLER RETOUR', 'CORSICA FERRIES',
    'LA MERIDIONALE', 'AIR FRANCE', 'EASYJET', 'VOLOTEA', 'TRANSAVIA', 'TOTALENERGIES', 'ESSO', 'SHELL', 'BP',
    'AVIA', 'DYNEFF', 'HERTZ', 'EUROPCAR', 'SIXT', 'ADA', 'RENT A CAR', 'GETAROUND', 'LOCATION VEHICULE']],
  ['REPAS', ['RESTAURANT', 'BRASSERIE', 'PIZZERIA', 'CREPERIE', 'BOULANGERIE', 'PATISSERIE', 'BOUCHERIE',
    'CHARCUTERIE', 'FROMAGERIE', 'PRIMEUR', 'TRAITEUR', 'EPICERIE', 'SUPERMARCHE', 'HYPERMARCHE', 'MARCHE',
    'CARREFOUR', 'LECLERC', 'INTERMARCHE', 'AUCHAN', 'LIDL', 'CASINO', 'SPAR', 'MONOPRIX', 'FRANPRIX', 'ALDI',
    'NETTO', 'CORA', 'MATCH', 'PROXI', 'VIVAL', 'UTILE', 'SUPER U', 'HYPER U', 'U EXPRESS', 'GRAND FRAIS',
    'BIOCOOP', 'PICARD', 'MCDONALD', 'MC DO', 'MCDO', 'BURGER KING', 'KFC', 'QUICK', 'SUBWAY', 'PAUL',
    'BRIOCHE DOREE', 'FLUNCH', 'BUFFALO GRILL', 'COURTEPAILLE', 'HIPPOPOTAMUS', 'DEL ARTE', 'CAFE', 'BAR', 'SNACK',
    'MENU', 'MENUS', 'COUVERT', 'COUVERTS', 'PLAT', 'PLATS', 'DESSERT', 'BOISSON', 'BOISSONS', 'BIERE', 'BIERES',
    'VIN', 'VINS', 'PAIN', 'BAGUETTE', 'GLACE', 'GLACES', 'GLACIER']]
];

/** Le total, la date et la catégorie trouvés dans le texte d'un ticket ; null pour ce qui n'y est pas. */
export function analyserTicket(texte: string): NoteLue {
  const lignes = normaliser(texte).split('\n').map(l => reparer(l.trim())).filter(l => l.length > 0);
  const tout = lignes.join('\n');
  return { montantCentimes: total(lignes), jour: date(tout), categorie: categorie(tout) };
}

/** Majuscules sans accents : « Net à payer » → « NET A PAYER ». */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Les confusions courantes de la reconnaissance : « T0TAL », « TOTA1 », « 3B,83 ». */
function reparer(ligne: string): string {
  return ligne
    .replace(/\bT[O0]T[A4][L1I|]\b/g, 'TOTAL')
    .replace(/\bM[O0]NT[A4]NT\b/g, 'MONTANT')
    .replace(MONTANT_ABIME, (tout, avant: string, virgule: string, apres: string) => /\d/.test(avant + apres)
      ? [...avant].map(c => CHIFFRE_POUR_LETTRE[c] ?? c).join('') + virgule
        + [...apres].map(c => CHIFFRE_POUR_LETTRE[c] ?? c).join('')
      : tout);
}

/** Les montants d'une ligne, en centimes, sans les dates (« 10.06.27 » n'est pas 10,06 €). */
function montants(ligne: string): number[] {
  const sansDates = ligne.replace(DATE_CHIFFRES, ' ').replace(DATE_ISO, ' ');
  return [...sansDates.matchAll(MONTANT)]
    .map(m => Number(m[1].replace(/[ .]/g, '')) * 100 + Number(m[2]))
    .filter(c => c > 0 && c <= MONTANT_MAX_CENTIMES);
}

/** Le montant d'une ligne de total : le dernier de la ligne, sinon celui écrit sans virgule. */
function montantDeLigne(ligne: string): number | null {
  const surLaLigne = montants(ligne);
  if (surLaLigne.length > 0) return surLaLigne[surLaLigne.length - 1];
  const m = MONTANT_SANS_VIRGULE.exec(ligne);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

/**
 * Le montant des lignes du niveau le plus sûr qui en a (le montant peut
 * être écrit sur la ligne suivante) : au premier niveau, deux montants
 * différents se contredisent et rien n'est proposé ; aux autres, le plus
 * gros. Sans ligne de total, le plus gros montant du ticket.
 */
function total(lignes: string[]): number | null {
  const comptables = lignes.map(l => !LIGNE_PAS_TOTAL.test(l));
  for (const [niveau, motif] of NIVEAUX_TOTAL.entries()) {
    const candidats = new Set<number>();
    lignes.forEach((ligne, i) => {
      if (!comptables[i] || !motif.test(ligne)) return;
      const montant = montantDeLigne(ligne)
        ?? (i + 1 < lignes.length && comptables[i + 1] ? montants(lignes[i + 1])[0] ?? null : null);
      if (montant !== null) candidats.add(montant);
    });
    if (candidats.size === 0) continue;
    if (niveau === 0 && candidats.size > 1) return null;
    return Math.max(...candidats);
  }
  const tous = lignes.filter((_, i) => comptables[i]).flatMap(montants);
  return tous.length > 0 ? Math.max(...tous) : null;
}

/** La première date valide, en chiffres, au format international ou en toutes lettres, en AAAA-MM-JJ. */
function date(texte: string): string | null {
  const trouvees: { position: number; jour: string }[] = [];
  const noter = (position: number, annee: string, mois: number, jour: string) => {
    const valide = jourValide(annee.length === 2 ? 2000 + Number(annee) : Number(annee), mois, Number(jour));
    if (valide) trouvees.push({ position, jour: valide });
  };
  for (const m of texte.matchAll(DATE_CHIFFRES)) noter(m.index, m[3], Number(m[2]), m[1]);
  for (const m of texte.matchAll(DATE_ISO)) noter(m.index, m[1], Number(m[2]), m[3]);
  for (const m of texte.matchAll(DATE_LETTRES)) noter(m.index, m[3], MOIS.indexOf(m[2]) + 1, m[1]);
  trouvees.sort((a, b) => a.position - b.position);
  return trouvees[0]?.jour ?? null;
}

function jourValide(annee: number, mois: number, jour: number): string | null {
  if (annee < 2000 || annee > 2099 || mois < 1 || mois > 12 || jour < 1) return null;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null;
  return d.toISOString().slice(0, 10);
}

/** Un mot ou une expression, entier, dans le texte (« BAR » ne se trouve pas dans « BARQUETTE »). */
export function contientMot(texte: string, mot: string): boolean {
  const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9])${echappe}([^A-Z0-9]|$)`).test(texte);
}

/** La catégorie dont le plus de mots figurent sur le ticket ; null si aucun. */
function categorie(texte: string): CategorieDepense | null {
  let meilleure: CategorieDepense | null = null;
  let meilleurScore = 0;
  for (const [code, mots] of MOTS_CATEGORIE) {
    const score = mots.filter(mot => contientMot(texte, mot)).length;
    if (score > meilleurScore) {
      meilleure = code;
      meilleurScore = score;
    }
  }
  return meilleure;
}
