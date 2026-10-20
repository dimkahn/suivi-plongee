import {
  CONTENUS_HORS_LIGNE, choixDeLaFormule, formuleDuChoix, journeeAEmporter, resumePreparation, resumePreparationSurface,
  seancesAEmbarquer
} from './preparation-hors-ligne';

describe('Préparer hors ligne', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 9, 20, 18) }));
  afterEach(() => vi.useRealTimers());

  const seances = [
    { id: 1, date: '2026-10-20' },
    { id: 2, date: '2026-10-21' },
    { id: 3, date: '2026-11-15' },
    { id: 4, date: '2026-09-25' }
  ];

  it('« Tout » embarque chaque contenu, séances à ±30 jours', () => {
    const choix = choixDeLaFormule('tout');
    expect([...choix.contenus].sort()).toEqual([...CONTENUS_HORS_LIGNE].sort());
    expect(choix.periode).toBe('proches');
  });

  it('« Fiche de sécurité du jour » n\'embarque que les fiches de sécurité d\'aujourd\'hui', () => {
    const choix = choixDeLaFormule('fiche-du-jour');
    expect([...choix.contenus]).toEqual(['fiches']);
    expect(choix.periode).toBe('jour');
  });

  it('« Séance du jour » embarque appel, notes et fiche de sécurité d\'aujourd\'hui, sans photos', () => {
    const choix = choixDeLaFormule('seance-du-jour');
    expect([...choix.contenus].sort()).toEqual(['fiches', 'grilles', 'presences']);
    expect(choix.periode).toBe('jour');
  });

  it('Un choix fait à la main qui correspond à une formule la retrouve, sinon « sur mesure »', () => {
    expect(formuleDuChoix({ contenus: new Set(['fiches']), periode: 'jour' })).toBe('fiche-du-jour');
    expect(formuleDuChoix({ contenus: new Set(['fiches']), periode: 'proches' })).toBe('sur-mesure');
    expect(formuleDuChoix({ contenus: new Set(CONTENUS_HORS_LIGNE), periode: 'proches' })).toBe('tout');
  });

  it('Le bilan ne cite que ce qu\'on a choisi d\'emporter, et prévient s\'il n\'y a pas de séance', () => {
    expect(resumePreparation({ grilles: null, feuilles: null, fiches: 1, photos: null }))
      .toBe('Disponible hors ligne : 1 fiche de sécurité.');
    expect(resumePreparation({ grilles: 12, feuilles: 3, fiches: 3, photos: 20 }))
      .toBe('Disponibles hors ligne : 12 grilles, 3 feuilles de présence, 3 fiches de sécurité, 20 photos.');
    expect(resumePreparation({ grilles: null, feuilles: null, fiches: 0, photos: null }))
      .toBe("Aucune fiche de sécurité à emporter : pas de séance sur la période choisie.");
  });

  it('Sécurité surface : la journée de plongée à emporter est aujourd\'hui, sinon la prochaine de ses séances', () => {
    expect(journeeAEmporter(seances)).toBe('2026-10-20');
    expect(journeeAEmporter([{ id: 3, date: '2026-11-15' }, { id: 2, date: '2026-10-21' }, { id: 4, date: '2026-09-25' }]))
      .toBe('2026-10-21');
    expect(journeeAEmporter([{ id: 4, date: '2026-09-25' }])).toBeNull();
  });

  it('Sécurité surface : le bilan nomme la journée emportée, ou dit qu\'il n\'y a rien à venir', () => {
    expect(resumePreparationSurface('2026-10-21', 2)).toBe('Disponibles hors ligne : 2 fiches de sécurité du 21/10/2026.');
    expect(resumePreparationSurface('2026-10-21', 0))
      .toBe('Aucune fiche de sécurité établie pour le 21/10/2026 : réessayez quand le directeur de plongée l\'aura faite.');
    expect(resumePreparationSurface(null, 0)).toBe('Aucune séance à venir ne vous est confiée.');
  });

  it('Période « aujourd\'hui » : les seules séances du jour ; « proches » : à moins de 30 jours', () => {
    expect(seancesAEmbarquer(seances, 'jour').map(s => s.id)).toEqual([1]);
    expect(seancesAEmbarquer(seances, 'proches').map(s => s.id)).toEqual([1, 2, 3, 4]);
    expect(seancesAEmbarquer([...seances, { id: 5, date: '2026-12-01' }], 'proches').map(s => s.id))
      .not.toContain(5);
  });
});
