import { PalanqueeVue } from './modeles';
import { bilanRealise, depassements, dureeEntre, etatPalanquee, marquerSortie, minutesDepuis, trierParUrgence } from './fiche-securite-realise';

function palanquee(champs: Partial<PalanqueeVue> = {}): PalanqueeVue {
  return {
    numero: 1, profondeurPrevue: 20, dureePrevue: 40, profondeurRealisee: null, dureeRealisee: null,
    paliers: null, heureImmersion: null, heureSortie: null, membres: [], ...champs
  };
}

describe('Où en est une palanquée au retour de plongée', () => {
  it('Sans heure d\'immersion, elle est à immerger ; immergée sans sortie, à l\'eau ; sinon sortie', () => {
    expect(etatPalanquee(palanquee())).toBe('a-immerger');
    expect(etatPalanquee(palanquee({ heureImmersion: '10:05' }))).toBe('a-l-eau');
    expect(etatPalanquee(palanquee({ heureImmersion: '10:05', heureSortie: '10:47' }))).toBe('sortie');
  });

  it('Une heure de sortie sans immersion (saisie à la main) compte comme sortie', () => {
    expect(etatPalanquee(palanquee({ heureSortie: '10:47' }))).toBe('sortie');
  });
});

describe('Durée entre l\'immersion et la sortie', () => {
  it('En minutes, à partir des heures « HH:MM »', () => {
    expect(dureeEntre('10:05', '10:47')).toBe(42);
  });

  it('Une plongée de nuit qui passe minuit reste positive', () => {
    expect(dureeEntre('23:40', '00:25')).toBe(45);
  });

  it('Une heure absente ou illisible ne donne pas de durée', () => {
    expect(dureeEntre(null, '10:47')).toBeNull();
    expect(dureeEntre('10:05', '')).toBeNull();
    expect(dureeEntre('bientôt', '10:47')).toBeNull();
  });

  it('Les secondes d\'une heure corrigée à la main sont ignorées', () => {
    expect(dureeEntre('10:05:30', '10:47:00')).toBe(42);
  });
});

describe('Marquer la sortie d\'une palanquée', () => {
  it('Note l\'heure et calcule la durée réalisée', () => {
    const p = marquerSortie(palanquee({ heureImmersion: '10:05' }), '10:47');
    expect(p.heureSortie).toBe('10:47');
    expect(p.dureeRealisee).toBe(42);
  });

  it('Une durée réalisée déjà saisie n\'est pas écrasée', () => {
    expect(marquerSortie(palanquee({ heureImmersion: '10:05', dureeRealisee: 40 }), '10:47').dureeRealisee).toBe(40);
  });

  it('Sans heure d\'immersion, la durée reste à saisir', () => {
    expect(marquerSortie(palanquee(), '10:47').dureeRealisee).toBeNull();
  });
});

describe('Temps passé à l\'eau', () => {
  it('Minutes écoulées depuis l\'immersion, à l\'heure de l\'horloge', () => {
    expect(minutesDepuis('10:05', new Date(2026, 9, 18, 10, 17, 30))).toBe(12);
  });
});

describe('Ordre des palanquées au retour de plongée', () => {
  it('Les palanquées en dépassement, puis celles qui vont sortir, passent en tête ; les autres gardent leur ordre', () => {
    const [p1, p2, p3, p4] = [1, 2, 3, 4].map(numero => palanquee({ numero }));
    const statut = (p: PalanqueeVue) => p === p4 ? 'urgence' : p === p2 ? 'attention' : null;
    expect(trierParUrgence([p1, p2, p3, p4], statut).map(p => p.numero)).toEqual([4, 2, 1, 3]);
  });
});

describe('Bilan des palanquées pour la sécurité surface', () => {
  it('Compte celles à immerger, à l\'eau, sorties, et celles sorties dont le profil reste à saisir', () => {
    const bilan = bilanRealise([
      palanquee(),
      palanquee({ heureImmersion: '10:05' }),
      palanquee({ heureImmersion: '10:00', heureSortie: '10:40' }),
      palanquee({ heureImmersion: '10:00', heureSortie: '10:42', profondeurRealisee: 18, dureeRealisee: 42 })
    ]);
    expect(bilan).toEqual({ aImmerger: 1, aLEau: 1, sorties: 2, aCompleter: 1 });
  });
});

describe('Paramètres réalisés au-delà du prévu', () => {
  it('Plus profond ou plus long que prévu : en rouge', () => {
    expect(depassements(palanquee({ profondeurRealisee: 24, dureeRealisee: 45 }))).toEqual({ profondeur: true, duree: true });
  });

  it('Égal au prévu, en dessous, ou pas encore saisi : rien', () => {
    expect(depassements(palanquee({ profondeurRealisee: 20, dureeRealisee: 38 }))).toEqual({ profondeur: false, duree: false });
    expect(depassements(palanquee())).toEqual({ profondeur: false, duree: false });
    expect(depassements(palanquee({ profondeurPrevue: null, profondeurRealisee: 30 }))).toEqual({ profondeur: false, duree: false });
  });
});
