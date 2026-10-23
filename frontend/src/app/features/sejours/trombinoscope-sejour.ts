import { Observable } from 'rxjs';
import { OptionOnglet } from '../../core/onglets.component';

/**
 * Le trombinoscope du séjour, dans l'appli comme par la page du lien : le
 * serveur filtre selon qui lit. Les écritures (photo d'un invité, photo
 * montrée aux participants) n'existent que pour les organisateurs, dans
 * l'appli.
 */
export interface PortTrombinoscope {
  lister(): Observable<LigneTrombinoscopeSejour[]>;
  photo(participantId: number): Observable<Blob>;
  /** {@code accord} : la case cochée à l'écran, revérifiée par le serveur. */
  deposerPhotoInvite?(participantId: number, fichier: File, accord: boolean): Observable<void>;
  retirerPhotoInvite?(participantId: number): Observable<void>;
  rendreVisible?(participantId: number, visible: boolean, accord: boolean): Observable<void>;
}

/** Un participant du séjour dans le trombinoscope (TrombinoscopeSejourService). */
export interface LigneTrombinoscopeSejour {
  participantId: number;
  nom: string;
  prenom: string;
  plongeur: boolean;
  /** Le groupe de plongeurs du participant, null hors groupe (accompagnant, plongeur ajouté seul). */
  groupe: string | null;
  /** Son niveau dans ce groupe (N2, PE40…). */
  aptitude: string | null;
  /** Faux sans photo ou sans droit à l'image. */
  aPhoto: boolean;
  /** Ni dossier élève ni compte : sa photo se dépose dans le séjour, par un organisateur. */
  invite: boolean;
  /** Sa photo est montrée aux autres participants (accord confirmé par un organisateur). */
  visibleParticipants: boolean;
  /** Celui de son compte d'encadrant (E1 à E4), null sans compte. */
  niveauEncadrement: string | null;
  /** Son niveau de plongeur (N1 à N5), lu sur le même compte. */
  niveauPlongeur: string | null;
}

/**
 * La ligne sous le nom, à l'écran et sur l'image : pour un encadrant, son
 * niveau d'encadrement, et aussi son niveau de plongeur s'il est E1 (un E1
 * peut n'être que N2 : demande du club, 2026) ; sinon son aptitude.
 */
export function sousTitre(l: LigneTrombinoscopeSejour): string {
  if (l.niveauEncadrement) {
    return l.niveauEncadrement === 'E1' && l.niveauPlongeur ? `E1 · ${l.niveauPlongeur}` : l.niveauEncadrement;
  }
  return l.aptitude ?? (l.plongeur ? 'Plongeur' : 'Accompagnant');
}

/** Valeur du bouton « Sans groupe » : un nom de groupe ne commence jamais par ce caractère. */
export const SANS_GROUPE = '\u0000sans';

/** Les boutons de filtre (valeur '' : tous) : « Tous », chaque groupe par ordre alphabétique, « Sans groupe » s'il y en a. */
export function filtresGroupes(lignes: LigneTrombinoscopeSejour[]): OptionOnglet<string>[] {
  const groupes = [...new Set(lignes.map(l => l.groupe).filter((g): g is string => !!g))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
  return [
    { valeur: '', libelle: 'Tous' },
    ...groupes.map(g => ({ valeur: g, libelle: g })),
    ...(lignes.some(l => !l.groupe) ? [{ valeur: SANS_GROUPE, libelle: 'Sans groupe' }] : [])
  ];
}

/** Les participants du groupe choisi ('' : tous). */
export function duGroupe(lignes: LigneTrombinoscopeSejour[], filtre: string): LigneTrombinoscopeSejour[] {
  if (filtre === '') return lignes;
  if (filtre === SANS_GROUPE) return lignes.filter(l => !l.groupe);
  return lignes.filter(l => l.groupe === filtre);
}

/** Le titre proposé pour l'image exportée : le séjour, et le groupe choisi s'il y en a un. */
export function titreImage(nomSejour: string, filtre: string): string {
  if (filtre === '') return nomSejour;
  return `${nomSejour} — ${filtre === SANS_GROUPE ? 'Sans groupe' : filtre}`;
}
