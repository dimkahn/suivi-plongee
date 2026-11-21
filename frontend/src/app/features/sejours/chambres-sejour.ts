import { DemandeLogement, LogementVue, ParticipantVue } from './sejour-api';

/** Une chambre qui a encore un lit : « Gîte des Salins — Chambre 3 », 2 lits libres. */
export interface ChambreLibre {
  logementId: number;
  chambreId: number;
  libelle: string;
  libres: number;
}

/** Les participants dans aucune chambre, comme le compte le serveur (seulement s'il y a un logement). */
export function sansChambre(participants: readonly ParticipantVue[], logements: readonly LogementVue[]): ParticipantVue[] {
  if (logements.length === 0) return [];
  const loges = new Set(logements.flatMap(l => l.chambres.flatMap(c => c.occupantIds)));
  return participants.filter(p => !loges.has(p.id));
}

/** Les chambres qui ont encore au moins un lit libre, dans l'ordre des logements. */
export function chambresLibres(logements: readonly LogementVue[]): ChambreLibre[] {
  return logements.flatMap(l => l.chambres
    .filter(c => c.occupantIds.length < c.couchages)
    .map(c => ({ logementId: l.id, chambreId: c.id, libelle: `${l.nom} — ${c.nom}`, libres: c.couchages - c.occupantIds.length })));
}

/** Le logement à enregistrer, avec le participant ajouté à la chambre choisie. */
export function placer(logement: LogementVue, chambreId: number, participantId: number): DemandeLogement {
  return {
    nom: logement.nom, adresse: logement.adresse, remarques: logement.remarques,
    chambres: logement.chambres.map(c => ({
      nom: c.nom, couchages: c.couchages, remarques: c.remarques,
      occupantIds: c.id === chambreId ? [...c.occupantIds, participantId] : [...c.occupantIds]
    }))
  };
}
