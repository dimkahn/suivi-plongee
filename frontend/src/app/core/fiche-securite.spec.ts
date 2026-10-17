import { PalanqueeVue, PlongeurVue } from './modeles';
import { aDesDetails, empreinteFiche, palanqueesAEnregistrer, resumePalanquee } from './fiche-securite';

function plongeur(champs: Partial<PlongeurVue> = {}): PlongeurVue {
  return {
    eleveId: null, utilisateurId: null, nom: 'MARTIN', prenom: 'Léa', aptitude: 'N1', aptitudeDonneeParDp: null,
    qualificationPreparee: null, fonction: 'PLONGEUR', gaz: null, moyenDesaturation: null, observations: null,
    ...champs
  };
}

function palanquee(champs: Partial<PalanqueeVue> = {}): PalanqueeVue {
  return {
    numero: 1, profondeurPrevue: null, dureePrevue: null, profondeurRealisee: null, dureeRealisee: null,
    paliers: null, heureImmersion: null, heureSortie: null, membres: [], ...champs
  };
}

describe('Détails d\'un plongeur sur la fiche de sécurité', () => {
  it('Un plongeur sans gaz, désaturation, observations ni qualification n\'a pas de détails à montrer', () => {
    expect(aDesDetails(plongeur())).toBe(false);
    expect(aDesDetails(plongeur({ gaz: '  ' }))).toBe(false);
  });

  it('Un détail renseigné reste visible, pour ne jamais cacher ce qui est saisi', () => {
    expect(aDesDetails(plongeur({ gaz: 'Nitrox 32' }))).toBe(true);
    expect(aDesDetails(plongeur({ qualificationPreparee: 'N2' }))).toBe(true);
    expect(aDesDetails(plongeur({ aptitudeDonneeParDp: 'PE40' }))).toBe(true);
    expect(aDesDetails(plongeur({ moyenDesaturation: 'Ordinateur' }))).toBe(true);
    expect(aDesDetails(plongeur({ observations: 'Oreilles' }))).toBe(true);
  });
});

describe('Modifications non enregistrées d\'une fiche de sécurité', () => {
  const entete = { dpId: 3, meteo: null, observations: null };

  it('Une fiche relue sans changement n\'est pas modifiée', () => {
    const avant = empreinteFiche(entete, [palanquee({ membres: [plongeur()] })]);
    expect(empreinteFiche({ ...entete }, [palanquee({ membres: [plongeur()] })])).toBe(avant);
  });

  it('Effacer un champ qu\'on vient de remplir ne compte pas comme une modification', () => {
    const avant = empreinteFiche(entete, [palanquee({ membres: [plongeur()] })]);
    expect(empreinteFiche({ ...entete, meteo: '' }, [palanquee({ membres: [plongeur({ gaz: ' ' })] })])).toBe(avant);
  });

  it('Un plongeur ajouté ou une profondeur changée rend la fiche modifiée', () => {
    const avant = empreinteFiche(entete, [palanquee({ membres: [plongeur()] })]);
    expect(empreinteFiche(entete, [palanquee({ membres: [plongeur(), plongeur({ prenom: 'Bruno' })] })])).not.toBe(avant);
    expect(empreinteFiche(entete, [palanquee({ profondeurPrevue: 20, membres: [plongeur()] })])).not.toBe(avant);
    expect(empreinteFiche({ ...entete, dpId: 4 }, [palanquee({ membres: [plongeur()] })])).not.toBe(avant);
  });
});

describe('Palanquées à enregistrer', () => {
  it('Une ligne de plongeur ajoutée puis laissée vide est ignorée, sans bloquer l\'enregistrement', () => {
    const vide = plongeur({ nom: '', prenom: ' ', aptitude: null });
    const resultat = palanqueesAEnregistrer([palanquee({ membres: [plongeur(), vide] })]);
    expect(resultat.erreur).toBeNull();
    expect(resultat.palanquees[0].membres).toEqual([plongeur()]);
  });

  it('Un plongeur sans nom ou sans prénom est signalé avec sa palanquée', () => {
    const resultat = palanqueesAEnregistrer([
      palanquee({ membres: [plongeur()] }),
      palanquee({ numero: 2, membres: [plongeur({ nom: '', aptitude: 'N2' })] })
    ]);
    expect(resultat.erreur).toBe('Palanquée 2 : Léa n\'a pas de nom. Complétez-le ou retirez la ligne (✕).');
  });

  it('Un plongeur sans prénom ni nom mais avec une aptitude est signalé', () => {
    const resultat = palanqueesAEnregistrer([palanquee({ membres: [plongeur({ nom: '', prenom: '', aptitude: 'N2' })] })]);
    expect(resultat.erreur).toBe('Palanquée 1 : un plongeur n\'a ni nom ni prénom. Complétez-le ou retirez la ligne (✕).');
  });
});

describe('Résumé d\'une palanquée', () => {
  it('Nombre de plongeurs, profondeur et durée prévues', () => {
    expect(resumePalanquee(palanquee({ profondeurPrevue: 20, dureePrevue: 40, membres: [plongeur(), plongeur()] })))
      .toBe('2 plongeurs · 20 m · 40 min');
  });

  it('Une palanquée vide le dit, sans profil inconnu', () => {
    expect(resumePalanquee(palanquee())).toBe('aucun plongeur');
    expect(resumePalanquee(palanquee({ membres: [plongeur()] }))).toBe('1 plongeur');
  });

  it('Une ligne sans nom ni prénom ne compte pas comme un plongeur', () => {
    expect(resumePalanquee(palanquee({ membres: [plongeur(), plongeur({ nom: '', prenom: '' })] }))).toBe('1 plongeur');
  });
});
