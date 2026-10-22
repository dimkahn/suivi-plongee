/**
 * Le séjour sans réseau, en calcul pur (testé à part) : les modifications
 * gardées sur le téléphone, comment une nouvelle se range parmi celles qui
 * attendent, la requête qui la rejoue, et le séjour tel qu'il apparaît avec
 * elles. Le stockage et l'envoi sont dans `FileSejourService`.
 *
 * Comme pour les fiches de sécurité : une file, jamais un cache d'écriture.
 * Le serveur reste seul juge : il revérifie droits et règles à l'envoi, et
 * une création rejouée (même référence) n'est faite qu'une fois.
 */
import {
  DemandeAffaire, DemandeDepense, DemandeEvenement, DemandeLogement, DemandeMesInformations, DemandeParticipant,
  DemandeVersement, DemandeVoiture, DepenseVue, FraisVue, SejourVue, SensVoyage, Trajet
} from './sejour-api';

export type ModificationSejour =
  | { type: 'infos'; texte: string | null }
  | { type: 'conseil'; texte: string | null }
  | { type: 'affaires'; affaires: DemandeAffaire[] }
  | { type: 'mes-informations'; demande: DemandeMesInformations }
  | { type: 'trajet'; sens: SensVoyage; trajet: Trajet | null; participantIds: number[] }
  /** id null : un ajout ; sinon la modification de l'existant. */
  | { type: 'participant'; id: number | null; demande: DemandeParticipant }
  | { type: 'voiture'; id: number | null; demande: DemandeVoiture }
  | { type: 'logement'; id: number | null; demande: DemandeLogement }
  | { type: 'evenement'; id: number | null; demande: DemandeEvenement }
  | { type: 'depense'; id: number | null; demande: DemandeDepense }
  | { type: 'versement'; demande: DemandeVersement }
  | { type: 'suppression'; objet: ObjetSupprimable; id: number };

export type ObjetSupprimable = 'participant' | 'voiture' | 'logement' | 'evenement' | 'depense' | 'versement';

export interface ModificationEnAttente {
  /** Une entrée par cible : une nouvelle version remplace la précédente. */
  cle: string;
  sejourId: number;
  /** Le nom du séjour, pour le bandeau en cas de refus. */
  nomSejour: string;
  modification: ModificationSejour;
  /** Référence tirée par le téléphone, envoyée avec une création (en-tête X-Reference-Client). */
  reference: string;
  /** Négatif : l'id montré à l'écran pour ce qui est ajouté sans réseau, en attendant le vrai. */
  idProvisoire: number | null;
  /** « Voiture « Clio » », « Dépense « Restaurant » ». */
  libelle: string;
  /** Rang d'envoi, strictement croissant ; une nouvelle version garde celui de la première. */
  ordre: number;
  /** Version : un envoi ne retire l'entrée que si elle n'a pas changé entre-temps. */
  majLe: number;
}

export interface ModificationRefusee extends ModificationEnAttente {
  raison: string;
  refuseeLe: number;
}

/** Une modification à ranger : ce que l'écran demande, avec de quoi la nommer. */
export interface NouvelleModification {
  sejourId: number;
  nomSejour: string;
  modification: ModificationSejour;
  libelle: string;
}

const AJOUTS = ['participant', 'voiture', 'logement', 'evenement', 'depense'] as const;

function estAjout(m: ModificationSejour): boolean {
  return m.type === 'versement' || ((AJOUTS as readonly string[]).includes(m.type) && (m as { id: number | null }).id === null);
}

/** La cible d'une modification d'état ; null pour un ajout (chacun est unique) ou un trajet commun. */
function cible(m: ModificationSejour): string | null {
  switch (m.type) {
    case 'infos': case 'conseil': case 'affaires': case 'mes-informations': return m.type;
    case 'trajet': case 'versement': return null;
    case 'suppression': return `${m.objet}:${m.id}`;
    default: return m.id === null ? null : `${m.type}:${m.id}`;
  }
}

/**
 * Range une nouvelle modification parmi celles qui attendent (tous séjours
 * confondus) et rend la file obtenue :
 * - modifier ou supprimer ce qui a été ajouté sans réseau change ou retire
 *   l'ajout lui-même (rien n'est encore parti) ;
 * - une nouvelle version d'un même état remplace l'ancienne, à son rang ;
 * - supprimer un objet retire la modification qui l'attendait.
 */
export function ranger(file: ModificationEnAttente[], n: NouvelleModification, reference: string,
                       maintenant: number): ModificationEnAttente[] {
  const m = n.modification;
  const duSejour = (e: ModificationEnAttente) => e.sejourId === n.sejourId;
  const idVise = m.type === 'suppression' ? m.id : 'id' in m ? m.id : null;

  if (idVise !== null && idVise < 0) {
    const ajout = file.find(e => duSejour(e) && e.idProvisoire === idVise);
    if (!ajout) return file;
    if (m.type === 'suppression') return file.filter(e => e !== ajout);
    const modification = { ...m, id: null } as ModificationSejour;
    return file.map(e => e === ajout ? { ...e, modification, libelle: n.libelle, majLe: maintenant } : e);
  }

  const ordre = Math.max(maintenant, ...file.map(e => e.ordre + 1));
  const c = cible(m);
  const cle = c === null ? `${n.sejourId}:${reference}` : `${n.sejourId}:${c}`;
  const precedente = file.find(e => e.cle === cle);
  const entree: ModificationEnAttente = {
    cle, sejourId: n.sejourId, nomSejour: n.nomSejour, modification: m, reference: precedente?.reference ?? reference,
    idProvisoire: estAjout(m) ? -ordre : null, libelle: n.libelle,
    ordre: precedente?.ordre ?? ordre, majLe: maintenant
  };
  // Une suppression a la même cible que la modification de l'objet : elle la remplace.
  return [...file.filter(e => e.cle !== cle), entree].sort((a, b) => a.ordre - b.ordre);
}

export interface RequeteSejour {
  methode: 'POST' | 'PUT' | 'DELETE';
  url: string;
  corps: unknown;
  /** Une création : la référence part dans l'en-tête X-Reference-Client. */
  creation: boolean;
}

const URLS: Record<ObjetSupprimable, string> = {
  participant: 'participants', voiture: 'voitures', logement: 'logements', evenement: 'evenements',
  depense: 'depenses', versement: 'versements'
};

export function requete(sejourId: number, m: ModificationSejour): RequeteSejour {
  const base = `/api/sejours/${sejourId}`;
  const mettre = (url: string, corps: unknown): RequeteSejour => ({ methode: 'PUT', url: base + url, corps, creation: false });
  switch (m.type) {
    case 'infos': return mettre('/infos', { infosPratiques: m.texte });
    case 'conseil': return mettre('/conseil-assurance', { conseilAssurance: m.texte });
    case 'affaires': return mettre('/affaires', { affaires: m.affaires });
    case 'mes-informations': return mettre('/mes-informations', m.demande);
    case 'trajet': return mettre('/trajets', { sens: m.sens, trajet: m.trajet, participantIds: m.participantIds });
    case 'versement': return { methode: 'POST', url: `${base}/versements`, corps: m.demande, creation: true };
    case 'suppression': return { methode: 'DELETE', url: `${base}/${URLS[m.objet]}/${m.id}`, corps: null, creation: false };
    default:
      return m.id === null
        ? { methode: 'POST', url: `${base}/${URLS[m.type]}`, corps: m.demande, creation: true }
        : mettre(`/${URLS[m.type]}/${m.id}`, m.demande);
  }
}

/** Ce que devient une modification dont l'envoi a échoué. */
export type IssueEchec = 'en-attente' | 'deja-faite' | 'refusee';

/**
 * Pas de réponse, erreur du serveur ou session à rouvrir : elle reste sur
 * le téléphone. Une suppression de ce qui n'existe plus (404) est déjà
 * faite. Le reste est un refus, qui remonte au bandeau.
 */
export function issueEchec(statut: number, methode: RequeteSejour['methode']): IssueEchec {
  if (statut === 0 || statut === 401 || statut >= 500) return 'en-attente';
  if (statut === 404 && methode === 'DELETE') return 'deja-faite';
  return 'refusee';
}

/** Ce que fait une lecture qui échoue : prendre la copie du téléphone, l'effacer (plus le droit), ou rien. */
export function lectureEchouee(statut: number): 'copie' | 'effacer' | 'erreur' {
  if (statut === 0 || statut >= 500) return 'copie';
  if (statut === 403 || statut === 404) return 'effacer';
  return 'erreur';
}

/** Les clés de la copie locale, partagées avec « Préparer hors ligne ». */
export function cleSejour(id: number, commeParticipant = false): string {
  return `sejour:${id}${commeParticipant ? ':participant' : ''}`;
}

export function cleListeSejours(toutes: boolean): string {
  return `sejours:${toutes ? 'tous' : 'a-venir'}`;
}

export function cleLienSejour(code: string): string {
  return `lien-sejour:${code}`;
}

/**
 * Un participant ajouté sans réseau a reçu son vrai id : les modifications
 * qui le citent encore par l'id provisoire (voiture, chambre, dépense,
 * trajet commun) le citent désormais par le vrai.
 */
export function remplacerParticipant(m: ModificationSejour, provisoire: number, reel: number): ModificationSejour {
  const r = (id: number | null) => id === provisoire ? reel : id;
  const rs = (ids: number[]) => ids.map(i => i === provisoire ? reel : i);
  switch (m.type) {
    case 'trajet': return { ...m, participantIds: rs(m.participantIds) };
    case 'voiture': return { ...m, demande: { ...m.demande, conducteurId: r(m.demande.conducteurId), passagerIds: rs(m.demande.passagerIds) } };
    case 'logement': return {
      ...m, demande: { ...m.demande, chambres: m.demande.chambres.map(c => ({ ...c, occupantIds: rs(c.occupantIds) })) }
    };
    case 'depense': return {
      ...m, demande: {
        ...m.demande, payeurId: r(m.demande.payeurId)!,
        parts: m.demande.parts.map(p => ({ ...p, participantId: r(p.participantId)! }))
      }
    };
    case 'versement': return { ...m, demande: { ...m.demande, deId: r(m.demande.deId)!, aId: r(m.demande.aId)! } };
    default: return m;
  }
}

/**
 * Le séjour tel qu'il apparaît avec les modifications qui attendent : ce que
 * le serveur (ou la copie) connaît, recouvert dans l'ordre de leur saisie.
 * Les ajouts portent leur id provisoire (négatif). Les comptes des frais sont
 * recalculés comme le fait le serveur ; les avertissements restent ceux de la
 * dernière lecture.
 */
export function appliquerEnAttente(sejour: SejourVue, file: ModificationEnAttente[]): SejourVue {
  let s = sejour;
  const miennes = file.filter(e => e.sejourId === sejour.sortie.id).sort((a, b) => a.ordre - b.ordre);
  if (miennes.length === 0) return sejour;
  for (const e of miennes) s = appliquer(s, e.modification, e.idProvisoire);
  return { ...s, frais: { ...s.frais, comptes: comptesFrais(s.participants.map(p => p.id), s.frais) } };
}

function remplacer<T extends { id: number }>(liste: T[], id: number, nouveau: T): T[] {
  return liste.some(x => x.id === id) ? liste.map(x => x.id === id ? nouveau : x) : liste;
}

function appliquer(s: SejourVue, m: ModificationSejour, idProvisoire: number | null): SejourVue {
  const id = (existant: number | null) => existant ?? idProvisoire ?? 0;
  switch (m.type) {
    case 'infos': return { ...s, infosPratiques: m.texte };
    case 'conseil': return { ...s, conseilAssurance: m.texte };
    case 'affaires': return { ...s, affaires: m.affaires.map((a, i) => ({ ...a, id: -(i + 1) })) };
    case 'mes-informations':
      return { ...s, participants: s.participants.map(p => p.moi ? { ...p, ...m.demande } : p) };
    case 'trajet': {
      const sens = m.sens === 'ARRIVEE' ? 'arrivee' : 'depart';
      return { ...s, participants: s.participants.map(p => m.participantIds.includes(p.id) ? { ...p, [sens]: m.trajet } : p) };
    }
    case 'participant': {
      const ancien = s.participants.find(p => p.id === m.id);
      const p = { moi: false, groupe: null, attestationAssurance: null, ...ancien, ...m.demande, id: id(m.id) };
      return { ...s, participants: m.id === null ? [...s.participants, p] : remplacer(s.participants, m.id, p) };
    }
    case 'voiture': {
      const v = { ...s.voitures.find(x => x.id === m.id), ...m.demande, id: id(m.id) };
      return { ...s, voitures: m.id === null ? [...s.voitures, v] : remplacer(s.voitures, m.id, v) };
    }
    case 'logement': {
      const ancien = s.logements.find(x => x.id === m.id);
      const logementId = id(m.id);
      const l = {
        ...m.demande, id: logementId,
        chambres: m.demande.chambres.map((c, i) => ({ ...c, id: ancien?.chambres[i]?.id ?? logementId * 100 - i - 1 }))
      };
      return { ...s, logements: m.id === null ? [...s.logements, l] : remplacer(s.logements, m.id, l) };
    }
    case 'evenement': {
      const ev = { ...m.demande, id: id(m.id) };
      return { ...s, evenements: m.id === null ? [...s.evenements, ev] : remplacer(s.evenements, m.id, ev) };
    }
    case 'depense': {
      const ancienne = s.frais.depenses.find(d => d.id === m.id);
      const d: DepenseVue = {
        photos: [], saisieParUtilisateurId: null, saisieParParticipantId: s.frais.droits.moiId,
        ...ancienne, ...m.demande, id: id(m.id)
      };
      const depenses = m.id === null ? [...s.frais.depenses, d] : remplacer(s.frais.depenses, m.id, d);
      const modifiables = m.id === null ? [...s.frais.droits.depensesModifiables, d.id] : s.frais.droits.depensesModifiables;
      return { ...s, frais: { ...s.frais, depenses, droits: { ...s.frais.droits, depensesModifiables: modifiables } } };
    }
    case 'versement': {
      const v = { ...m.demande, id: id(null) };
      return {
        ...s, frais: {
          ...s.frais, versements: [...s.frais.versements, v],
          droits: { ...s.frais.droits, versementsSupprimables: [...s.frais.droits.versementsSupprimables, v.id] }
        }
      };
    }
    case 'suppression': return supprimer(s, m.objet, m.id);
  }
}

function supprimer(s: SejourVue, objet: ObjetSupprimable, id: number): SejourVue {
  switch (objet) {
    case 'participant': return {
      ...s,
      participants: s.participants.filter(p => p.id !== id),
      voitures: s.voitures.map(v => ({
        ...v, conducteurId: v.conducteurId === id ? null : v.conducteurId, passagerIds: v.passagerIds.filter(i => i !== id)
      })),
      logements: s.logements.map(l => ({
        ...l, chambres: l.chambres.map(c => ({ ...c, occupantIds: c.occupantIds.filter(i => i !== id) }))
      }))
    };
    case 'voiture': return { ...s, voitures: s.voitures.filter(v => v.id !== id) };
    case 'logement': return { ...s, logements: s.logements.filter(l => l.id !== id) };
    case 'evenement': return { ...s, evenements: s.evenements.filter(e => e.id !== id) };
    case 'depense': return { ...s, frais: { ...s.frais, depenses: s.frais.depenses.filter(d => d.id !== id) } };
    case 'versement': return { ...s, frais: { ...s.frais, versements: s.frais.versements.filter(v => v.id !== id) } };
  }
}

/** La part de chacun dans une dépense, au centime près : comme `FraisSejour.repartir` côté serveur. */
export function repartir(montant: number, parts: { participantId: number; parts: number }[]): Map<number, number> {
  const triees = [...parts].sort((a, b) => a.participantId - b.participantId);
  const total = triees.reduce((t, p) => t + p.parts, 0);
  const resultat = new Map<number, number>();
  if (total === 0) return resultat;
  let reparti = 0;
  for (const p of triees) {
    const part = Math.floor(montant * p.parts / total);
    resultat.set(p.participantId, part);
    reparti += part;
  }
  const ids = [...resultat.keys()];
  for (let reste = montant - reparti, i = 0; reste > 0; reste--, i++) {
    const cleId = ids[i % ids.length];
    resultat.set(cleId, resultat.get(cleId)! + 1);
  }
  return resultat;
}

/**
 * Soldes et remboursements à faire, comme `FraisSejour.calculer` côté
 * serveur (qui fait foi à l'envoi) : pour les montrer à jour sans réseau.
 */
export function comptesFrais(participants: number[], frais: Pick<FraisVue, 'depenses' | 'versements'>): FraisVue['comptes'] {
  const comptes = new Map<number, [number, number, number, number]>(); // payé, dû, remboursé, reçu
  const de = (id: number) => {
    if (!comptes.has(id)) comptes.set(id, [0, 0, 0, 0]);
    return comptes.get(id)!;
  };
  participants.forEach(de);
  let total = 0;
  for (const d of frais.depenses) {
    total += d.montantCentimes;
    de(d.payeurId)[0] += d.montantCentimes;
    repartir(d.montantCentimes, d.parts).forEach((part, p) => de(p)[1] += part);
  }
  for (const v of frais.versements) {
    de(v.deId)[2] += v.montantCentimes;
    de(v.aId)[3] += v.montantCentimes;
  }
  const soldes = [...comptes].map(([participantId, [paye, du, rembourse, recu]]) =>
    ({ participantId, payeCentimes: paye, duCentimes: du, soldeCentimes: paye - du + rembourse - recu }));
  return { totalCentimes: total, soldes, remboursements: remboursements(soldes) };
}

function remboursements(soldes: { participantId: number; soldeCentimes: number }[]) {
  // Du plus gros montant au plus petit (à égalité, par id), comme le serveur.
  const ordre = (a: [number, number], b: [number, number]) => b[1] - a[1] || a[0] - b[0];
  const debiteurs: [number, number][] = soldes.filter(s => s.soldeCentimes < 0).map(s => [s.participantId, -s.soldeCentimes]);
  const creanciers: [number, number][] = soldes.filter(s => s.soldeCentimes > 0).map(s => [s.participantId, s.soldeCentimes]);
  const resultat: { deId: number; aId: number; montantCentimes: number }[] = [];
  while (debiteurs.length > 0 && creanciers.length > 0) {
    debiteurs.sort(ordre);
    creanciers.sort(ordre);
    const d = debiteurs.shift()!;
    const c = creanciers.shift()!;
    const montant = Math.min(d[1], c[1]);
    resultat.push({ deId: d[0], aId: c[0], montantCentimes: montant });
    if (d[1] > montant) debiteurs.push([d[0], d[1] - montant]);
    if (c[1] > montant) creanciers.push([c[0], c[1] - montant]);
  }
  return resultat;
}
