import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
  AdhesionVue, CandidatInscription, CursusVue, DemandeBlocReferentiel, DemandeCritereReferentiel, DemandeReferentiel, Eligibilite,
  EleveVue, EvaluationVue, FicheSecuriteVue, GrilleVue, GroupePlongeursVue, LigneTrombinoscope, LigneTrombinoscopeMoniteur, MatriceVue,
  MembreGroupeVue, MoniteurOptionVue, MoniteurVue, PlongeurConnuVue, PlongeurVue, ReferentielVue, RosterVue,
  SaisonVue, SeanceVue, Statut, FeuillePresence, DemandeGenerationSaison, GenerationSaisonVue,
  DemandeProgression, ProgressionResume, ProgressionVue,
  DemandeEspaceBassin, DemandeGroupeEntrainement, EleveSaisonGroupeVue, EspaceBassinVue, GroupeEntrainementVue,
  DemandeCasePlanning, PlanningVue, ReponseDisponibilite, SoireePlanningVue,
  DemandeEquipement, DemandeIntervention, DemandePret, DemandeRetour, EmprunteurVue, EquipementVue,
  EtiquetteMateriel, FicheEquipementVue, InterventionVue, DemandeInspectionTiv, InspectionTivVue, ModeleInspectionTivVue,MomentPhotoPret, PhotoPretVue, PretVue, RapportImportMateriel,
  DemandeSortie, SeancePossibleVue, SortieVue, BilanNotationGroupee, DemandeNotationGroupee,
  DemandeExercice, ProgrammeVue
} from './modeles';
import { MAGASIN_CACHE, ecrire, lire, supprimer } from './base-locale';

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

interface DemandeSerieSeances {
  dateDebut: string;
  dateFin: string;
  plongeesParJour: number;
  milieu: 'ARTIFICIEL' | 'NATUREL';
  lieu: string | null;
  site: string | null;
  profondeurMax: number | null;
  infos: string[];
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
  tailleGilet?: string | null;
  tailleCombinaison?: string | null;
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

  /** Élèves proposés à l'inscription sur une saison : niveau actuel, ancienneté, niveau suggéré. */
  candidatsInscription(saisonId: number): Observable<CandidatInscription[]> {
    return this.http.get<CandidatInscription[]>('/api/cursus/candidats', { params: { saisonId } });
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

  /** Séjour : une séance par jour × plongée du jour × info complémentaire, créées en une fois. */
  creerSerieSeances(demande: DemandeSerieSeances): Observable<SeanceVue[]> {
    return this.http.post<SeanceVue[]>('/api/seances/serie', demande);
  }

  /** Séances d'une saison à partir de créneaux hebdomadaires : aperçu seul, rien n'est enregistré. ADMIN. */
  apercuGenerationSaison(demande: DemandeGenerationSaison): Observable<GenerationSaisonVue> {
    return this.http.post<GenerationSaisonVue>('/api/seances/generation/apercu', demande);
  }

  genererSaison(demande: DemandeGenerationSaison): Observable<GenerationSaisonVue> {
    return this.http.post<GenerationSaisonVue>('/api/seances/generation', demande);
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
  async precharger(): Promise<{ grilles: number; feuilles: number; fiches: number; photos: number }> {
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
    await this.tenter(() => this.progressionsDeLaSaison());
    await this.tenter(() => this.planningHorsLigne());
    await this.tenter(() => this.roster());
    await this.tenter(() => this.groupesEntrainementSaisonOuverte());
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

    // Trombinoscopes et photos. Une photo dont le consentement a été retiré
    // depuis le dernier préchargement est effacée du téléphone.
    let photos = 0;
    const eleves = await this.tenter(() => this.trombinoscope()) ?? [];
    const moniteurs = await this.tenter(() => this.trombinoscopeMoniteurs()) ?? [];
    const aCharger = [
      ...eleves.map(l => ({ cle: `photo-eleve:${l.eleveId}`, aPhoto: l.aPhoto, lire: () => this.photoEleve(l.eleveId) })),
      ...moniteurs.map(m => ({ cle: `photo-moniteur:${m.id}`, aPhoto: m.aPhoto, lire: () => this.photoMoniteur(m.id) }))
    ];
    for (const p of aCharger) {
      if (!p.aPhoto) await supprimer(MAGASIN_CACHE, p.cle);
      else if (await this.tenter(p.lire)) photos++;
    }
    return { grilles: paquet.grilles.length, feuilles, fiches, photos };
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

  /**
   * Vue d'ensemble de la saison ouverte, réservée aux encadrants (roster
   * « Infos Élèves »). Embarquée hors ligne par « Préparer hors ligne ».
   */
  roster(): Promise<RosterVue> {
    return this.lireOuRetomber('roster', () => this.http.get<RosterVue>('/api/roster'));
  }

  /** Programme d'exercices d'une séance (encadrants). Nécessite le réseau. */
  programmeSeance(seanceId: number): Observable<ProgrammeVue> {
    return this.http.get<ProgrammeVue>(`/api/seances/${seanceId}/programme`);
  }

  /**
   * Remplace le programme d'un groupe (null : le programme commun) par la
   * liste donnée, dans son ordre ; les autres programmes ne bougent pas.
   */
  enregistrerProgrammeSeance(seanceId: number, groupeId: number | null,
                             exercices: DemandeExercice[]): Observable<ProgrammeVue> {
    const params: Record<string, number> = groupeId == null ? {} : { groupeId };
    return this.http.put<ProgrammeVue>(`/api/seances/${seanceId}/programme`, exercices, { params });
  }

  /** Plusieurs élèves présents, un ou plusieurs critères, un même commentaire. Nécessite le réseau. */
  noterGroupe(seanceId: number, demande: DemandeNotationGroupee): Observable<BilanNotationGroupee> {
    return this.http.post<BilanNotationGroupee>(`/api/seances/${seanceId}/notation-groupee`, demande);
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
    niveauPlongeur?: string | null;
    numeroLicence?: string | null;
    certificatValideJusquAu?: string | null;
    admin?: boolean;
    directeurTechnique?: boolean;
    tiv?: boolean;
  }): Observable<MoniteurVue> {
    return this.http.post<MoniteurVue>('/api/admin/moniteurs', demande);
  }

  /** Seul endroit où le niveau d'encadrement et les rôles (admin, directeur technique, TIV) d'un moniteur changent. */
  modifierMoniteur(id: number, demande: {
    email: string;
    nom: string;
    prenom: string;
    niveauEncadrement: 'E1' | 'E2' | 'E3' | 'E4';
    niveauPlongeur: string | null;
    numeroLicence: string | null;
    certificatValideJusquAu: string | null;
    admin: boolean;
    directeurTechnique: boolean;
    tiv: boolean;
  }): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}`, demande);
  }

  changerActivationMoniteur(id: number, actif: boolean): Observable<MoniteurVue> {
    return this.http.put<MoniteurVue>(`/api/admin/moniteurs/${id}/activation`, { actif });
  }

  changerMotDePasseMoniteur(id: number, nouveauMotDePasse: string): Observable<unknown> {
    return this.http.put(`/api/admin/moniteurs/${id}/mot-de-passe`, { nouveauMotDePasse });
  }

  envoyerLienReinitialisationMoniteur(id: number): Observable<unknown> {
    return this.http.post(`/api/admin/moniteurs/${id}/lien-reinitialisation`, {});
  }

  supprimerMoniteur(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/moniteurs/${id}`);
  }

  changerAutorisationImageMoniteur(id: number, autorisationImage: boolean): Observable<MoniteurVue> {
    if (!autorisationImage) void supprimer(MAGASIN_CACHE, `photo-moniteur:${id}`);
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

  trombinoscope(): Promise<LigneTrombinoscope[]> {
    return this.lireOuRetomber('trombinoscope',
      () => this.http.get<LigneTrombinoscope[]>('/api/trombinoscope'));
  }

  /** À convertir en URL d'objet côté composant : l'auth passe par un en-tête, pas par un cookie. */
  /** Moniteurs actifs, accessible à tout encadrant. */
  trombinoscopeMoniteurs(): Promise<LigneTrombinoscopeMoniteur[]> {
    return this.lireOuRetomber('trombinoscope-moniteurs',
      () => this.http.get<LigneTrombinoscopeMoniteur[]>('/api/moniteurs/trombinoscope'));
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

  photoMoniteur(id: number): Promise<Blob> {
    return this.lirePhoto(`photo-moniteur:${id}`,
      () => this.http.get(`/api/moniteurs/${id}/photo`, { responseType: 'blob' }));
  }

  photoEleve(eleveId: number): Promise<Blob> {
    return this.lirePhoto(`photo-eleve:${eleveId}`,
      () => this.http.get(`/api/eleves/${eleveId}/photo`, { responseType: 'blob' }));
  }

  changerAutorisationImage(eleveId: number, autorisationImage: boolean): Observable<unknown> {
    if (!autorisationImage) void supprimer(MAGASIN_CACHE, `photo-eleve:${eleveId}`);
    return this.http.put(`/api/eleves/${eleveId}/autorisation-image`, { autorisationImage });
  }

  deposerPhotoEleve(eleveId: number, fichier: File): Observable<unknown> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post(`/api/eleves/${eleveId}/photo`, donnees);
  }

  supprimerPhotoEleve(eleveId: number): Observable<unknown> {
    void supprimer(MAGASIN_CACHE, `photo-eleve:${eleveId}`);
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

  /** Ouvert aux moniteurs : seules les tailles de gilet et de combinaison changent. */
  modifierTaillesEleve(id: number, tailles: { tailleGilet: string | null; tailleCombinaison: string | null }): Observable<EleveVue> {
    return this.http.put<EleveVue>(`/api/eleves/${id}/tailles`, tailles);
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

  /** groupeId : groupe d'entraînement de la saison où ranger l'élève ; absent ou null, son groupe ne change pas. */
  inscrireCursus(demande: {
    eleveId: number; saisonId: number; niveau: 'N1' | 'N2' | 'N3'; groupeId?: number | null;
  }): Observable<CursusVue> {
    return this.http.post<CursusVue>('/api/cursus', demande);
  }

  /** niveau : refusé par le serveur dès qu'une compétence est notée. */
  modifierCursus(id: number, demande: {
    statut: string; niveau?: 'N1' | 'N2' | 'N3';
  }): Observable<CursusVue> {
    return this.http.put<CursusVue>(`/api/cursus/${id}`, demande);
  }

  /** La formation devient une adhésion sans formation (maintien) ; refusé s'il y a des notes ou des présences. */
  passerEnMaintien(cursusId: number): Observable<unknown> {
    return this.http.post(`/api/cursus/${cursusId}/maintien`, {});
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

  /** groupeId : groupe d'entraînement de la saison où ranger l'élève ; absent ou null, son groupe ne change pas. */
  adherer(demande: { eleveId: number; saisonId: number; groupeId?: number | null }): Observable<AdhesionVue> {
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
  //  Progressions types (voir /admin/progressions). Lecture pour tout
  //  encadrant, écriture réservée à l'ADMIN. Une progression s'enregistre
  //  d'un bloc, avec toutes ses périodes.
  // ----------------------------------------------------------------

  progressions(): Observable<ProgressionResume[]> {
    return this.http.get<ProgressionResume[]>('/api/progressions');
  }

  progression(id: number): Observable<ProgressionVue> {
    return this.http.get<ProgressionVue>(`/api/progressions/${id}`);
  }

  creerProgression(demande: DemandeProgression): Observable<ProgressionVue> {
    return this.http.post<ProgressionVue>('/api/progressions', demande);
  }

  modifierProgression(id: number, demande: DemandeProgression): Observable<ProgressionVue> {
    return this.http.put<ProgressionVue>(`/api/progressions/${id}`, demande);
  }

  copierProgression(id: number): Observable<ProgressionVue> {
    return this.http.post<ProgressionVue>(`/api/progressions/${id}/copie`, {});
  }

  supprimerProgression(id: number): Observable<unknown> {
    return this.http.delete(`/api/progressions/${id}`);
  }

  /** Progressions suivies par la saison ouverte : programme des séances, gardé pour le hors ligne. */
  progressionsDeLaSaison(): Promise<ProgressionVue[]> {
    return this.lireOuRetomber('progressions:saison',
      () => this.http.get<ProgressionVue[]>('/api/progressions/saison'));
  }

  /** Pour l'écran des saisons : n'importe quelle saison, sans passer par le cache. */
  progressionsSaison(saisonId: number): Observable<ProgressionVue[]> {
    return this.http.get<ProgressionVue[]>('/api/progressions/saison', { params: { saisonId } });
  }

  /** Au plus une progression par référentiel : le serveur refuse sinon. */
  definirProgressionsSaison(saisonId: number, progressionIds: number[]): Observable<ProgressionVue[]> {
    return this.http.put<ProgressionVue[]>(`/api/progressions/saison/${saisonId}`, { progressionIds });
  }

  // ----------------------------------------------------------------
  //  Planning du bassin : espaces et groupes d'entraînement. Lecture pour
  //  les encadrants, écriture réservée à l'ADMIN.
  // ----------------------------------------------------------------

  espacesBassin(): Observable<EspaceBassinVue[]> {
    return this.http.get<EspaceBassinVue[]>('/api/espaces-bassin');
  }

  creerEspaceBassin(demande: DemandeEspaceBassin): Observable<EspaceBassinVue> {
    return this.http.post<EspaceBassinVue>('/api/espaces-bassin', demande);
  }

  modifierEspaceBassin(id: number, demande: DemandeEspaceBassin): Observable<EspaceBassinVue> {
    return this.http.put<EspaceBassinVue>(`/api/espaces-bassin/${id}`, demande);
  }

  supprimerEspaceBassin(id: number): Observable<unknown> {
    return this.http.delete(`/api/espaces-bassin/${id}`);
  }

  groupesEntrainement(saisonId: number): Observable<GroupeEntrainementVue[]> {
    return this.http.get<GroupeEntrainementVue[]>('/api/groupes-entrainement', { params: { saisonId } });
  }

  /**
   * Groupes d'entraînement de la saison ouverte, avec repli sur le cache :
   * filtre des pages Infos élèves, Présences et Trombinoscope. Pas de saison
   * ouverte : aucun groupe.
   */
  async groupesEntrainementSaisonOuverte(): Promise<GroupeEntrainementVue[]> {
    const ouverte = (await this.saisonsHorsLigne()).find(s => s.ouverte);
    if (!ouverte) return [];
    return this.lireOuRetomber(`groupes-entrainement:${ouverte.id}`, () => this.groupesEntrainement(ouverte.id));
  }

  creerGroupeEntrainement(demande: DemandeGroupeEntrainement): Observable<GroupeEntrainementVue> {
    return this.http.post<GroupeEntrainementVue>('/api/groupes-entrainement', demande);
  }

  modifierGroupeEntrainement(id: number, demande: DemandeGroupeEntrainement): Observable<GroupeEntrainementVue> {
    return this.http.put<GroupeEntrainementVue>(`/api/groupes-entrainement/${id}`, demande);
  }

  supprimerGroupeEntrainement(id: number): Observable<unknown> {
    return this.http.delete(`/api/groupes-entrainement/${id}`);
  }

  ordonnerGroupesEntrainement(saisonId: number, groupeIds: number[]): Observable<GroupeEntrainementVue[]> {
    return this.http.put<GroupeEntrainementVue[]>(`/api/groupes-entrainement/saison/${saisonId}/ordre`, { groupeIds });
  }

  elevesSaisonGroupes(saisonId: number): Observable<EleveSaisonGroupeVue[]> {
    return this.http.get<EleveSaisonGroupeVue[]>(`/api/groupes-entrainement/saison/${saisonId}/eleves`);
  }

  rangerEleveGroupe(saisonId: number, eleveId: number, groupeId: number | null): Observable<EleveSaisonGroupeVue> {
    return this.http.put<EleveSaisonGroupeVue>(
      `/api/groupes-entrainement/saison/${saisonId}/eleves/${eleveId}`, { groupeId });
  }

  appliquerSuggestionsGroupes(saisonId: number): Observable<EleveSaisonGroupeVue[]> {
    return this.http.post<EleveSaisonGroupeVue[]>(`/api/groupes-entrainement/saison/${saisonId}/suggestions`, {});
  }

  /** Planning des soirées d'une saison : où est chaque groupe, qui sont le DP fosse et le DP piscine. */
  planning(saisonId: number): Observable<PlanningVue> {
    return this.http.get<PlanningVue>('/api/planning', { params: { saisonId } });
  }

  /** Planning de la saison ouverte, avec repli sur le cache : consulté au bord du bassin. */
  planningHorsLigne(): Promise<PlanningVue> {
    return this.lireOuRetomber('planning', () => this.http.get<PlanningVue>('/api/planning'));
  }

  definirCasePlanning(saisonId: number, date: string, groupeId: number,
                      demande: DemandeCasePlanning): Observable<SoireePlanningVue> {
    return this.http.put<SoireePlanningVue>(
      `/api/planning/saison/${saisonId}/soirees/${date}/groupes/${groupeId}`, demande);
  }

  definirSoireePlanning(saisonId: number, date: string,
                        demande: { dpFosseId: number | null; dpPiscineId: number | null; note: string | null }
  ): Observable<SoireePlanningVue> {
    return this.http.put<SoireePlanningVue>(`/api/planning/saison/${saisonId}/soirees/${date}`, demande);
  }

  /** L'encadrant connecté annonce sa présence à une soirée ; null efface sa réponse. */
  definirMaDisponibilite(saisonId: number, date: string,
                         reponse: ReponseDisponibilite | null): Observable<SoireePlanningVue> {
    return this.http.put<SoireePlanningVue>(
      `/api/planning/saison/${saisonId}/soirees/${date}/disponibilite`, { reponse });
  }

  /** Un admin répond à la place d'un encadrant (prévenu par téléphone, par exemple). */
  definirDisponibilite(saisonId: number, date: string, utilisateurId: number,
                       reponse: ReponseDisponibilite | null): Observable<SoireePlanningVue> {
    return this.http.put<SoireePlanningVue>(
      `/api/planning/saison/${saisonId}/soirees/${date}/disponibilites/${utilisateurId}`, { reponse });
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

  /**
   * Comme lireOuRetomber, mais la copie locale ne sert que faute de réseau.
   * Si le serveur répond (404 : consentement retiré ou photo supprimée), la
   * copie est effacée : une photo retirée ne doit plus s'afficher nulle part.
   */
  private async lirePhoto(cle: string, appel: () => Observable<Blob>): Promise<Blob> {
    try {
      const photo = await firstValueFrom(appel());
      await this.deposer(cle, photo);
      return photo;
    } catch (erreur) {
      if (erreur instanceof HttpErrorResponse && erreur.status !== 0) {
        await supprimer(MAGASIN_CACHE, cle);
        throw erreur;
      }
      const entree = await lire<Entree<Blob>>(MAGASIN_CACHE, cle);
      if (entree) return entree.valeur;
      throw erreur;
    }
  }

  private deposer<T>(cle: string, valeur: T): Promise<IDBValidKey> {
    return ecrire<Entree<T>>(MAGASIN_CACHE, { cle, valeur, majLe: Date.now() });
  }

  // ----------------------------------------------------------------
  //  Matériel du club et prêts : directeur technique (ou ADMIN).
  //  Pas de mode hors ligne : un prêt se vérifie contre l'état du serveur.
  // ----------------------------------------------------------------

  equipements(): Observable<EquipementVue[]> {
    return this.http.get<EquipementVue[]>('/api/materiel/equipements');
  }

  ficheEquipement(id: number): Observable<FicheEquipementVue> {
    return this.http.get<FicheEquipementVue>(`/api/materiel/equipements/${id}`);
  }

  creerEquipement(demande: DemandeEquipement): Observable<EquipementVue> {
    return this.http.post<EquipementVue>('/api/materiel/equipements', demande);
  }

  modifierEquipement(id: number, demande: DemandeEquipement): Observable<EquipementVue> {
    return this.http.put<EquipementVue>(`/api/materiel/equipements/${id}`, demande);
  }

  supprimerEquipement(id: number): Observable<unknown> {
    return this.http.delete(`/api/materiel/equipements/${id}`);
  }

  mettreAuRebut(id: number, dateRebut: string, motif: string): Observable<EquipementVue> {
    return this.http.post<EquipementVue>(`/api/materiel/equipements/${id}/rebut`, { dateRebut, motif });
  }

  remettreEnStock(id: number): Observable<EquipementVue> {
    return this.http.delete<EquipementVue>(`/api/materiel/equipements/${id}/rebut`);
  }

  ajouterIntervention(equipementId: number, demande: DemandeIntervention): Observable<InterventionVue> {
    return this.http.post<InterventionVue>(`/api/materiel/equipements/${equipementId}/interventions`, demande);
  }

  modeleInspectionTiv(equipementId: number): Observable<ModeleInspectionTivVue> {
    return this.http.get<ModeleInspectionTivVue>(`/api/materiel/equipements/${equipementId}/inspections-tiv/modele`);
  }

  enregistrerInspectionTiv(equipementId: number, demande: DemandeInspectionTiv): Observable<InspectionTivVue> {
    return this.http.post<InspectionTivVue>(`/api/materiel/equipements/${equipementId}/inspections-tiv`, demande);
  }

  inspectionTiv(id: number): Observable<InspectionTivVue> {
    return this.http.get<InspectionTivVue>(`/api/materiel/inspections-tiv/${id}`);
  }

  /** enCours : prêts non rendus ; sinon l'historique des prêts rendus. */
  prets(enCours: boolean): Observable<PretVue[]> {
    return this.http.get<PretVue[]>('/api/materiel/prets', { params: { enCours } });
  }

  preter(demande: DemandePret): Observable<PretVue> {
    return this.http.post<PretVue>('/api/materiel/prets', demande);
  }

  rendrePret(id: number, demande: DemandeRetour): Observable<PretVue> {
    return this.http.post<PretVue>(`/api/materiel/prets/${id}/retour`, demande);
  }

  annulerPret(id: number): Observable<unknown> {
    return this.http.delete(`/api/materiel/prets/${id}`);
  }

  photosPret(pretId: number): Observable<PhotoPretVue[]> {
    return this.http.get<PhotoPretVue[]>(`/api/materiel/prets/${pretId}/photos`);
  }

  deposerPhotoPret(pretId: number, fichier: File, moment: MomentPhotoPret,
                   equipementId: number | null, legende: string | null): Observable<PhotoPretVue> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    donnees.append('moment', moment);
    if (equipementId !== null) donnees.append('equipementId', String(equipementId));
    if (legende) donnees.append('legende', legende);
    return this.http.post<PhotoPretVue>(`/api/materiel/prets/${pretId}/photos`, donnees);
  }

  photoPret(photoId: number): Observable<Blob> {
    return this.http.get(`/api/materiel/prets/photos/${photoId}`, { responseType: 'blob' });
  }

  supprimerPhotoPret(photoId: number): Observable<unknown> {
    return this.http.delete(`/api/materiel/prets/photos/${photoId}`);
  }

  emprunteurs(): Observable<EmprunteurVue[]> {
    return this.http.get<EmprunteurVue[]>('/api/materiel/emprunteurs');
  }

  /** Reprise du classeur Excel du matériel ; ce qui existe déjà n'est pas touché. */
  importerClasseurMateriel(fichier: File): Observable<RapportImportMateriel> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post<RapportImportMateriel>('/api/materiel/import', donnees);
  }

  /** Blocs et gilets au format du classeur ci-dessus, réimportable. */
  exporterClasseurMateriel(): Observable<Blob> {
    return this.http.get('/api/materiel/export.xlsx', { responseType: 'blob' });
  }

  /** Les QR codes reprennent l'adresse du site telle que le navigateur la voit. */
  etiquettesMateriel(ids: number[]): Observable<EtiquetteMateriel[]> {
    return this.http.get<EtiquetteMateriel[]>('/api/materiel/etiquettes',
      { params: { ids: ids.join(','), origine: window.location.origin } });
  }

  /** Le texte d'un QR code lu par le téléphone : adresse d'une fiche ou référence du club. */
  retrouverEquipementParQrCode(contenu: string): Observable<{ equipementId: number }> {
    return this.http.post<{ equipementId: number }>('/api/materiel/qr-code', { contenu });
  }

  /** Une photo de l'étiquette, lue par le serveur quand le navigateur ne sait pas lire un QR code. */
  retrouverEquipementSurPhoto(fichier: File): Observable<{ equipementId: number }> {
    const donnees = new FormData();
    donnees.append('fichier', fichier);
    return this.http.post<{ equipementId: number }>('/api/materiel/qr-code/photo', donnees);
  }

  // ----------------------------------------------------------------
  //  Sorties : lecture pour les encadrants, gestion par un admin ou le
  //  directeur technique.
  // ----------------------------------------------------------------

  /** recentes : à venir ou finies depuis peu (choix pour un prêt) ; sinon toutes, les plus récentes d'abord. */
  sorties(recentes: boolean): Observable<SortieVue[]> {
    return this.http.get<SortieVue[]>('/api/sorties', { params: { recentes } });
  }

  creerSortie(demande: DemandeSortie): Observable<SortieVue> {
    return this.http.post<SortieVue>('/api/sorties', demande);
  }

  modifierSortie(id: number, demande: DemandeSortie): Observable<SortieVue> {
    return this.http.put<SortieVue>(`/api/sorties/${id}`, demande);
  }

  supprimerSortie(id: number): Observable<unknown> {
    return this.http.delete(`/api/sorties/${id}`);
  }

  seancesPossiblesSortie(id: number): Observable<SeancePossibleVue[]> {
    return this.http.get<SeancePossibleVue[]>(`/api/sorties/${id}/seances-possibles`);
  }

  definirSeancesSortie(id: number, seanceIds: number[]): Observable<SortieVue> {
    return this.http.put<SortieVue>(`/api/sorties/${id}/seances`, { seanceIds });
  }
}
