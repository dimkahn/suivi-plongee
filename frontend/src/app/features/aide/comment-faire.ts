import { Manuel } from './manuel';
import { MANUELS } from './manuels';

/**
 * « Comment faire ? » : les manuels de chaque écran, montrés par le bouton
 * de la barre de page (core/barre-page.component.ts). Un écran est décrit
 * par son adresse, « :x » pour une partie variable (« /cursus/:x » est la
 * fiche de suivi de n'importe quel élève). Un écran qui n'est pas dans la
 * liste montre « L'appli en bref ».
 *
 * Ce fichier n'est chargé qu'au premier appui sur le bouton : les manuels ne
 * pèsent pas sur l'ouverture de l'appli.
 */
const ECRANS: { adresse: string; manuels: string[]; pourEleve?: string[] }[] = [
  { adresse: '/connexion', manuels: ['se-connecter'] },
  { adresse: '/reinitialiser-mot-de-passe', manuels: ['se-connecter'] },
  { adresse: '/aujourdhui', manuels: ['aujourdhui', 'hors-ligne'] },
  { adresse: '/mon-compte', manuels: ['mon-compte'] },
  { adresse: '/videos', manuels: ['decouvrir-l-appli'] },

  { adresse: '/cursus', manuels: ['suivre-sa-progression'] },
  {
    adresse: '/cursus/:x',
    manuels: ['noter-un-eleve', 'corriger-une-note', 'valider-une-competence', 'droits-de-notation', 'hors-ligne'],
    pourEleve: ['suivre-sa-progression']
  },
  { adresse: '/cursus/:x/matrice', manuels: ['vue-ensemble-eleve', 'corriger-une-note'], pourEleve: ['suivre-sa-progression'] },
  { adresse: '/cursus/:x/synthese', manuels: ['synthese-des-competences'], pourEleve: ['suivre-sa-progression'] },

  { adresse: '/eleves', manuels: ['infos-eleves', 'noter-un-eleve', 'vue-ensemble-eleve', 'synthese-des-competences'] },
  { adresse: '/groupes-entrainement/synthese', manuels: ['synthese-des-competences'] },
  { adresse: '/presences', manuels: ['faire-l-appel', 'noter-les-presents', 'synthese-des-notes', 'preparer-la-seance'] },
  { adresse: '/seances/:x/programme', manuels: ['preparer-la-seance'] },
  { adresse: '/seances/:x/synthese', manuels: ['synthese-des-notes'] },
  { adresse: '/parcours', manuels: ['parcours-de-formation'] },
  { adresse: '/exercices/:x', manuels: ['parcours-de-formation'] },
  { adresse: '/planning', manuels: ['consulter-le-planning', 'repondre-presence'] },
  { adresse: '/trombinoscope', manuels: ['trombinoscope'] },
  { adresse: '/fiches-securite', manuels: ['fiche-de-securite'] },
  { adresse: '/fiches-securite/:x', manuels: ['fiche-de-securite'] },
  { adresse: '/fiches-securite/:x/realise', manuels: ['fiche-de-securite'] },
  { adresse: '/groupes', manuels: ['groupes-de-plongeurs'] },
  { adresse: '/sejours', manuels: ['organiser-un-sejour', 'carnet-du-sejour'], pourEleve: ['carnet-du-sejour'] },
  { adresse: '/sejours/:x', manuels: ['organiser-un-sejour', 'carnet-du-sejour'], pourEleve: ['carnet-du-sejour'] },

  { adresse: '/admin', manuels: ['administration', 'ouvrir-une-saison'] },
  { adresse: '/admin/moniteurs', manuels: ['ajouter-un-moniteur'] },
  { adresse: '/admin/eleves', manuels: ['dossier-eleve', 'maintien-sans-formation'] },
  { adresse: '/admin/saisons', manuels: ['ouvrir-une-saison'] },
  { adresse: '/admin/cursus', manuels: ['inscrire-en-formation', 'delivrer-un-brevet', 'maintien-sans-formation'] },
  { adresse: '/admin/referentiel', manuels: ['referentiel-mft'] },
  { adresse: '/admin/exercices', manuels: ['base-d-exercices'] },
  { adresse: '/admin/groupes-entrainement', manuels: ['groupes-entrainement'] },
  { adresse: '/admin/planning', manuels: ['planning-des-soirees'] },
  { adresse: '/admin/sorties', manuels: ['organiser-une-sortie', 'organiser-un-sejour'] },
  { adresse: '/admin/seances', manuels: ['gerer-les-seances', 'generer-les-seances'] },
  { adresse: '/admin/seances/generer', manuels: ['generer-les-seances'] },
  { adresse: '/admin/progressions', manuels: ['progression-type'] },
  { adresse: '/admin/identite', manuels: ['identite-de-la-structure'] },

  {
    adresse: '/materiel',
    manuels: ['inventaire-materiel', 'ajouter-un-equipement', 'etiquettes-qr-code', 'classeur-excel-materiel']
  },
  { adresse: '/materiel/nouveau', manuels: ['ajouter-un-equipement'] },
  { adresse: '/materiel/prets', manuels: ['preter-du-materiel', 'photos-du-pret', 'retour-d-un-pret', 'organiser-une-sortie'] },
  { adresse: '/materiel/etiquettes', manuels: ['etiquettes-qr-code'] },
  { adresse: '/materiel/scanner', manuels: ['etiquettes-qr-code'] },
  { adresse: '/materiel/tiv/:x', manuels: ['inspection-tiv'] },
  { adresse: '/materiel/:x/tiv', manuels: ['inspection-tiv'] },
  { adresse: '/materiel/:x', manuels: ['fiche-de-gestion', 'controles-d-un-bloc', 'inspection-tiv', 'mise-au-rebut'] }
];

const PAR_DEFAUT = ['decouvrir-l-appli'];

/** « /cursus/12/matrice » correspond à « /cursus/:x/matrice ». */
function correspond(adresse: string, segments: string[]): boolean {
  const attendus = adresse.split('/').filter(s => s);
  return attendus.length === segments.length
    && attendus.every((a, i) => a === ':x' || a === segments[i]);
}

/**
 * Les manuels qui expliquent l'écran ouvert, le plus utile d'abord. Le chemin
 * est l'adresse sans paramètres (« /cursus/12 »). Une adresse précise
 * (« /materiel/scanner ») passe avant une adresse variable (« /materiel/:x »).
 */
export function manuelsDeLEcran(chemin: string, encadrant: boolean): Manuel[] {
  const segments = chemin.split('/').filter(s => s);
  const candidats = ECRANS.filter(e => correspond(e.adresse, segments));
  const ecran = candidats.find(e => !e.adresse.includes(':x')) ?? candidats[0];
  const ids = ecran ? (!encadrant && ecran.pourEleve ? ecran.pourEleve : ecran.manuels) : PAR_DEFAUT;
  return ids
    .map(id => MANUELS.find(m => m.id === id))
    .filter((m): m is Manuel => !!m);
}

/** Un manuel renommé ou supprimé sans mettre cette liste à jour se signale dans la console. */
const INCONNUS = ECRANS.flatMap(e => [...e.manuels, ...(e.pourEleve ?? [])])
  .filter(id => !MANUELS.some(m => m.id === id));
if (INCONNUS.length) console.error('Comment faire ? : manuels introuvables', INCONNUS);
