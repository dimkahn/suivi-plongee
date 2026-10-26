import { OptionOnglet } from '../../core/onglets.component';

/**
 * Les cinq onglets du séjour (demande du club, 2026 : dix onglets, c'était
 * trop). Chacun regroupe des sections, chacune avec son ancre :
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

/** L'onglet demandé, ancien nom compris ; inconnu ou absent : le programme. */
export function ouvertureDemandee(demande: string | null): OuvertureSejour {
  if (demande && Object.hasOwn(LIBELLES, demande)) return { onglet: demande as OngletSejour, ancre: null };
  if (demande && Object.hasOwn(ANCIENS, demande)) return ANCIENS[demande];
  return { onglet: 'programme', ancre: null };
}
