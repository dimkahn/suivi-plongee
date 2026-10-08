import { Manuel, lireManuel } from '../manuel';

import decouvrirLAppli from './decouvrir-l-appli.md';
import seConnecter from './se-connecter.md';
import monCompte from './mon-compte.md';
import horsLigne from './hors-ligne.md';

import faireLAppel from './faire-l-appel.md';
import noterUnEleve from './noter-un-eleve.md';
import corrigerUneNote from './corriger-une-note.md';
import validerUneCompetence from './valider-une-competence.md';
import droitsDeNotation from './droits-de-notation.md';
import vueEnsembleEleve from './vue-ensemble-eleve.md';
import noterLesPresents from './noter-les-presents.md';
import preparerLaSeance from './preparer-la-seance.md';
import ficheDeSecurite from './fiche-de-securite.md';
import groupesDePlongeurs from './groupes-de-plongeurs.md';
import consulterLePlanning from './consulter-le-planning.md';
import repondrePresence from './repondre-presence.md';
import trombinoscope from './trombinoscope.md';
import infosEleves from './infos-eleves.md';

import administration from './administration.md';
import ouvrirUneSaison from './ouvrir-une-saison.md';
import genererLesSeances from './generer-les-seances.md';
import gererLesSeances from './gerer-les-seances.md';
import ajouterUnMoniteur from './ajouter-un-moniteur.md';
import dossierEleve from './dossier-eleve.md';
import inscrireEnFormation from './inscrire-en-formation.md';
import maintienSansFormation from './maintien-sans-formation.md';
import delivrerUnBrevet from './delivrer-un-brevet.md';
import groupesEntrainement from './groupes-entrainement.md';
import planningDesSoirees from './planning-des-soirees.md';
import progressionType from './progression-type.md';
import referentielMft from './referentiel-mft.md';
import baseDExercices from './base-d-exercices.md';
import organiserUneSortie from './organiser-une-sortie.md';

import inventaireMateriel from './inventaire-materiel.md';
import ajouterUnEquipement from './ajouter-un-equipement.md';
import ficheDeGestion from './fiche-de-gestion.md';
import controlesDUnBloc from './controles-d-un-bloc.md';
import preterDuMateriel from './preter-du-materiel.md';
import photosDuPret from './photos-du-pret.md';
import retourDUnPret from './retour-d-un-pret.md';
import miseAuRebut from './mise-au-rebut.md';
import inspectionTiv from './inspection-tiv.md';
import etiquettesQrCode from './etiquettes-qr-code.md';
import classeurExcelMateriel from './classeur-excel-materiel.md';

import suivreSaProgression from './suivre-sa-progression.md';

/**
 * Tous les manuels, dans l'ordre d'affichage de chaque rubrique. Un nouveau
 * manuel s'ajoute ici (voir LISEZ-MOI.md) ; la clé est son adresse.
 */
const SOURCES: Record<string, string> = {
  'decouvrir-l-appli': decouvrirLAppli,
  'se-connecter': seConnecter,
  'mon-compte': monCompte,
  'hors-ligne': horsLigne,

  'faire-l-appel': faireLAppel,
  'noter-un-eleve': noterUnEleve,
  'corriger-une-note': corrigerUneNote,
  'valider-une-competence': validerUneCompetence,
  'droits-de-notation': droitsDeNotation,
  'vue-ensemble-eleve': vueEnsembleEleve,
  'noter-les-presents': noterLesPresents,
  'preparer-la-seance': preparerLaSeance,
  'fiche-de-securite': ficheDeSecurite,
  'groupes-de-plongeurs': groupesDePlongeurs,
  'consulter-le-planning': consulterLePlanning,
  'repondre-presence': repondrePresence,
  'trombinoscope': trombinoscope,
  'infos-eleves': infosEleves,

  'administration': administration,
  'ouvrir-une-saison': ouvrirUneSaison,
  'generer-les-seances': genererLesSeances,
  'gerer-les-seances': gererLesSeances,
  'ajouter-un-moniteur': ajouterUnMoniteur,
  'dossier-eleve': dossierEleve,
  'inscrire-en-formation': inscrireEnFormation,
  'maintien-sans-formation': maintienSansFormation,
  'delivrer-un-brevet': delivrerUnBrevet,
  'groupes-entrainement': groupesEntrainement,
  'planning-des-soirees': planningDesSoirees,
  'progression-type': progressionType,
  'referentiel-mft': referentielMft,
  'base-d-exercices': baseDExercices,
  'organiser-une-sortie': organiserUneSortie,

  'inventaire-materiel': inventaireMateriel,
  'ajouter-un-equipement': ajouterUnEquipement,
  'fiche-de-gestion': ficheDeGestion,
  'controles-d-un-bloc': controlesDUnBloc,
  'preter-du-materiel': preterDuMateriel,
  'photos-du-pret': photosDuPret,
  'retour-d-un-pret': retourDUnPret,
  'mise-au-rebut': miseAuRebut,
  'inspection-tiv': inspectionTiv,
  'etiquettes-qr-code': etiquettesQrCode,
  'classeur-excel-materiel': classeurExcelMateriel,

  'suivre-sa-progression': suivreSaProgression
};

export const MANUELS: Manuel[] = Object.entries(SOURCES).map(([id, source]) => lireManuel(id, source));

/**
 * Le manuel d'une vidéo (« M3 ») : de préférence celui de la même rubrique,
 * une vidéo pouvant être citée par plusieurs manuels.
 */
export function manuelDeLaVideo(idVideo: string, rubrique?: string): Manuel | undefined {
  const citent = MANUELS.filter(m => m.videos.includes(idVideo));
  return citent.find(m => m.rubrique === rubrique) ?? citent[0];
}
