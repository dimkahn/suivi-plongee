import { Droits, manuelPermis, videoPermise } from './droits';
import { manuelsDeLEcran } from './comment-faire';
import { MANUELS } from './manuels';

const AUCUN: Droits = {
  connecte: false, encadrant: false, admin: false, materiel: false, inspection: false, fichesSecurite: false
};
const ELEVE: Droits = { ...AUCUN, connecte: true };
const MONITEUR: Droits = { ...ELEVE, encadrant: true, fichesSecurite: true };
const TIV: Droits = { ...ELEVE, inspection: true };
const SECURITE_SURFACE: Droits = { ...ELEVE, fichesSecurite: true };
const DT: Droits = { ...ELEVE, materiel: true, inspection: true };

const visibles = (d: Droits) => MANUELS.filter(m => manuelPermis(m, d)).map(m => m.id);

describe('L\'aide ne montre que ce que les droits du compte permettent', () => {
  it('Sans connexion, seule l\'aide des écrans publics (connexion, séjour par lien)', () => {
    expect(visibles(AUCUN).sort()).toEqual(['installer-l-appli', 'materiel-du-sejour', 'se-connecter', 'sejour-par-lien']);
  });

  it('« Comment faire ? » reste ouvert sans compte sur un écran public', () => {
    expect(manuelsDeLEcran('/connexion', AUCUN).map(m => m.id)).toEqual(['se-connecter', 'installer-l-appli']);
    expect(manuelsDeLEcran('/sejour/abc', AUCUN).map(m => m.id)).toEqual(['sejour-par-lien', 'materiel-du-sejour']);
  });

  it('Un élève ne voit que les rubriques Découverte et Élève', () => {
    const rubriques = new Set(MANUELS.filter(m => manuelPermis(m, ELEVE)).map(m => m.rubrique));
    expect([...rubriques].sort()).toEqual(['Découverte', 'Élève']);
  });

  it('Un moniteur voit la rubrique Moniteur, pas l\'administration ni le matériel', () => {
    expect(visibles(MONITEUR)).toContain('faire-l-appel');
    expect(visibles(MONITEUR)).not.toContain('ouvrir-une-saison');
    expect(visibles(MONITEUR)).not.toContain('preter-du-materiel');
  });

  it('Un TIV voit l\'inspection TIV et l\'inventaire, pas les prêts', () => {
    expect(visibles(TIV)).toContain('inspection-tiv');
    expect(visibles(TIV)).toContain('inventaire-materiel');
    expect(visibles(TIV)).not.toContain('preter-du-materiel');
  });

  it('La sécurité surface voit la fiche de sécurité, pas l\'appel', () => {
    expect(visibles(SECURITE_SURFACE)).toContain('fiche-de-securite');
    expect(visibles(SECURITE_SURFACE)).not.toContain('faire-l-appel');
  });

  it('Le directeur technique voit les sorties, qu\'il organise', () => {
    expect(visibles(DT)).toContain('organiser-une-sortie');
    expect(visibles(DT)).not.toContain('ouvrir-une-saison');
  });

  it('Un séjour s\'organise par un moniteur désigné ou le créateur de la sortie (DT)', () => {
    expect(visibles(MONITEUR)).toContain('organiser-un-sejour');
    expect(visibles(DT)).toContain('organiser-un-sejour');
    expect(visibles(ELEVE)).not.toContain('organiser-un-sejour');
  });

  it('Une vidéo se voit par sa rubrique ou par un manuel visible qui la cite', () => {
    const inspection = MANUELS.find(m => m.id === 'inspection-tiv')!.videos[0];
    expect(videoPermise({ id: inspection, public: 'Directeur technique' }, TIV)).toBe(true);
    expect(videoPermise({ id: 'D-inconnue', public: 'Directeur technique' }, TIV)).toBe(false);
    expect(videoPermise({ id: 'M-inconnue', public: 'Moniteur' }, MONITEUR)).toBe(true);
    expect(videoPermise({ id: 'M-inconnue', public: 'Moniteur' }, ELEVE)).toBe(false);
  });

  it('« Comment faire ? » ne montre pas un manuel hors des droits', () => {
    const ids = manuelsDeLEcran('/materiel/12', TIV).map(m => m.id);
    expect(ids).toContain('inspection-tiv');
    expect(ids).not.toContain('mise-au-rebut');
  });
});
