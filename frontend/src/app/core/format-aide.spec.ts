import { formatParDefaut, fichiersVideo } from './format-aide';
import { Video } from '../features/videos/catalogue';

describe('Aide au format téléphone ou ordinateur', () => {
  it('Par défaut, le format de l\'appareil : téléphone sous 860 px (la barre d\'onglets), ordinateur au-delà', () => {
    expect(formatParDefaut(412)).toBe('telephone');
    expect(formatParDefaut(860)).toBe('telephone');
    expect(formatParDefaut(1280)).toBe('ordinateur');
  });

  const video = (formats: Video['formats']): Video => ({
    id: 'M6', titre: 'Valider', public: 'Moniteur', resume: '', format: 'telephone',
    webm: 'M06.telephone.webm', mp4: null, vignette: null, duree: 60, formats
  });
  const fichiers = (nom: string) => ({ webm: `${nom}.webm`, mp4: `${nom}.mp4`, vignette: null, duree: 60, version: 'a' });

  it('La vidéo du format choisi, s\'il est tourné', () => {
    const v = video({ telephone: fichiers('M06.telephone'), ordinateur: fichiers('M06.ordinateur') });
    expect(fichiersVideo(v, 'ordinateur')).toEqual({ format: 'ordinateur', ...fichiers('M06.ordinateur') });
  });

  it('Sinon celle de l\'autre format, signalée comme telle', () => {
    const v = video({ telephone: fichiers('M06.telephone'), ordinateur: null });
    expect(fichiersVideo(v, 'ordinateur')?.format).toBe('telephone');
  });

  it('Un catalogue d\'avant les deux formats : sa vidéo unique, dans son format', () => {
    const ancien: Video = {
      id: 'A16', titre: 'Base', public: 'Administrateur', resume: '', format: 'ordinateur',
      webm: 'A16.webm', mp4: 'A16.mp4', vignette: 'A16.jpg', duree: 40, version: 'b'
    };
    expect(fichiersVideo(ancien, 'telephone')).toEqual({
      format: 'ordinateur', webm: 'A16.webm', mp4: 'A16.mp4', vignette: 'A16.jpg', duree: 40, version: 'b',
      texte: undefined, voix: undefined
    });
  });

  it('Une vidéo pas encore tournée : rien à montrer', () => {
    expect(fichiersVideo(video({ telephone: null, ordinateur: null }), 'telephone')).toBeNull();
  });
});
