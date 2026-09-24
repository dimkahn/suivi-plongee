/**
 * Petite couche au-dessus d'IndexedDB. Pas de dépendance externe : la
 * surface utilisée tient en trois opérations, et une bibliothèque de plus
 * à maintenir pour un club associatif n'en vaut pas le prix.
 *
 * localStorage n'est pas une option : il est synchrone, limité à quelques
 * mégaoctets et interdit dans les artefacts. IndexedDB tient une saison
 * entière de grilles sans effort.
 */

const NOM_BASE = 'suivi-plongee';
const VERSION = 3;

export const MAGASIN_ATTENTE = 'attente';
export const MAGASIN_REFUS = 'refus';
export const MAGASIN_CACHE = 'cache';
/**
 * Écritures d'état faites hors ligne (présence, fiche de sécurité, profil
 * réalisé) : une entrée par cible, la dernière version l'emporte.
 */
export const MAGASIN_ECRITURES = 'ecritures';
export const MAGASIN_REFUS_ECRITURES = 'refusEcritures';

let ouverture: Promise<IDBDatabase> | null = null;

function base(): Promise<IDBDatabase> {
  if (ouverture) return ouverture;

  ouverture = new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(NOM_BASE, VERSION);

    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains(MAGASIN_ATTENTE)) {
        const magasin = db.createObjectStore(MAGASIN_ATTENTE, { keyPath: 'referenceClient' });
        magasin.createIndex('parCursus', 'cursusId', { unique: false });
      }
      if (!db.objectStoreNames.contains(MAGASIN_REFUS)) {
        db.createObjectStore(MAGASIN_REFUS, { keyPath: 'referenceClient' });
      }
      if (!db.objectStoreNames.contains(MAGASIN_CACHE)) {
        db.createObjectStore(MAGASIN_CACHE, { keyPath: 'cle' });
      }
      // Version 3 : écritures d'état hors ligne. La version 2, jamais publiée,
      // portait des magasins propres aux présences : on les retire s'ils existent.
      for (const ancien of ['presences', 'refusPresences']) {
        if (db.objectStoreNames.contains(ancien)) db.deleteObjectStore(ancien);
      }
      if (!db.objectStoreNames.contains(MAGASIN_ECRITURES)) {
        db.createObjectStore(MAGASIN_ECRITURES, { keyPath: 'cle' });
      }
      if (!db.objectStoreNames.contains(MAGASIN_REFUS_ECRITURES)) {
        db.createObjectStore(MAGASIN_REFUS_ECRITURES, { keyPath: 'cle' });
      }
    };

    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });

  return ouverture;
}

function transaction<T>(
  magasin: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return base().then(db => new Promise<T>((resoudre, rejeter) => {
    const tx = db.transaction(magasin, mode);
    const demande = action(tx.objectStore(magasin));
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  }));
}

export function ecrire<T>(magasin: string, valeur: T): Promise<IDBValidKey> {
  return transaction(magasin, 'readwrite', s => s.put(valeur as unknown as object));
}

export function lireTout<T>(magasin: string): Promise<T[]> {
  return transaction<T[]>(magasin, 'readonly', s => s.getAll() as IDBRequest<T[]>);
}

export function lire<T>(magasin: string, cle: IDBValidKey): Promise<T | undefined> {
  return transaction<T | undefined>(magasin, 'readonly', s => s.get(cle) as IDBRequest<T | undefined>);
}

export function supprimer(magasin: string, cle: IDBValidKey): Promise<undefined> {
  return transaction<undefined>(magasin, 'readwrite', s => s.delete(cle) as IDBRequest<undefined>);
}

export function vider(magasin: string): Promise<undefined> {
  return transaction<undefined>(magasin, 'readwrite', s => s.clear() as IDBRequest<undefined>);
}

/** Disponible dans tous les navigateurs visés ; repli pour les plus anciens. */
export function nouvelleReference(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
