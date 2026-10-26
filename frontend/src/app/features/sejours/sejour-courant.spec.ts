import { describe, expect, it } from 'vitest';
import { sejourARouvrir, ticketQrCode } from './sejour-courant';

describe('ticketQrCode', () => {
  it("lit le ticket dans le fragment de l'adresse du QR code", () => {
    expect(ticketQrCode('qr=Ab-c_9')).toBe('Ab-c_9');
  });

  it("ne trouve rien dans un autre fragment ou sans fragment", () => {
    expect(ticketQrCode('frais')).toBeNull();
    expect(ticketQrCode(null)).toBeNull();
    expect(ticketQrCode('qr=')).toBeNull();
  });
});

describe('sejourARouvrir', () => {
  const maintenant = new Date('2027-06-20T10:00:00');

  it("rouvre le séjour du participant connecté tant que sa connexion dure", () => {
    expect(sejourARouvrir({ code: 'abc', expireLe: '2027-07-14T23:59:00' }, maintenant)).toBe('abc');
  });

  it("ne rouvre rien quand la connexion est finie", () => {
    expect(sejourARouvrir({ code: 'abc', expireLe: '2027-06-20T09:59:00' }, maintenant)).toBeNull();
  });

  it("ne rouvre rien sans séjour retenu sur le téléphone", () => {
    expect(sejourARouvrir(undefined, maintenant)).toBeNull();
  });

  it("rouvre un séjour retenu sans date de fin (entrée d'une version précédente)", () => {
    expect(sejourARouvrir({ code: 'abc', expireLe: null }, maintenant)).toBe('abc');
  });
});
