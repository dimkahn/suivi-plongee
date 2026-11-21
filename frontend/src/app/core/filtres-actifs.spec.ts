import { nombreFiltresActifs } from './filtres-actifs';

describe('« Filtres (n) » : combien de filtres sont actifs', () => {
  it('Tous à leur valeur par défaut : aucun', () => {
    expect(nombreFiltresActifs([null, 'TOUS', 'TOUS'], [null, 'TOUS', 'TOUS'])).toBe(0);
  });

  it('Compte ceux qui en diffèrent, un groupe choisi comme un « KO »', () => {
    expect(nombreFiltresActifs([12, 'TOUS', 'KO'], [null, 'TOUS', 'TOUS'])).toBe(2);
  });
});
