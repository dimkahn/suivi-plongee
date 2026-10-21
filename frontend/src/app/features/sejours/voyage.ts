import { VoyageDuJour, decalerJour, jourDuDepart } from './programme-du-jour';
import { ParticipantVue, Trajet, copieTrajet, heure, jourLong } from './sejour-api';

// ----------------------------------------------------------------
//  La carte d'un voyage (demande du club, 2026 : lisible comme la page
//  d'enregistrement d'une compagnie) : départ et arrivée face à face,
//  « +1 jour », terminal, compagnie reconnue au numéro de vol, ouverture de
//  l'enregistrement en ligne. Rien n'est lu chez la compagnie (ni retard ni
//  terminal en direct) : tout vient de ce qui a été saisi.
// ----------------------------------------------------------------

export interface Compagnie { nom: string; site: string; }

/** Un voyage par un transport public, avec au moins son jour ou son heure : montré en carte. */
export function enCarte(t: Trajet | null): boolean {
  return !!t && (!!t.date || !!t.heure) && ['AVION', 'TRAIN', 'BATEAU', 'CAR'].includes(t.transport ?? '');
}

/**
 * Les compagnies que le club prend le plus, par code IATA (les deux
 * premiers caractères du numéro de vol). Le site est la page d'accueil :
 * l'adresse exacte de l'enregistrement change trop souvent pour la figer ;
 * un lien direct se colle dans le voyage (« Lien d'enregistrement »).
 */
const COMPAGNIES: Record<string, Compagnie> = {
  AF: { nom: 'Air France', site: 'https://wwws.airfrance.fr' },
  TX: { nom: 'Air Caraïbes', site: 'https://www.aircaraibes.com' },
  SS: { nom: 'Corsair', site: 'https://www.flycorsair.com' },
  BF: { nom: 'French bee', site: 'https://www.frenchbee.com' },
  TO: { nom: 'Transavia', site: 'https://www.transavia.com' },
  U2: { nom: 'easyJet', site: 'https://www.easyjet.com' },
  V7: { nom: 'Volotea', site: 'https://www.volotea.com' },
  FR: { nom: 'Ryanair', site: 'https://www.ryanair.com' },
  KL: { nom: 'KLM', site: 'https://www.klm.fr' },
  IB: { nom: 'Iberia', site: 'https://www.iberia.com' },
  VY: { nom: 'Vueling', site: 'https://www.vueling.com' },
  LH: { nom: 'Lufthansa', site: 'https://www.lufthansa.com' },
  TU: { nom: 'Tunisair', site: 'https://www.tunisair.com' },
  AT: { nom: 'Royal Air Maroc', site: 'https://www.royalairmaroc.com' },
  MS: { nom: 'EgyptAir', site: 'https://www.egyptair.com' },
  UU: { nom: 'Air Austral', site: 'https://www.air-austral.com' }
};

/** « TX 510 » → Air Caraïbes ; null pour un numéro inconnu ou un train (« TGV 6171 »). */
export function compagnieDuVol(numero: string | null | undefined): Compagnie | null {
  const m = numero?.trim().toUpperCase().match(/^([A-Z0-9]{2})\s?\d{1,4}[A-Z]?$/);
  return m ? COMPAGNIES[m[1]] ?? null : null;
}

export interface EtapeVoyage {
  /** « 12h20 ». */
  heure: string | null;
  /** Le jour, ISO. */
  jour: string | null;
  lieu: string | null;
  terminal: string | null;
}

export interface CarteVoyage {
  depart: EtapeVoyage;
  arrivee: EtapeVoyage;
  /** L'arrivée tombe ce nombre de jours après le départ (« +1 jour »). */
  joursEnPlus: number;
}

/**
 * Aller : l'avion part de {@code lieuDepart} (terminal saisi) et arrive sur
 * place ({@code lieu}) ; parti la veille s'il part plus tard qu'il n'arrive
 * (même règle que « Aujourd'hui »). Retour : il part du séjour et arrive à
 * {@code lieuArrivee}, le lendemain s'il arrive plus tôt qu'il ne part.
 */
export function carteVoyage(t: Trajet, aller: boolean): CarteVoyage {
  const terminal = t.terminal?.trim() || null;
  let depart: EtapeVoyage, arrivee: EtapeVoyage;
  if (aller) {
    depart = { heure: heure(t.heureDepart ?? null) || null, jour: jourDuDepart(t, 'aller'), lieu: t.lieuDepart ?? null, terminal };
    arrivee = { heure: heure(t.heure) || null, jour: t.date, lieu: t.lieu, terminal: null };
  } else {
    const lendemain = !t.dateArrivee && !!t.date && !!t.heure && !!t.heureArrivee
      && t.heureArrivee.slice(0, 5) < t.heure.slice(0, 5);
    depart = { heure: heure(t.heure) || null, jour: t.date, lieu: t.lieu, terminal };
    arrivee = {
      heure: heure(t.heureArrivee ?? null) || null,
      jour: t.dateArrivee ?? (t.date && lendemain ? decalerJour(t.date, 1) : t.date),
      lieu: t.lieuArrivee ?? null, terminal: null
    };
  }
  return { depart, arrivee, joursEnPlus: ecartJours(depart.jour, arrivee.jour) };
}

function ecartJours(de: string | null, a: string | null): number {
  if (!de || !a) return 0;
  const jour = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((jour(a) - jour(de)) / 86_400_000);
}

export interface EtatEnregistrement { etat: 'bientot' | 'ouvert'; texte: string; }

/**
 * « L'enregistrement ouvre le mardi 20/10 à 12h20 », puis « Enregistrement
 * ouvert » jusqu'au départ ; null sans date d'ouverture ou une fois parti.
 */
export function enregistrement(t: Trajet, aller: boolean, maintenant: Date): EtatEnregistrement | null {
  const ouverture = t.ouvertureEnregistrement;
  if (!ouverture) return null;
  const { depart } = carteVoyage(t, aller);
  if (depart.jour && moment(depart.jour, depart.heure?.replace('h', ':') ?? '23:59') <= maintenant) return null;
  const [jour, h] = ouverture.split('T');
  if (moment(jour, h ?? '00:00') > maintenant) {
    return { etat: 'bientot', texte: `L'enregistrement ouvre le ${jourLong(jour).slice(0, -5).toLowerCase()} à ${heure(h ?? null)}` };
  }
  return { etat: 'ouvert', texte: 'Enregistrement ouvert' };
}

/**
 * « Même voyage que… » dans la fiche d'un participant : le vol de l'autre,
 * mais le dossier et le lien déjà dans la fiche (ceux de l'autre lui
 * permettraient d'agir sur son billet).
 */
export function memeVoyageQue(autre: Trajet | null, actuel: Trajet | null): Trajet {
  return { ...copieTrajet(autre), dossier: actuel?.dossier ?? null, lienEnregistrement: actuel?.lienEnregistrement ?? null };
}

/**
 * Un voyage de l'encart « Aujourd'hui » (ou du rappel de la veille) : le
 * sien, en avion, train, bateau ou car, se montre en carte comme dans « Mon
 * séjour » (demande du club, 2026) ; null pour les autres, qui restent en ligne.
 */
export function voyageEnCarte(v: VoyageDuJour, moi: ParticipantVue | undefined): Trajet | null {
  if (!moi || !v.ids.includes(moi.id)) return null;
  const t = v.sens === 'aller' ? moi.arrivee : moi.depart;
  return enCarte(t) ? t : null;
}

/** Le serveur refuse au-delà de 5 Mo. */
const CARTE_MAX_OCTETS = 5 * 1024 * 1024;

/**
 * La carte d'embarquement choisie : un PDF part tel quel ; toute photo
 * (JPEG, PNG, HEIC de l'iPhone) est recodée en JPEG par le téléphone, ce
 * qui en retire les métadonnées (position GPS de la prise de vue) ; le
 * reste est refusé.
 */
export function envoiCarte(type: string, taille: number): 'tel-quel' | 'reduire' | 'refus' {
  if (type === 'application/pdf') return taille <= CARTE_MAX_OCTETS ? 'tel-quel' : 'refus';
  return type.startsWith('image/') ? 'reduire' : 'refus';
}

function moment(jour: string, h: string): Date {
  const [y, m, d] = jour.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
