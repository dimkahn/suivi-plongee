import { describe, expect, it } from 'vitest';
import { abonnementPourServeur, etatNotifications } from './notifications-telephone';

describe('etatNotifications', () => {
  const base = { pushPossible: true, iphoneHorsAppli: false, permission: 'default' as const, activees: false };

  it("propose d'activer quand le téléphone le permet", () => {
    expect(etatNotifications(base)).toBe('a-activer');
  });

  it("dit activées quand ce téléphone est abonné et autorisé", () => {
    expect(etatNotifications({ ...base, permission: 'granted', activees: true })).toBe('activees');
  });

  it("repropose d'activer quand l'autorisation a été retirée depuis", () => {
    expect(etatNotifications({ ...base, permission: 'default', activees: true })).toBe('a-activer');
  });

  it("signale les notifications bloquées dans les réglages", () => {
    expect(etatNotifications({ ...base, permission: 'denied' })).toBe('refusees');
  });

  it("sur iPhone, demande d'installer l'appli sur l'écran d'accueil d'abord", () => {
    expect(etatNotifications({ ...base, pushPossible: false, iphoneHorsAppli: true })).toBe('installer-d-abord');
  });

  it("n'affiche rien quand le navigateur ne sait pas recevoir de notification", () => {
    expect(etatNotifications({ ...base, pushPossible: false })).toBe('indisponibles');
  });
});

describe('abonnementPourServeur', () => {
  it("met l'abonnement du navigateur à plat pour le serveur", () => {
    expect(abonnementPourServeur({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'P', auth: 'A' } }))
      .toEqual({ endpoint: 'https://fcm.googleapis.com/x', p256dh: 'P', auth: 'A' });
  });

  it("refuse un abonnement sans clés", () => {
    expect(abonnementPourServeur({ endpoint: 'https://fcm.googleapis.com/x' })).toBeNull();
  });
});
