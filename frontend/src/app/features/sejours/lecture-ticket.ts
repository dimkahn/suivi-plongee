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

/** Les lignes qui donnent ce qui a été payé… */
const LIGNE_TOTAL = /\b(TOTAL|NET A PAYER|A PAYER|MONTANT|TTC|CB|CARTE BANCAIRE|CARTE|ESPECES|PAYE)\b/;
/** … et celles qui leur ressemblent sans l'être. */
const LIGNE_PAS_TOTAL = /SOUS[- ]?TOTAL|S\/TOTAL|\bTVA\b|\bHT\b|RENDU|MONNAIE|REMISE|ECONOMI|FIDELITE|POINTS|CAGNOTTE/;

const DATE_CHIFFRES = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;
const MOIS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE',
  'NOVEMBRE', 'DECEMBRE'];
const DATE_LETTRES = new RegExp(`(?<!\\d)(\\d{1,2})(?:ER)?\\s+(${MOIS.join('|')})\\s+(\\d{4})(?!\\d)`, 'g');

/** Mots du commerçant ou des achats, par catégorie ; à égalité, la première de la liste l'emporte. */
const MOTS_CATEGORIE: [CategorieDepense, string[]][] = [
  ['PLONGEE', ['PLONGEE', 'PLONGEES', 'SUBAQUATIQUE', 'GONFLAGE', 'NITROX', 'SCUBA', 'DIVE', 'DIVING']],
  ['HEBERGEMENT', ['HOTEL', 'GITE', 'CAMPING', 'CHAMBRE', 'CHAMBRES', 'AIRBNB', 'NUITEE', 'NUITEES', 'NUIT', 'NUITS',
    'HEBERGEMENT', 'RESIDENCE', 'TAXE DE SEJOUR']],
  ['TRANSPORT', ['CARBURANT', 'GAZOLE', 'GASOIL', 'DIESEL', 'SP95', 'SP98', 'E10', 'ESSENCE', 'STATION', 'PEAGE',
    'AUTOROUTE', 'AUTOROUTES', 'VINCI', 'SANEF', 'APRR', 'SNCF', 'TGV', 'TER', 'OUIGO', 'BILLET', 'PARKING',
    'STATIONNEMENT', 'TAXI', 'UBER', 'FERRY', 'TRAVERSEE', 'NAVETTE', 'BATEAU', 'TOTALENERGIES', 'ESSO', 'SHELL',
    'BP', 'AVIA', 'HERTZ', 'EUROPCAR', 'SIXT']],
  ['REPAS', ['RESTAURANT', 'BRASSERIE', 'PIZZERIA', 'CREPERIE', 'BOULANGERIE', 'PATISSERIE', 'CARREFOUR', 'LECLERC',
    'INTERMARCHE', 'AUCHAN', 'LIDL', 'CASINO', 'SPAR', 'MONOPRIX', 'FRANPRIX', 'ALDI', 'NETTO', 'SUPER U', 'HYPER U',
    'U EXPRESS', 'SUPERMARCHE', 'EPICERIE', 'TRAITEUR', 'CAFE', 'BAR', 'SNACK', 'MENU', 'COUVERT', 'COUVERTS',
    'BOISSON', 'BOISSONS', 'PAIN', 'GLACE', 'GLACES', 'GLACIER']]
];

/** Le total, la date et la catégorie trouvés dans le texte d'un ticket ; null pour ce qui n'y est pas. */
export function analyserTicket(texte: string): NoteLue {
  const lignes = normaliser(texte).split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return { montantCentimes: total(lignes), jour: date(lignes.join('\n')), categorie: categorie(lignes.join('\n')) };
}

/** Majuscules sans accents : « Net à payer » → « NET A PAYER ». */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Les montants d'une ligne, en centimes, sans les dates (« 10.06.27 » n'est pas 10,06 €). */
function montants(ligne: string): number[] {
  const sansDates = ligne.replace(DATE_CHIFFRES, ' ');
  return [...sansDates.matchAll(MONTANT)]
    .map(m => Number(m[1].replace(/[ .]/g, '')) * 100 + Number(m[2]))
    .filter(c => c > 0 && c <= MONTANT_MAX_CENTIMES);
}

/**
 * Le plus gros montant des lignes « total », « net à payer », « CB »… (ou de
 * la ligne qui suit, quand le montant est écrit dessous) ; à défaut, le plus
 * gros montant du ticket.
 */
function total(lignes: string[]): number | null {
  const candidats: number[] = [];
  lignes.forEach((ligne, i) => {
    if (!LIGNE_TOTAL.test(ligne) || LIGNE_PAS_TOTAL.test(ligne)) return;
    const surLaLigne = montants(ligne);
    if (surLaLigne.length > 0) candidats.push(surLaLigne[surLaLigne.length - 1]);
    else if (i + 1 < lignes.length && !LIGNE_PAS_TOTAL.test(lignes[i + 1])) candidats.push(...montants(lignes[i + 1]));
  });
  const tous = candidats.length > 0 ? candidats : lignes.filter(l => !LIGNE_PAS_TOTAL.test(l)).flatMap(montants);
  return tous.length > 0 ? Math.max(...tous) : null;
}

/** La première date valide, en chiffres ou en toutes lettres, au format AAAA-MM-JJ. */
function date(texte: string): string | null {
  const trouvees: { position: number; jour: string }[] = [];
  for (const m of texte.matchAll(DATE_CHIFFRES)) {
    const annee = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const jour = jourValide(annee, Number(m[2]), Number(m[1]));
    if (jour) trouvees.push({ position: m.index, jour });
  }
  for (const m of texte.matchAll(DATE_LETTRES)) {
    const jour = jourValide(Number(m[3]), MOIS.indexOf(m[2]) + 1, Number(m[1]));
    if (jour) trouvees.push({ position: m.index, jour });
  }
  trouvees.sort((a, b) => a.position - b.position);
  return trouvees[0]?.jour ?? null;
}

function jourValide(annee: number, mois: number, jour: number): string | null {
  if (annee < 2000 || annee > 2099 || mois < 1 || mois > 12 || jour < 1) return null;
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null;
  return d.toISOString().slice(0, 10);
}

/** La catégorie dont le plus de mots figurent sur le ticket ; null si aucun. */
function categorie(texte: string): CategorieDepense | null {
  let meilleure: CategorieDepense | null = null;
  let meilleurScore = 0;
  for (const [code, mots] of MOTS_CATEGORIE) {
    const score = mots.filter(mot => new RegExp(`(^|[^A-Z0-9])${mot}([^A-Z0-9]|$)`).test(texte)).length;
    if (score > meilleurScore) {
      meilleure = code;
      meilleurScore = score;
    }
  }
  return meilleure;
}
