/**
 * Le séjour où ce téléphone est connecté comme participant (lien et code,
 * entrée sans lien ou QR code de l'organisateur) : l'appli installée, qui
 * s'ouvre sur la page de connexion, y renvoie directement. Gardé dans
 * IndexedDB (pas de localStorage), oublié par « Se déconnecter » ou un
 * jeton refusé.
 */
import { MAGASIN_CACHE, ecrire, lire, supprimer } from '../../core/base-locale';

/** Le code de l'adresse du séjour et la fin de la connexion (ISO, heure du club). */
export interface SejourRetenu {
  code: string;
  expireLe: string | null;
}

const CLE = 'sejour-participant-courant';

/** Le séjour à rouvrir au démarrage, tant que sa connexion dure ; null sinon. */
export function sejourARouvrir(retenu: SejourRetenu | undefined, maintenant: Date): string | null {
  if (!retenu) return null;
  if (retenu.expireLe && new Date(retenu.expireLe) <= maintenant) return null;
  return retenu.code;
}

/**
 * Le ticket du QR code, dans le fragment de l'adresse (`#qr=…`) : le
 * navigateur ne l'envoie pas au serveur web ; null s'il n'y en a pas.
 */
export function ticketQrCode(fragment: string | null): string | null {
  const m = /^qr=([A-Za-z0-9_-]+)$/.exec(fragment ?? '');
  return m ? m[1] : null;
}

export async function retenirSejour(code: string, expireLe: string | null | undefined): Promise<void> {
  await ecrire<{ cle: string; valeur: SejourRetenu }>(MAGASIN_CACHE, { cle: CLE, valeur: { code, expireLe: expireLe ?? null } })
    .catch(() => undefined);
}

export async function sejourRetenu(): Promise<string | null> {
  const r = await lire<{ cle: string; valeur: SejourRetenu }>(MAGASIN_CACHE, CLE).catch(() => undefined);
  return sejourARouvrir(r?.valeur, new Date());
}

/** Oublie le séjour retenu, si c'est celui-ci. */
export async function oublierSejour(code: string): Promise<void> {
  const r = await lire<{ cle: string; valeur: SejourRetenu }>(MAGASIN_CACHE, CLE).catch(() => undefined);
  if (r?.valeur.code === code) await supprimer(MAGASIN_CACHE, CLE).catch(() => undefined);
}
