import { OptionOnglet } from '../../core/onglets.component';

/**
 * Les cinq onglets du séjour (demande du club, 2026 : dix onglets, c'était
 * trop). Chacun regroupe des sections, montrées une à une par ses
 * sous-onglets (`rubriquesSejour`), chacune avec son ancre :
 * - Programme : le programme, puis les fiches de sécurité (encadrants) ;
 * - Qui et où : participants (encadrants), arrivées et départs, voitures, logements ;
 * - Repas : régimes et courses (encadrants), restaurant ;
 * - Frais ;
 * - Pratique : affaires à prévoir, infos pratiques, matériel emprunté.
 */
export type OngletSejour = 'programme' | 'personnes' | 'repas' | 'frais' | 'pratique';

/** Ce qu'on ouvre : un onglet, et la section où descendre (null : en haut). */
export interface OuvertureSejour {
  onglet: OngletSejour;
  ancre: string | null;
}

const LIBELLES: Record<OngletSejour, string> = {
  programme: 'Programme', personnes: 'Qui et où', repas: 'Repas', frais: 'Frais', pratique: 'Pratique'
};

/**
 * Les anciens onglets, devenus sections : un lien gardé (`?onglet=fiches`,
 * retour d'une fiche de sécurité) ou une tuile de « Mon séjour » y mène encore.
 */
const ANCIENS: Record<string, OuvertureSejour> = {
  fiches: { onglet: 'programme', ancre: 'fiches-securite-sejour' },
  participants: { onglet: 'personnes', ancre: 'participants-sejour' },
  transports: { onglet: 'personnes', ancre: 'trajets-sejour' },
  hebergement: { onglet: 'personnes', ancre: 'logements-sejour' },
  courses: { onglet: 'repas', ancre: 'courses-sejour' },
  restaurant: { onglet: 'repas', ancre: 'restaurant-sejour' },
  materiel: { onglet: 'pratique', ancre: 'materiel-sejour' }
};

/** La rangée d'onglets ; les points à vérifier (voitures, chambres) comptés sur « Qui et où ». */
export function ongletsSejour(alertes: { transports: number; hebergement: number }): OptionOnglet<OngletSejour>[] {
  return (Object.keys(LIBELLES) as OngletSejour[]).map(valeur => ({
    valeur,
    libelle: LIBELLES[valeur],
    ...(valeur === 'personnes' ? { alertes: alertes.transports + alertes.hebergement } : {})
  }));
}

/** Ce qui décide des rubriques montrées : encadrant ou non, fiches lues, points à vérifier. */
export interface ContexteRubriques {
  encadrant: boolean;
  fiches: boolean;
  alertes: { voitures: number; logements: number };
}

/**
 * Les rubriques d'un onglet, en sous-onglets : une seule montrée à la fois
 * (demande du club, 2026 : les sections empilées restaient trop longues au
 * téléphone). La valeur est l'ancre de la section ; un participant n'a pas
 * celles des encadrants ; les points à vérifier sur la rubrique qui les règle.
 */
export function rubriquesSejour(onglet: OngletSejour, c: ContexteRubriques): OptionOnglet<string>[] {
  const r = (valeur: string, libelle: string, montree = true, alertes = 0): OptionOnglet<string>[] =>
    montree ? [{ valeur, libelle, ...(alertes ? { alertes } : {}) }] : [];
  switch (onglet) {
    case 'programme': return [...r('programme-sejour', 'Programme'),
      ...r('fiches-securite-sejour', 'Fiches de sécurité', c.encadrant && c.fiches)];
    case 'personnes': return [...r('participants-sejour', 'Participants', c.encadrant),
      ...r('trajets-sejour', 'Arrivées et départs'), ...r('voitures-sejour', 'Voitures', true, c.alertes.voitures),
      ...r('logements-sejour', 'Logements', true, c.alertes.logements)];
    case 'repas': return [...r('regimes-sejour', 'Régimes', c.encadrant),
      ...r('courses-sejour', 'Courses', c.encadrant), ...r('restaurant-sejour', 'Restaurant')];
    case 'frais': return r('frais-sejour', 'Frais');
    case 'pratique': return [...r('affaires-sejour', 'Affaires à prévoir'),
      ...r('infos-sejour', 'Infos pratiques'), ...r('materiel-sejour', 'Matériel emprunté')];
  }
}

/** La rubrique montrée : la demandée si l'onglet l'a, sinon la première. */
export function rubriqueChoisie(rubriques: readonly OptionOnglet<string>[], demandee: string | null): string | null {
  return rubriques.find(r => r.valeur === demandee)?.valeur ?? rubriques[0]?.valeur ?? null;
}

/** L'onglet demandé, ancien nom compris ; inconnu ou absent : le programme. */
export function ouvertureDemandee(demande: string | null): OuvertureSejour {
  if (demande && Object.hasOwn(LIBELLES, demande)) return { onglet: demande as OngletSejour, ancre: null };
  if (demande && Object.hasOwn(ANCIENS, demande)) return ANCIENS[demande];
  return { onglet: 'programme', ancre: null };
}
