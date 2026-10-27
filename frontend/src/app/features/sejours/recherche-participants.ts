import { normaliser } from '../../core/seance-lieu';
import { ParticipantVue, Trajet } from './sejour-api';

/** Les filtres de la liste des participants (onglet « Participants »). */
export type FiltreParticipants = 'tous' | 'a-completer' | 'sans-attestation';

/** Ce qu'un participant n'a pas encore renseigné ; vide s'il a tout donné. */
export function manqueDe(p: ParticipantVue): string[] {
  const rien = (t: Trajet | null) => !t?.date && !t?.heure;
  return [
    rien(p.arrivee) ? 'arrivée' : null,
    rien(p.depart) ? 'départ' : null,
    !p.urgenceNom && !p.urgenceTelephone ? 'personne à prévenir' : null
  ].filter((x): x is string => x !== null);
}

/**
 * Les participants qui correspondent au texte cherché et au filtre. Chaque mot
 * cherché doit figurer dans le prénom, le nom, le groupe, l'e-mail ou le
 * téléphone (casse, accents et espaces du téléphone ignorés).
 */
export function filtrerParticipants(participants: ParticipantVue[], recherche: string,
                                    filtre: FiltreParticipants): ParticipantVue[] {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  return participants.filter(p => {
    if (filtre === 'a-completer' && manqueDe(p).length === 0) return false;
    if (filtre === 'sans-attestation' && p.attestationAssurance) return false;
    const texte = normaliser([p.prenom, p.nom, p.groupe, p.email, p.telephone?.replace(/\s/g, '')].join(' '));
    return mots.every(m => texte.includes(m));
  });
}
