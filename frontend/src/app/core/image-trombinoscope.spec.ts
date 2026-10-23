import { describe, expect, it } from 'vitest';
import { nomFichierTrombinoscope } from './image-trombinoscope';

describe("Image d'un trombinoscope", () => {
  it('nomme le fichier d’après le titre, sans accents ni espaces', () => {
    expect(nomFichierTrombinoscope('Port-Cros 2027 — Mérous')).toBe('trombinoscope-port-cros-2027-merous.png');
  });

  it('garde un nom de fichier quand le titre ne contient aucune lettre', () => {
    expect(nomFichierTrombinoscope('— ?')).toBe('trombinoscope-groupe.png');
  });
});
