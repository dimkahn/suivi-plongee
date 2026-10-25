import { SeanceSortieVue } from '../../core/modeles';
import { EvenementVue, JourneeVue, MoyenTransport, PalanqueeVue, ParticipantVue, TRANSPORTS, Trajet, heure, jourLong, nomComplet } from './sejour-api';

// ----------------------------------------------------------------
//  L'encart « Aujourd'hui » du séjour : le séjour commence dès le voyage
//  aller (l'avion pris la veille de la première plongée compte) et finit
//  avec le voyage retour. Chaque jour, les voyages qui partent ce jour-là,
//  avec l'heure à laquelle être à l'aéroport ou à la gare ; la veille, un
//  rappel. Calcul pur, à partir du séjour déjà chargé (pas d'appel).
// ----------------------------------------------------------------

/**
 * Combien de temps avant le départ être sur place (choix du club, 2026 ;
 * avion : 3 h avant l'embarquement depuis octobre 2026, 2 h avant).
 * Même règle que MoyenTransport côté serveur (carnet envoyé par e-mail).
 * Rien pour la voiture : on part quand on veut.
 */
export const AVANCES_TRANSPORT: Partial<Record<MoyenTransport, { minutes: number; ou: string }>> = {
  AVION: { minutes: 180, ou: "à l'aéroport" },
  TRAIN: { minutes: 30, ou: 'à la gare' },
  BATEAU: { minutes: 45, ou: "à l'embarquement" },
  CAR: { minutes: 15, ou: "à l'arrêt du car" }
};

/** Une ligne du programme d'un jour : rendez-vous saisi, ou plongée de la sortie. */
export interface LigneProgramme {
  heure: string;
  titre: string;
  lieu: string | null;
  details: string | null;
  evenement: EvenementVue | null;
  /** Plongée : ses palanquées reçues (toutes pour un encadrant, la sienne sinon). */
  palanquees: PalanqueeVue[];
}

/** Un jour du programme : sa présentation (titre, trajet, photos…) s'il en a une, puis ses lignes. */
export interface JourProgramme {
  jour: string;
  journee: JourneeVue | null;
  lignes: LigneProgramme[];
}

/**
 * Les jours du programme (et ceux des rendez-vous hors des dates de la sortie), rendez-vous puis plongées ;
 * un jour présenté sans rendez-vous compte aussi.
 */
export function programmeParJour(evenements: EvenementVue[], plongees: SeanceSortieVue[],
                                  palanquees: PalanqueeVue[] = [], journees: JourneeVue[] = [])
  : JourProgramme[] {
  const jours = new Map<string, LigneProgramme[]>(journees.map(j => [j.jour, []]));
  const ajouter = (jour: string, l: LigneProgramme) => jours.set(jour, [...(jours.get(jour) ?? []), l]);
  for (const e of evenements) {
    ajouter(e.jour, {
      heure: e.heureDebut ? heure(e.heureDebut) + (e.heureFin ? ' – ' + heure(e.heureFin) : '') : '',
      titre: e.titre, lieu: e.lieu, details: e.details, evenement: e, palanquees: []
    });
  }
  for (const se of plongees) {
    ajouter(se.date, {
      heure: '', titre: 'Plongée' + (se.ordre ? ' ' + se.ordre : ''),
      lieu: [se.lieu, se.site].filter(Boolean).join(' – ') || null, details: se.commentaire, evenement: null,
      palanquees: palanquees.filter(p => p.seanceId === se.id)
    });
  }
  return [...jours.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, lignes]) => ({ jour, journee: journees.find(j => j.jour === jour) ?? null, lignes }));
}

export interface VoyageDuJour {
  sens: 'aller' | 'retour';
  /** « Avion AF7520 », « Train TGV 6171 », « Voiture ». */
  moyen: string;
  /** Heure à laquelle part le transport (« 17h05 »), vide si on ne la connaît pas. */
  heureDepart: string;
  /** D'où l'on part. */
  lieuDepart: string | null;
  /**
   * Pour l'aller : l'arrivée sur place, « 18h30, Aéroport de Toulon-Hyères » ; pour le retour : l'heure d'arrivée,
   * « 21h35 ». Précédée du jour s'il n'est pas celui du départ : « mercredi 16/06/2027 à 06h10 ».
   */
  arrivee: string | null;
  /** « Soyez à l'aéroport vers 14h05 (3 h avant). » ; null s'il n'y a pas de conseil. */
  conseil: string | null;
  /** Aller en avion, train… sans l'heure de départ : le conseil ne peut pas être calculé. */
  heureManquante: boolean;
  noms: string[];
  ids: number[];
}

/** « 2027-06-03 » décalé de n jours. */
export function decalerJour(iso: string, n: number): string {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Le jour où l'on part de chez soi (aller) ou du séjour (retour). Un avion
 * aller qui part plus tard qu'il n'arrive est un vol de nuit : départ la veille,
 * sauf si le jour de départ de l'avion est saisi (vol long).
 */
export function jourDuDepart(t: Trajet | null, sens: 'aller' | 'retour'): string | null {
  if (sens === 'aller' && t?.dateDepart) return t.dateDepart;
  if (!t?.date) return null;
  if (sens === 'aller' && t.heureDepart && t.heure && t.heureDepart.slice(0, 5) > t.heure.slice(0, 5)) {
    return decalerJour(t.date, -1);
  }
  return t.date;
}

/** « Soyez à l'aéroport vers 14h05 (3 h avant). » pour un avion à 17h05 ; null sans conseil. */
export function conseilDepart(transport: MoyenTransport | null, depart: string | null): string | null {
  const avance = transport ? AVANCES_TRANSPORT[transport] : undefined;
  if (!avance || !depart) return null;
  const [h, m] = depart.split(':').map(Number);
  let minutes = h * 60 + m - avance.minutes;
  const veille = minutes < 0;
  if (veille) minutes += 24 * 60;
  const vers = `${String(Math.floor(minutes / 60)).padStart(2, '0')}h${String(minutes % 60).padStart(2, '0')}`;
  const delai = avance.minutes >= 60 ? `${avance.minutes / 60} h` : `${avance.minutes} min`;
  return `Soyez ${avance.ou} vers ${vers}${veille ? ' la veille' : ''} (${delai} avant).`;
}

/** Les voyages qui partent ce jour-là, regroupés (même moyen, même numéro, même heure, même lieu). */
export function voyagesDuJour(participants: ParticipantVue[], jour: string): VoyageDuJour[] {
  const groupes = new Map<string, VoyageDuJour & { tri: string }>();
  for (const p of participants) {
    for (const sens of ['aller', 'retour'] as const) {
      const t = sens === 'aller' ? p.arrivee : p.depart;
      if (!t || jourDuDepart(t, sens) !== jour) continue;
      const depart = (sens === 'aller' ? t.heureDepart : t.heure)?.slice(0, 5) ?? null;
      const lieuDepart = (sens === 'aller' ? t.lieuDepart : t.lieu) ?? null;
      const cle = [sens, t.transport, t.numero, depart, lieuDepart,
        sens === 'aller' ? `${t.date} ${t.heure} ${t.lieu}` : `${t.dateArrivee} ${t.heureArrivee} ${t.lieuArrivee}`]
        .join('|');
      // Arrivée un autre jour que le départ (vol de nuit, vol long) : on dit lequel.
      const jourArrivee = sens === 'aller' ? t.date : t.dateArrivee;
      const autreJour = jourArrivee && jourArrivee !== jour ? jourLong(jourArrivee).toLowerCase() : null;
      const heureArrivee = heure((sens === 'aller' ? t.heure : t.heureArrivee) ?? null);
      const v: VoyageDuJour & { tri: string } = groupes.get(cle) ?? {
        sens,
        moyen: [TRANSPORTS.find(x => x.code === t.transport)?.libelle, t.numero].filter(Boolean).join(' ') || 'Voyage',
        heureDepart: heure(depart),
        lieuDepart,
        arrivee: [
          [autreJour, heureArrivee].filter(Boolean).join(' à ') || null,
          sens === 'aller' ? t.lieu : t.lieuArrivee
        ].filter(Boolean).join(', ') || null,
        conseil: conseilDepart(t.transport, depart),
        heureManquante: !depart && !!t.transport && !!AVANCES_TRANSPORT[t.transport],
        noms: [], ids: [],
        tri: `${sens === 'aller' ? 0 : 1} ${depart ?? '99'}`
      };
      v.noms.push(nomComplet(p));
      v.ids.push(p.id);
      groupes.set(cle, v);
    }
  }
  return [...groupes.values()].sort((a, b) => a.tri.localeCompare(b.tri));
}

/**
 * Du jour du premier départ (aller) au jour du dernier retour, et au moins
 * les dates de la sortie : les jours où l'encart « Aujourd'hui » s'affiche
 * (et la veille du premier, pour le rappel).
 */
export function joursDuVoyage(participants: ParticipantVue[], debut: string, fin: string): { debut: string; fin: string } {
  let premier = debut;
  let dernier = fin;
  for (const p of participants) {
    const aller = jourDuDepart(p.arrivee, 'aller');
    const retour = jourDuDepart(p.depart, 'retour');
    if (aller && aller < premier) premier = aller;
    if (retour && retour > dernier) dernier = retour;
  }
  return { debut: premier, fin: dernier };
}
