/**
 * Les notifications du séjour sur le téléphone, en calcul pur (testé à
 * part) : ce que l'écran propose selon le téléphone, et l'abonnement du
 * navigateur tel que le serveur l'attend. L'abonnement lui-même est dans
 * `NotificationsDuSejour`.
 */

/**
 * - `a-activer` : bouton « Activer les notifications » ;
 * - `activees` : ce téléphone les reçoit ;
 * - `refusees` : bloquées dans les réglages du navigateur ;
 * - `installer-d-abord` : iPhone, hors de l'appli installée (Safari ne les reçoit pas) ;
 * - `indisponibles` : navigateur sans notifications (ou appli en développement) : rien à montrer.
 */
export type EtatNotifications = 'a-activer' | 'activees' | 'refusees' | 'installer-d-abord' | 'indisponibles';

export interface TelephoneNotifications {
  /** Le service worker est là et le navigateur sait recevoir des notifications. */
  pushPossible: boolean;
  /** iPhone ou iPad dans Safari, pas dans l'appli installée sur l'écran d'accueil. */
  iphoneHorsAppli: boolean;
  permission: NotificationPermission;
  /** Ce téléphone s'est abonné pour ce séjour. */
  activees: boolean;
}

export function etatNotifications(t: TelephoneNotifications): EtatNotifications {
  if (t.iphoneHorsAppli) return 'installer-d-abord';
  if (!t.pushPossible) return 'indisponibles';
  if (t.permission === 'denied') return 'refusees';
  return t.activees && t.permission === 'granted' ? 'activees' : 'a-activer';
}

/** Ce que le serveur enregistre : l'adresse du service de notification et les clés de chiffrement. */
export interface AbonnementServeur {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function abonnementPourServeur(json: PushSubscriptionJSON): AbonnementServeur | null {
  const p256dh = json.keys?.['p256dh'];
  const auth = json.keys?.['auth'];
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

/** iPhone ou iPad (iPadOS se dit Mac, mais tactile) ouvert dans Safari, hors de l'appli installée. */
export function iphoneHorsAppli(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const installee = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !installee;
}
