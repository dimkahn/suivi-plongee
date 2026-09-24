import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
  AdhesionVue, CursusVue, DemandeBlocReferentiel, DemandeCritereReferentiel, DemandeReferentiel, Eligibilite,
  EleveVue, EvaluationVue, FicheSecuriteVue, GrilleVue, GroupePlongeursVue, LigneTrombinoscope, LigneTrombinoscopeMoniteur, MatriceVue,
  MembreGroupeVue, MoniteurOptionVue, MoniteurVue, PlongeurConnuVue, PlongeurVue, ReferentielVue, RosterVue,
  SaisonVue, SeanceVue, Statut, FeuillePresence
} from './modeles';
import { MAGASIN_CACHE, ecrire, lire } from './base-locale';

interface Entree<T> { cle: string; valeur: T; majLe: number; }

/** Feuilles de présence et fiches de sécurité embarquées hors ligne : séances à moins de tant de jours d'aujourd'hui. */
const JOURS_FEUILLES_HORS_LIGNE = 30;

function ecartEnJours(dateIso: string): number {
  const [a, m, j] = dateIso.split('-').map(Number);
  const aujourdhui = new Date();
  const debut = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return (Date.UTC(a, m - 1, j) - debut) / 86_400_000;
}

interface DemandeSeance {
  dateSeance: string;
  ordre?: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu?: string | null;
  site?: string | null;
  profondeurMax?: number | null;
  commentaire?: string | null;
}

interface DemandeEleve {
  nom: string;
  prenom: string;
  dateNaissance?: string | null;
  numeroLicence?: string | null;
  certificatValideJusquAu?: string | null;
  dernierNiveau?: string | null;
  email?: string | null;
  telephone?: string | null;
  contactUrgenceNom?: string | null;
  contactUrgenceTelephone?: string | null;
  autorisationLegale: boolean;
}

interface Paquet {
  genereLe: string;
  cursus: CursusVue[];
  seances: SeanceVue[];
  grilles: GrilleVue[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ----------------------------------------------------------------
  //  Lectures : réseau d'abord, cache local en repli.
  // ----------------------------------------------------------------

  cursus(): Promise<CursusVue[]> {
    return this.lireOuRetomber('cursus', () => this.http.get<CursusVue[]>('/api/cursus'));
  }

  /** Pour les écrans d'administration : consultation d'une saison au choix, sans passer par le cache hors ligne. */
  cursusDeLaSaison(saisonId: number): Observable<CursusVue[]> {
    return this.http.get<CursusVue[]>('/api/cursus', { params: { saisonId } });
  }

  /** Toutes les saisons d'un élève : pour retrouver les compétences acquises l'an dernier. */
  historiqueCursusEleve(eleveId: number): Observable<CursusVue[]> {
    return this.http.get<CursusVue[]>(`/api/cursus/eleve/${eleveId}`);
  }

  seances(): Promise<SeanceVue[]> {
    return this.lireOuRetomber('seances', () => this.http.get<SeanceVue[]>('/api/seances'));
  }

  /**
   * Feuille de présence d'une séance : tous les élèves inscrits sur sa saison.
   * Les écritures passent par FileEcrituresService, qui les garde hors ligne.
   */
  feuillePresence(seanceId: number): Promise<FeuillePresence> {
    return this.lireOuRetomber(`presences:${seanceId}`,
      () => this.http.get<FeuillePresence>(`/api/seances/${seanceId}/presences`));
  }

  /** Création/modification réservées aux ADMIN et MONITEUR côté serveur ; nécessitent le réseau. */
  creerSeance(demande: DemandeSeance): Observable<SeanceVue> {
    return this.http.post<SeanceVue>('/api/seances', demande);
  }

  modifierSeance(id: number, demande: DemandeSeance): Observable<SeanceVue> {
    return this.http.put<SeanceVue>(`/api/seances/${id}`, demande);
  }

  /** Réservée à l'ADMIN ; refusée côté serveur si la séance porte déjà présences/évaluations. */
  supprimerSeance(id: number): Observable<unknown> {
    return this.http.delete(`/api/seances/${id}`);
  }

  grille(cursusId: number): Promise<GrilleVue> {
    return this.lireOuRetomber(`grille:${cursusId}`,
      () => this.http.get<GrilleVue>(`/api/cursus/${cursusId}/grille`));
  }

  /**
   * Amorce du mode hors ligne : un seul appel ramène les cursus, les séances
   * et toutes les grilles de la saison, puis alimente le cache local. À
   * déclencher pendant qu'on a encore du réseau, avant de partir en bord de
   * bassin ou sur le bateau.
   */
  async precharger(): Promise<{ grilles: number; feuilles: number; fiches: number }> {
    const paquet = await firstValueFrom(
      this.http.get<Paquet>('/api/synchronisation/paquet'));

    await this.deposer('cursus', paquet.cursus);
    await this.deposer('seances', paquet.seances);
    for (const g of paquet.grilles) {
      await this.deposer(`grille:${g.cursusId}`, g);
    }

    // De quoi composer les palanquées sur site : DP possibles, plongeurs
    // connus, groupes de la saison ouverte. Un échec ici n'empêche pas le reste.
    await this.tenter(() => this.moniteursActifs());
    await this.tenter(() => this.plongeursConnus());
    const saisons = await this.tenter(() => this.saisonsHorsLigne());
    const ouverte = saisons?.find(s => s.ouverte);
    if (ouverte) await this.tenter(() => this.groupesPlongeurs(ouverte.id));

    // Feuilles de présence et fiches de sécurité des séances proches : celle
    // du jour, celles qu'on rattrape, et celles préparées d'avance.
    let feuilles = 0;
    let fiches = 0;
    for (const s of paquet.seances) {
      if (Math.abs(ecartEnJours(s.date)) > JOURS_FEUILLES_HORS_LIGNE) continue;
      if (await this.tenter(() => this.feuillePresence(s.id))) feuilles++;
      if (await this.tenter(() => this.ficheSecurite(s.id))) fiches++;
    }
    return { grilles: paquet.grilles.length, feuilles, fiches };
  }

  async dateDuCache(cle: string): Promise<number | null> {
    const entree = await lire<Entree<unknown>>(MAGASIN_CACHE, cle);
    return entree ? entree.majLe : null;
  }

  // ----------------------------------------------------------------
  //  Écritures nécessitant le réseau.
  //  La notation, elle, passe par FileAttenteService.
  // ----------------------------------------------------------------

  validerCompetence(cursusId: number, blocId: number, commentaire?: string): Observable<unknown> {
    return this.http.post(
      `/api/cursus/${cursusId}/competences/${blocId}/validation`,
      { commentaire: commentaire ?? null }
    );
  }

  eligibilite(cursusId: number): Observable<Eligibilite> {
    return this.http.get<Eligibilite>(`/api/cursus/${cursusId}/eligibilite`);
  }

  /** Historique complet d'un critère (une ligne par saisie) : nécessite le réseau. */
  historique(cursusId: number, critereId: number): Observable<EvaluationVue[]> {
    return this.http.get<EvaluationVue[]>(
      `/api/cursus/${cursusId}/criteres/${critereId}/historique`);
  }

  /** Vue globale d'un élève : une colonne par séance, comme l'onglet du tableur. */
  matrice(cursusId: number): Observable<MatriceVue> {
    return this.http.get<MatriceVue>(`/api/cursus/${cursusId}/matrice`);
  }

  /** Fiche de suivi imprimable, même contenu que la grille. Nécessite le réseau. */
  fichePdf(cursusId: number): Observable<Blob> {
    return this.http.get(`/api/cursus/${cursusId}/fiche.pdf`, { responseType: 'blob' });
  }

  /** Vue d'ensemble de la saison, réservée aux encadrants (roster « Infos Élèves »). */
  roster(saisonId?: number): Observable<RosterVue> {
    const params = saisonId ? { params: { saisonId } } : {};
    return this.http.get<RosterVue>('/api/roster', params);
  }

  noterEnLigne(cursusId: number, critereId: number, statut: Statut,
               seanceId: number | null, referenceClient: string): Observable<unknown> {
    return this.http.post(`/api/cursus/${cursusId}/evaluations`, {
      critereId, statut, seanceId, referenceClient
    });
  }

  // ----------------------------------------------------------------
  //  Fiche de sécurité d'une séance (A322-72), réservée aux encadrants.
  // ----------------------------------------------------------------

  /**
   * Réseau d'abord, cache en repli : la fiche se consulte et se complète sur
   * site sans réseau. Les écritures (établissement, profil réalisé) passent
   * par FileEcrituresService, qui les garde hors ligne.
   */
  ficheSecurite(seanceId: number): Promise<FicheSecuriteVue> {
    return this.lireOuRetomber(`fiche:${seanceId}`,
      () => this.http.get<FicheSecuriteVue>(`/api/seances/${seanceId}/fiche-securite`));
  }

  supprimerFicheSecurite(seanceId: number): Observable<unknown> {
    return this.http.delete(`/api/seances/${seanceId}/fiche-securite`);
  }

  ficheSecuritePdf(seanceId: number): Observable<Blob> {
    return this.http.get(`/api/seances/${seanceId}/fiche-securite/fiche.pdf`, { responseType: 'blob' });
  }

  ficheSecuriteExcel(seanceId: number): Observable<Blob> {
    return this.http.get(`/api/seances/${seanceId}/fiche-securite/fiche.xlsx`, { responseType: 'blob' });
  }

  /** Roster des élèves et encadrants du club, pour pré-remplir un membre de palanquée. */
  plongeursConnus(): Promise<PlongeurConnuVue[]> {
    return this.lireOuRetomber('plongeursConnus', () => this.http.get<PlongeurConnuVue[]>('/api/plongeurs-connus'));
  }

  /** Groupes nommés et réutilisables de plongeurs, typiquement composés pour un séjour. */
  groupesPlongeurs(saisonId: number): Promise<GroupePlongeursVue[]> {
    return this.lireOuRetomber(`groupes:${saisonId}`,
      () => this.http.get<GroupePlongeursVue[]>('/api/groupes-plongeurs', { params: { saisonId } }));
  }

  creerGroupePlongeurs(demande: { nom: string; saisonId: number; membres: MembreGroupeVue[] }):
      Observable<GroupePlongeursVue> {
    return this.http.post<GroupePlongeursVue>('/api/groupes-plongeurs', demande);
  }

  modifierGroupePlongeurs(id: number, demande: { nom: string; saisonId: number; membres: MembreGroupeVue[] }):
      Observable<GroupePlongeursVue> {
    return this.http.put<GroupePlongeursVue>(`/api/groupes-plongeurs/${id}`, demande);
  }

  supprimerGroupePlongeurs(id: number): Observable<void> {
    return this.http.delete<void>(`/api/groupes-plongeurs/${id}`);
  }

  /** Liste légère des moniteurs actifs, pour le choix du DP : accessible à tout encadrant. */
  moniteursActifs(): Promise<MoniteurOptionVue[]> {
    return this.lireOuRetomber('moniteurs', () => this.http.get<MoniteurOptionVue[]>('/api/moniteurs'));
  }

  // ----------------------------------------------------------------
  //  Gestion des moniteurs, réservée aux ADMIN.
  // ----------------------------------------------------------------

  moniteurs(): Observable<MoniteurVue[]> {
    return this.http.get<MoniteurVue[]>('/api/admin/moniteurs');
  }

  creerMoniteur(demande: {
    email: string;
    nom: string;
    prenom: string;
    niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4';
    numeroLicence?: string | null;
    certificatValideJusquAu?: string | null;
    admin?: boolean;
  }): Observable<MoniteurVue> {
    return this.http.post<MoniteurVue>('/api/admin/moniteurs', demande);
  }

  /** Seul endroit où le niveau d'encadrement et le rôle ADMIN d'un moniteur peuvent changer. */
  modifierMoniteur(id: number, demande: {
    email: string;
    nom: string;
    prenom: string;
    niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4';
    numeroLicence: string | null;
    certificatValideJusquAu: string | null;
    admin: boolean;
  }): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}`, demande);
  }

  changerActivationMoniteur(id: number, actif: boolean): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}/activation`, { actif });
  }

  changerMotDePasseMoniteur(id: number, nouveauMotDePasse: string): Observable<unknown> {
    return this.http.put(`/api/admin/moniteurs/${id}/mot-de-passe`, { nouveauMotDePasse });
  }

  supprimerMoniteur(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/moniteurs/${id}`);
  }

  changerAutorisationImageMoniteur(id: number, autorisationImage: boolean): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}/autorisation-image`, { autorisationImage });
  }

  deposerPhotoMoniteur(id: number, fichier: File): Observable<unknown> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post(`/api/admin/moniteurs/${id}/photo`, donnees);
  }

  // ----------------------------------------------------------------
  //  Trombinoscope. Une photo n'est jamais affichée sans le consentement
  //  autorisationImage (distinct de l'autorisation de pratiquer).
  // ----------------------------------------------------------------

  trombinoscope(niveau?: 'N1' | 'N2' | 'N3'): Observable<LigneTrombinoscope[]> {
    const params = niveau ? { params: { niveau } } : {};
    return this.http.get<LigneTrombinoscope[]>('/api/trombinoscope', params);
  }

  /** À convertir en URL d'objet côté composant : l'auth passe par un en-tête, pas par un cookie. */
  /** Moniteurs actifs, accessible à tout encadrant. */
  trombinoscopeMoniteurs(): Observable<LigneTrombinoscopeMoniteur[]> {
    return this.http.get<LigneTrombinoscopeMoniteur[]>('/api/moniteurs/trombinoscope');
  }

  /** Photo du moniteur connecté, déposée par lui-même depuis « Mon compte ». */
  maPhoto(): Observable<Blob> {
    return this.http.get('/api/auth/moi/photo', { responseType: 'blob' });
  }

  /** Déposer sa propre photo vaut consentement au droit à l'image. */
  deposerMaPhoto(fichier: File): Observable<unknown> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post('/api/auth/moi/photo', donnees);
  }

  /** Retire la photo et le consentement au droit à l'image. */
  retirerMaPhoto(): Observable<unknown> {
    return this.http.delete('/api/auth/moi/photo');
  }

  photoMoniteur(id: number): Observable<Blob> {
    return this.http.get(`/api/moniteurs/${id}/photo`, { responseType: 'blob' });
  }

  photoEleve(eleveId: number): Observable<Blob> {
    return this.http.get(`/api/eleves/${eleveId}/photo`, { responseType: 'blob' });
  }

  changerAutorisationImage(eleveId: number, autorisationImage: boolean): Observable<unknown> {
    return this.http.put(`/api/eleves/${eleveId}/autorisation-image`, { autorisationImage });
  }

  deposerPhotoEleve(eleveId: number, fichier: File): Observable<unknown> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post(`/api/eleves/${eleveId}/photo`, donnees);
  }

  supprimerPhotoEleve(eleveId: number): Observable<unknown> {
    return this.http.delete(`/api/eleves/${eleveId}/photo`);
  }

  // ----------------------------------------------------------------
  //  Saisons. Lecture pour les encadrants, écriture réservée à l'ADMIN.
  // ----------------------------------------------------------------

  saisons(): Observable<SaisonVue[]> {
    return this.http.get<SaisonVue[]>('/api/saisons');
  }

  /** Mêmes saisons, avec repli sur le cache : pour les écrans utilisés sur site (fiche de sécurité). */
  saisonsHorsLigne(): Promise<SaisonVue[]> {
    return this.lireOuRetomber('saisons', () => this.saisons());
  }

  creerSaison(demande: { libelle: string; dateDebut: string; dateFin: string }): Observable<SaisonVue> {
    return this.http.post<SaisonVue>('/api/saisons', demande);
  }

  /** Les dates sont purement informatives : modifiables sans restriction. */
  modifierSaison(id: number, demande: { libelle: string; dateDebut: string; dateFin: string }): Observable<SaisonVue> {
    return this.http.put<SaisonVue>(`/api/saisons/${id}`, demande);
  }

  changerOuvertureSaison(id: number, ouverte: boolean): Observable<SaisonVue> {
    return this.http.put<SaisonVue>(`/api/saisons/${id}/ouverture`, { ouverte });
  }

  // ----------------------------------------------------------------
  //  Élèves : dossier (identité, consentements), réservé à l'ADMIN en écriture.
  // ----------------------------------------------------------------

  eleves(): Observable<EleveVue[]> {
    return this.http.get<EleveVue[]>('/api/eleves');
  }

  creerEleve(demande: DemandeEleve): Observable<EleveVue> {
    return this.http.post<EleveVue>('/api/eleves', demande);
  }

  modifierEleve(id: number, demande: DemandeEleve): Observable<EleveVue> {
    return this.http.put<EleveVue>(`/api/eleves/${id}`, demande);
  }

  archiverEleve(id: number): Observable<EleveVue> {
    return this.http.post<EleveVue>(`/api/eleves/${id}/archivage`, {});
  }

  desarchiverEleve(id: number): Observable<EleveVue> {
    return this.http.delete<EleveVue>(`/api/eleves/${id}/archivage`);
  }

  elevesArchives(): Observable<EleveVue[]> {
    return this.http.get<EleveVue[]>('/api/eleves/archives');
  }

  /** Irréversible : efface l'élève archivé et tout son historique (cursus, évaluations, brevets). */
  supprimerEleve(id: number): Observable<unknown> {
    return this.http.delete(`/api/eleves/${id}`);
  }

  // ----------------------------------------------------------------
  //  Inscription d'un élève dans une formation (cursus), réservée à l'ADMIN.
  // ----------------------------------------------------------------

  inscrireCursus(demande: {
    eleveId: number; saisonId: number; niveau: 'N1' | 'N2' | 'N3'; moniteurReferentId?: number | null;
  }): Observable<CursusVue> {
    return this.http.post<CursusVue>('/api/cursus', demande);
  }

  modifierCursus(id: number, demande: {
    moniteurReferentId: number | null; statut: string;
  }): Observable<CursusVue> {
    return this.http.put<CursusVue>(`/api/cursus/${id}`, demande);
  }

  // ----------------------------------------------------------------
  //  Adhésion à une saison sans formation (élève déjà breveté qui continue
  //  de plonger avec le club) : distincte d'un Cursus, réservée à l'ADMIN
  //  en écriture, comme l'inscription à un cursus.
  // ----------------------------------------------------------------

  adhesionsDeLaSaison(saisonId: number): Observable<AdhesionVue[]> {
    return this.http.get<AdhesionVue[]>('/api/adhesions', { params: { saisonId } });
  }

  historiqueAdhesions(eleveId: number): Observable<AdhesionVue[]> {
    return this.http.get<AdhesionVue[]>('/api/adhesions', { params: { eleveId } });
  }

  adherer(demande: { eleveId: number; saisonId: number }): Observable<AdhesionVue> {
    return this.http.post<AdhesionVue>('/api/adhesions', demande);
  }

  retirerAdhesion(id: number): Observable<unknown> {
    return this.http.delete(`/api/adhesions/${id}`);
  }

  // ----------------------------------------------------------------
  //  Référentiel MFT. Édition réservée à l'ADMIN, directement en base : une
  //  modification s'applique immédiatement, y compris à des cursus déjà
  //  ouverts sur ce référentiel (voir /admin/referentiel).
  // ----------------------------------------------------------------

  referentiels(): Observable<ReferentielVue[]> {
    return this.http.get<ReferentielVue[]>('/api/referentiels');
  }

  /** Toutes les versions, actives ou non : pour l'écran d'administration. */
  referentielsTous(): Observable<ReferentielVue[]> {
    return this.http.get<ReferentielVue[]>('/api/referentiels/tous');
  }

  referentiel(id: number): Observable<ReferentielVue> {
    return this.http.get<ReferentielVue>(`/api/referentiels/${id}`);
  }

  creerReferentiel(demande: DemandeReferentiel): Observable<ReferentielVue> {
    return this.http.post<ReferentielVue>('/api/referentiels', demande);
  }

  modifierReferentiel(id: number, demande: DemandeReferentiel): Observable<ReferentielVue> {
    return this.http.put<ReferentielVue>(`/api/referentiels/${id}`, demande);
  }

  supprimerReferentiel(id: number): Observable<unknown> {
    return this.http.delete(`/api/referentiels/${id}`);
  }

  creerBlocReferentiel(referentielId: number, demande: DemandeBlocReferentiel) {
    return this.http.post<ReferentielVue['blocs'][number]>(
      `/api/referentiels/${referentielId}/blocs`, demande);
  }

  modifierBlocReferentiel(referentielId: number, blocId: number, demande: DemandeBlocReferentiel) {
    return this.http.put<ReferentielVue['blocs'][number]>(
      `/api/referentiels/${referentielId}/blocs/${blocId}`, demande);
  }

  supprimerBlocReferentiel(referentielId: number, blocId: number): Observable<unknown> {
    return this.http.delete(`/api/referentiels/${referentielId}/blocs/${blocId}`);
  }

  creerCritereReferentiel(referentielId: number, blocId: number, demande: DemandeCritereReferentiel) {
    return this.http.post<ReferentielVue['blocs'][number]['criteres'][number]>(
      `/api/referentiels/${referentielId}/blocs/${blocId}/criteres`, demande);
  }

  modifierCritereReferentiel(referentielId: number, blocId: number, critereId: number,
                             demande: DemandeCritereReferentiel) {
    return this.http.put<ReferentielVue['blocs'][number]['criteres'][number]>(
      `/api/referentiels/${referentielId}/blocs/${blocId}/criteres/${critereId}`, demande);
  }

  supprimerCritereReferentiel(referentielId: number, blocId: number, critereId: number): Observable<unknown> {
    return this.http.delete(`/api/referentiels/${referentielId}/blocs/${blocId}/criteres/${critereId}`);
  }

  // ----------------------------------------------------------------

  /** Lecture facultative du préchargement : indisponible (droits, suppression), on passe à la suite. */
  private async tenter<T>(lecture: () => Promise<T>): Promise<T | null> {
    try {
      return await lecture();
    } catch {
      return null;
    }
  }

  private async lireOuRetomber<T>(cle: string, appel: () => Observable<T>): Promise<T> {
    try {
      const valeur = await firstValueFrom(appel());
      await this.deposer(cle, valeur);
      return valeur;
    } catch (erreur) {
      const entree = await lire<Entree<T>>(MAGASIN_CACHE, cle);
      if (entree) return entree.valeur;
      throw erreur;
    }
  }

  private deposer<T>(cle: string, valeur: T): Promise<IDBValidKey> {
    return ecrire<Entree<T>>(MAGASIN_CACHE, { cle, valeur, majLe: Date.now() });
  }
}
