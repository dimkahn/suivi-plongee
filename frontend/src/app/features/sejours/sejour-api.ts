import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { SortieVue } from '../../core/modeles';

// ----------------------------------------------------------------
//  Le séjour d'une sortie (SejourController) : participants, trajets,
//  voitures, logements, affaires, programme et infos pratiques. Géré par
//  un admin ou le directeur technique, lu par les encadrants et, en
//  carnet, par ses participants qui ont un compte. Réseau obligatoire.
// ----------------------------------------------------------------

export type RegimeAlimentaire = 'VEGETARIEN' | 'VEGETALIEN' | 'PESCETARIEN' | 'SANS_PORC' | 'HALAL' | 'CASHER'
  | 'SANS_GLUTEN' | 'SANS_LACTOSE';
export type MoyenTransport = 'AVION' | 'TRAIN' | 'VOITURE' | 'CAR' | 'BATEAU' | 'AUTRE';
export type CategorieAffaire = 'DOCUMENTS' | 'PLONGEE' | 'SEJOUR';

export const REGIMES: { code: RegimeAlimentaire; libelle: string }[] = [
  { code: 'VEGETARIEN', libelle: 'Végétarien' },
  { code: 'VEGETALIEN', libelle: 'Végétalien' },
  { code: 'PESCETARIEN', libelle: 'Pescétarien' },
  { code: 'SANS_PORC', libelle: 'Sans porc' },
  { code: 'HALAL', libelle: 'Halal' },
  { code: 'CASHER', libelle: 'Casher' },
  { code: 'SANS_GLUTEN', libelle: 'Sans gluten' },
  { code: 'SANS_LACTOSE', libelle: 'Sans lactose' }
];

export const TRANSPORTS: { code: MoyenTransport; libelle: string }[] = [
  { code: 'AVION', libelle: 'Avion' },
  { code: 'TRAIN', libelle: 'Train' },
  { code: 'VOITURE', libelle: 'Voiture' },
  { code: 'CAR', libelle: 'Car' },
  { code: 'BATEAU', libelle: 'Bateau' },
  { code: 'AUTRE', libelle: 'Autre' }
];

export const CATEGORIES: { code: CategorieAffaire; libelle: string }[] = [
  { code: 'DOCUMENTS', libelle: 'Papiers' },
  { code: 'PLONGEE', libelle: 'Pour la plongée' },
  { code: 'SEJOUR', libelle: 'Pour le séjour' }
];

export interface Trajet {
  date: string | null;
  /** « 10:35 » (le serveur peut renvoyer « 10:35:00 »). */
  heure: string | null;
  transport: MoyenTransport | null;
  /** Numéro de vol ou de train. */
  numero: string | null;
  /** Aéroport, gare, adresse. */
  lieu: string | null;
  /**
   * Arrivée seulement : l'heure à laquelle part l'avion ou le train, et d'où
   * (pour conseiller l'heure à laquelle être à l'aéroport). Le départ n'en a
   * pas besoin : son heure et son lieu sont déjà ceux du départ.
   */
  heureDepart?: string | null;
  lieuDepart?: string | null;
}

/** Un trajet à modifier dans un formulaire : heures au format des champs (« 10:35 »), vide s'il n'y en a pas. */
export function copieTrajet(t: Trajet | null): Trajet {
  return {
    date: t?.date ?? null, heure: t?.heure?.slice(0, 5) ?? null, transport: t?.transport ?? null,
    numero: t?.numero ?? null, lieu: t?.lieu ?? null,
    heureDepart: t?.heureDepart?.slice(0, 5) ?? null, lieuDepart: t?.lieuDepart ?? null
  };
}

/** Le trajet saisi, ou null s'il est resté vide. */
export function trajetSaisi(t: Trajet | null): Trajet | null {
  return !t || (!t.date && !t.heure && !t.transport && !t.numero?.trim() && !t.lieu?.trim()
    && !t.heureDepart && !t.lieuDepart?.trim()) ? null : t;
}

export interface ParticipantVue {
  id: number;
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  /** Faux : accompagnant qui ne plonge pas. */
  plongeur: boolean;
  telephone: string | null;
  email: string | null;
  regimes: RegimeAlimentaire[];
  regimePrecision: string | null;
  urgenceNom: string | null;
  urgenceTelephone: string | null;
  arrivee: Trajet | null;
  depart: Trajet | null;
  remarques: string | null;
  /** Le compte connecté. */
  moi: boolean;
  /**
   * Le plongeur d'un groupe de plongeurs qu'il est aussi : nom, prénom et
   * e-mail suivent de l'un à l'autre. Null pour un accompagnant.
   */
  membreGroupeId: number | null;
  /** Le nom de ce groupe. */
  groupe: string | null;
}

export type DemandeParticipant = Omit<ParticipantVue, 'id' | 'moi' | 'groupe'>;

/** Ce que le participant renseigne lui-même (le nom et le reste restent à l'organisateur). */
export type DemandeMesInformations = Pick<ParticipantVue, 'telephone' | 'regimes' | 'regimePrecision' | 'urgenceNom'
  | 'urgenceTelephone' | 'arrivee' | 'depart' | 'remarques'>;

export interface VoitureVue {
  id: number;
  nom: string;
  /** Conducteur compris. */
  places: number;
  conducteurId: number | null;
  trajet: string | null;
  remarques: string | null;
  passagerIds: number[];
}

export type DemandeVoiture = Omit<VoitureVue, 'id'>;

export interface ChambreVue {
  id: number;
  nom: string;
  couchages: number;
  remarques: string | null;
  occupantIds: number[];
}

export interface LogementVue {
  id: number;
  nom: string;
  adresse: string | null;
  remarques: string | null;
  chambres: ChambreVue[];
}

export interface DemandeLogement {
  nom: string;
  adresse: string | null;
  remarques: string | null;
  chambres: { nom: string; couchages: number; remarques: string | null; occupantIds: number[] }[];
}

export interface AffaireVue {
  id: number;
  categorie: CategorieAffaire;
  libelle: string;
  indispensable: boolean;
}

export type DemandeAffaire = Omit<AffaireVue, 'id'>;

export interface EvenementVue {
  id: number;
  jour: string;
  heureDebut: string | null;
  heureFin: string | null;
  titre: string;
  lieu: string | null;
  details: string | null;
}

export type DemandeEvenement = Omit<EvenementVue, 'id'>;

export type CategorieDepense = 'HEBERGEMENT' | 'TRANSPORT' | 'REPAS' | 'PLONGEE' | 'AUTRE';

export const CATEGORIES_DEPENSE: { code: CategorieDepense; libelle: string }[] = [
  { code: 'HEBERGEMENT', libelle: 'Hébergement' },
  { code: 'TRANSPORT', libelle: 'Transport' },
  { code: 'REPAS', libelle: 'Repas, courses' },
  { code: 'PLONGEE', libelle: 'Plongée' },
  { code: 'AUTRE', libelle: 'Autre' }
];

/** Montants en centimes, comme le serveur. */
export interface DepenseVue {
  id: number;
  libelle: string;
  categorie: CategorieDepense;
  montantCentimes: number;
  payeurId: number;
  jour: string | null;
  /** Qui partage la dépense, et avec combien de parts (2 pour un couple…). */
  parts: { participantId: number; parts: number }[];
  /** Les photos de la note (ids). */
  photos: number[];
  saisieParUtilisateurId: number | null;
  saisieParParticipantId: number | null;
}

export type DemandeDepense = Pick<DepenseVue, 'libelle' | 'categorie' | 'montantCentimes' | 'payeurId' | 'jour' | 'parts'>;

export interface VersementVue {
  id: number;
  deId: number;
  aId: number;
  montantCentimes: number;
  jour: string | null;
}

export type DemandeVersement = Omit<VersementVue, 'id'>;

/** Ce que le compte (ou l'invité) peut faire ; le serveur revérifie tout. */
export interface DroitsFrais {
  /** Sa ligne parmi les participants, s'il en est. */
  moiId: number | null;
  peutAjouter: boolean;
  /** Saisir pour un autre payeur, noter tout remboursement : organisateur et moniteurs du séjour. */
  pourLesAutres: boolean;
  depensesModifiables: number[];
  versementsSupprimables: number[];
}

/** Solde positif : on lui doit de l'argent ; négatif : il en doit. */
export interface SoldeVue {
  participantId: number;
  payeCentimes: number;
  duCentimes: number;
  soldeCentimes: number;
}

export interface FraisVue {
  depenses: DepenseVue[];
  versements: VersementVue[];
  comptes: {
    totalCentimes: number;
    soldes: SoldeVue[];
    /** Les virements qui soldent les comptes, calculés par le serveur. */
    remboursements: { deId: number; aId: number; montantCentimes: number }[];
  };
  droits: DroitsFrais;
}

/** Un participant, tel que l'onglet des frais en a besoin. */
export interface ParticipantFrais {
  id: number;
  prenom: string;
  nom: string;
  plongeur?: boolean;
}

/**
 * Les écritures des frais, pour l'onglet du séjour (compte connecté) comme
 * pour la page des invités sans compte (lien et code) : chaque appel
 * renvoie les frais à jour.
 */
export interface PortFrais {
  enregistrerDepense(depenseId: number | null, d: DemandeDepense): Observable<{ depenseId: number; frais: FraisVue }>;
  supprimerDepense(depenseId: number): Observable<FraisVue>;
  ajouterPhoto(depenseId: number, fichier: File): Observable<FraisVue>;
  supprimerPhoto(depenseId: number, photoId: number): Observable<FraisVue>;
  lirePhoto(depenseId: number, photoId: number): Observable<Blob>;
  ajouterVersement(d: DemandeVersement): Observable<FraisVue>;
  supprimerVersement(versementId: number): Observable<FraisVue>;
}

export interface BilanEnvoiAcces {
  envoyes: string[];
  sansEmail: string[];
  echecs: string[];
}

/** « 1 234,50 € ». */
export function euros(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/** « 12,5 » ou « 12.50 » → 1250 ; null si ce n'est pas un montant. */
export function enCentimes(saisie: string | number | null): number | null {
  if (saisie === null || saisie === '') return null;
  const n = Number(String(saisie).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Un plongeur d'un groupe, auquel lier un participant. */
export interface PlongeurGroupeVue {
  id: number;
  eleveId: number | null;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  email: string | null;
  aptitude: string | null;
}

export interface GroupeProposeVue {
  id: number;
  nom: string;
  membres: number;
  plongeurs: PlongeurGroupeVue[];
}

export interface SejourVue {
  sortie: SortieVue;
  /** Peut modifier (admin, directeur technique). */
  gere: boolean;
  /** Voit tout ; sinon c'est le carnet d'un participant, sans les données des autres. */
  encadrant: boolean;
  infosPratiques: string | null;
  participants: ParticipantVue[];
  voitures: VoitureVue[];
  logements: LogementVue[];
  affaires: AffaireVue[];
  evenements: EvenementVue[];
  frais: FraisVue;
  avertissements: string[];
  groupesProposes: GroupeProposeVue[];
}

export interface SejourResumeVue {
  sortieId: number;
  nom: string;
  lieu: string | null;
  dateDebut: string;
  dateFin: string;
  participants: number;
  jeParticipe: boolean;
}

export interface BilanEnvoiCarnet {
  envoyes: string[];
  sansEmail: string[];
  echecs: string[];
}

/** Liste proposée par « Partir de la liste type », à compléter selon le séjour. */
export const AFFAIRES_TYPE: DemandeAffaire[] = [
  { categorie: 'DOCUMENTS', libelle: 'Carte d’identité ou passeport', indispensable: true },
  { categorie: 'DOCUMENTS', libelle: 'Carte de niveau et licence FFESSM', indispensable: true },
  { categorie: 'DOCUMENTS', libelle: 'Certificat médical (CACI) en cours de validité', indispensable: true },
  { categorie: 'DOCUMENTS', libelle: 'Carnet de plongée', indispensable: false },
  { categorie: 'DOCUMENTS', libelle: 'Carte vitale ou carte européenne d’assurance maladie', indispensable: false },
  { categorie: 'DOCUMENTS', libelle: 'Billets de train ou d’avion', indispensable: false },
  { categorie: 'PLONGEE', libelle: 'Masque, palmes, tuba', indispensable: true },
  { categorie: 'PLONGEE', libelle: 'Combinaison, chaussons, gants, cagoule', indispensable: false },
  { categorie: 'PLONGEE', libelle: 'Ordinateur de plongée ou profondimètre et montre', indispensable: false },
  { categorie: 'PLONGEE', libelle: 'Parachute de palier et sifflet', indispensable: false },
  { categorie: 'PLONGEE', libelle: 'Lampe', indispensable: false },
  { categorie: 'PLONGEE', libelle: 'Sac de plongée, caisse étanche', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Draps ou sac de couchage, serviette de toilette', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Trousse de toilette, médicaments personnels', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Maillot de bain, serviette de plage', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Crème solaire respectueuse des récifs, lunettes, chapeau', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Vêtement chaud et coupe-vent pour le bateau', indispensable: false },
  { categorie: 'SEJOUR', libelle: 'Gourde', indispensable: false }
];

@Injectable({ providedIn: 'root' })
export class SejourApi {
  private http = inject(HttpClient);

  /** toutes : aussi les séjours passés. Un participant ne reçoit que les siens. */
  lister(toutes: boolean): Observable<SejourResumeVue[]> {
    return this.http.get<SejourResumeVue[]>('/api/sejours', { params: { toutes } });
  }

  lire(id: number): Observable<SejourVue> {
    return this.http.get<SejourVue>(`/api/sejours/${id}`);
  }

  definirInfos(id: number, infosPratiques: string | null): Observable<SejourVue> {
    return this.http.put<SejourVue>(`/api/sejours/${id}/infos`, { infosPratiques });
  }

  ajouterParticipant(id: number, d: DemandeParticipant): Observable<SejourVue> {
    return this.http.post<SejourVue>(`/api/sejours/${id}/participants`, d);
  }

  /** Le même vol ou train (arrivée ou départ) pour plusieurs participants ; trajet null : l'effacer. */
  appliquerTrajet(id: number, sens: 'ARRIVEE' | 'DEPART', trajet: Trajet | null, participantIds: number[]): Observable<SejourVue> {
    return this.http.put<SejourVue>(`/api/sejours/${id}/trajets`, { sens, trajet, participantIds });
  }

  importerGroupe(id: number, groupeId: number): Observable<SejourVue> {
    return this.http.post<SejourVue>(`/api/sejours/${id}/participants/groupe`, { groupeId });
  }

  modifierParticipant(id: number, participantId: number, d: DemandeParticipant): Observable<SejourVue> {
    return this.http.put<SejourVue>(`/api/sejours/${id}/participants/${participantId}`, d);
  }

  supprimerParticipant(id: number, participantId: number): Observable<SejourVue> {
    return this.http.delete<SejourVue>(`/api/sejours/${id}/participants/${participantId}`);
  }

  enregistrerVoiture(id: number, voitureId: number | null, d: DemandeVoiture): Observable<SejourVue> {
    return voitureId === null
      ? this.http.post<SejourVue>(`/api/sejours/${id}/voitures`, d)
      : this.http.put<SejourVue>(`/api/sejours/${id}/voitures/${voitureId}`, d);
  }

  supprimerVoiture(id: number, voitureId: number): Observable<SejourVue> {
    return this.http.delete<SejourVue>(`/api/sejours/${id}/voitures/${voitureId}`);
  }

  enregistrerLogement(id: number, logementId: number | null, d: DemandeLogement): Observable<SejourVue> {
    return logementId === null
      ? this.http.post<SejourVue>(`/api/sejours/${id}/logements`, d)
      : this.http.put<SejourVue>(`/api/sejours/${id}/logements/${logementId}`, d);
  }

  supprimerLogement(id: number, logementId: number): Observable<SejourVue> {
    return this.http.delete<SejourVue>(`/api/sejours/${id}/logements/${logementId}`);
  }

  definirAffaires(id: number, affaires: DemandeAffaire[]): Observable<SejourVue> {
    return this.http.put<SejourVue>(`/api/sejours/${id}/affaires`, { affaires });
  }

  enregistrerEvenement(id: number, evenementId: number | null, d: DemandeEvenement): Observable<SejourVue> {
    return evenementId === null
      ? this.http.post<SejourVue>(`/api/sejours/${id}/evenements`, d)
      : this.http.put<SejourVue>(`/api/sejours/${id}/evenements/${evenementId}`, d);
  }

  supprimerEvenement(id: number, evenementId: number): Observable<SejourVue> {
    return this.http.delete<SejourVue>(`/api/sejours/${id}/evenements/${evenementId}`);
  }

  /** Les frais du séjour pour un compte connecté ; {@code maj} reçoit le séjour à jour après chaque écriture. */
  portFrais(id: number, maj: (s: SejourVue) => void): PortFrais {
    const base = `/api/sejours/${id}`;
    const suivre = (o: Observable<SejourVue>) => o.pipe(tap(maj), map(s => s.frais));
    return {
      enregistrerDepense: (depenseId, d) => depenseId === null
        ? this.http.post<{ depenseId: number; sejour: SejourVue }>(`${base}/depenses`, d).pipe(
          tap(r => maj(r.sejour)), map(r => ({ depenseId: r.depenseId, frais: r.sejour.frais })))
        : suivre(this.http.put<SejourVue>(`${base}/depenses/${depenseId}`, d)).pipe(map(frais => ({ depenseId, frais }))),
      supprimerDepense: depenseId => suivre(this.http.delete<SejourVue>(`${base}/depenses/${depenseId}`)),
      ajouterPhoto: (depenseId, fichier) => suivre(
        this.http.post<SejourVue>(`${base}/depenses/${depenseId}/photos`, formulairePhoto(fichier))),
      supprimerPhoto: (depenseId, photoId) => suivre(
        this.http.delete<SejourVue>(`${base}/depenses/${depenseId}/photos/${photoId}`)),
      lirePhoto: (depenseId, photoId) => this.http.get(`${base}/depenses/${depenseId}/photos/${photoId}`,
        { responseType: 'blob' }),
      ajouterVersement: d => suivre(this.http.post<SejourVue>(`${base}/versements`, d)),
      supprimerVersement: versementId => suivre(this.http.delete<SejourVue>(`${base}/versements/${versementId}`))
    };
  }

  /**
   * Demande à chaque participant de renseigner ses informations (et lui ouvre les frais) :
   * l'encadrant dans l'appli, les autres par un lien et un code par e-mail ; participantIds : à eux seuls.
   */
  envoyerInvitations(id: number, participantIds: number[] | null): Observable<BilanEnvoiAcces> {
    return this.http.post<BilanEnvoiAcces>(`/api/sejours/${id}/invitations`, { participantIds });
  }

  /** Le participant connecté complète ses propres informations. */
  modifierMesInformations(id: number, d: DemandeMesInformations): Observable<SejourVue> {
    return this.http.put<SejourVue>(`/api/sejours/${id}/mes-informations`, d);
  }

  /** Le carnet par e-mail ; participantIds : à eux seuls (null : à tous). */
  envoyerCarnet(id: number, participantIds: number[] | null): Observable<BilanEnvoiCarnet> {
    return this.http.post<BilanEnvoiCarnet>(`/api/sejours/${id}/envoi-carnet`, { participantIds });
  }
}

export function formulairePhoto(fichier: File): FormData {
  const donnees = new FormData();
  donnees.append('fichier', fichier);
  return donnees;
}

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** « Vendredi 04/06/2027 ». */
export function jourLong(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number);
  return `${JOURS[new Date(a, m - 1, j).getDay()]} ${String(j).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

/** « 10:35:00 » → « 10h35 ». */
export function heure(h: string | null): string {
  return h ? h.slice(0, 5).replace(':', 'h') : '';
}

export function nomComplet(p: { prenom: string; nom: string }): string {
  return `${p.prenom} ${p.nom}`;
}

/** « Vendredi 03/06/2027 à 18h30, avion AF7520, Aéroport de Toulon-Hyères ». */
export function texteTrajet(t: Trajet | null): string {
  if (!t) return 'à préciser';
  const moyen = TRANSPORTS.find(x => x.code === t.transport)?.libelle.toLowerCase();
  return [
    t.date ? jourLong(t.date) + (t.heure ? ' à ' + heure(t.heure) : '') : (t.heure ? 'à ' + heure(t.heure) : null),
    [moyen, t.numero].filter(Boolean).join(' ') || null,
    t.lieu,
    t.heureDepart || t.lieuDepart
      ? 'départ' + (t.heureDepart ? ' à ' + heure(t.heureDepart) : '') + (t.lieuDepart ? ' de ' + t.lieuDepart : '')
      : null
  ].filter(Boolean).join(', ') || 'à préciser';
}
