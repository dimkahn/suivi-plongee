import { PalanqueeVue, PlongeurVue } from './modeles';
import {
  aDesDetails, deplacerPlongeur, empreinteFiche, erreurProfilPrevu, estEncadrantPossible, libelleMembre, ligneVide, nomPalanquee,
  alerteMod, fractionOxygene, libelleGaz, profondeurMaximaleUtilisation, palanqueesAEnregistrer,
  profondeurPermise, questionsAjout, refusAjout, reprendrePalanquees, resumePalanquee,
  peutSignerFiche, peutSignerDepuisLaListe, signatureAVenir, libelleSignature, alerteIntegrite
} from './fiche-securite';

function plongeur(champs: Partial<PlongeurVue> = {}): PlongeurVue {
  return {
    eleveId: null, utilisateurId: null, nom: 'MARTIN', prenom: 'Léa', aptitude: 'N1', aptitudeDonneeParDp: null,
    qualificationPreparee: null, fonction: 'PLONGEUR', gaz: null, ppo2Max: null, moyenDesaturation: null, observations: null,
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
    expect(resultat.erreur).toBe('Palanquée 2 : Léa n\'a pas de nom. Touchez sa ligne pour le compléter ou le retirer.');
  });

  it('Un plongeur sans prénom ni nom mais avec une aptitude est signalé', () => {
    const resultat = palanqueesAEnregistrer([palanquee({ membres: [plongeur({ nom: '', prenom: '', aptitude: 'N2' })] })]);
    expect(resultat.erreur).toBe('Palanquée 1 : un plongeur n\'a ni nom ni prénom. Touchez sa ligne pour le compléter ou le retirer.');
  });
});

describe('Profondeur maximale d\'utilisation (MOD) d\'un mélange', () => {
  it('La fraction d\'oxygène se lit dans le gaz saisi : nitrox, EAN, trimix, oxygène pur', () => {
    expect(fractionOxygene('Nitrox 32')).toBe(0.32);
    expect(fractionOxygene('EAN36')).toBe(0.36);
    expect(fractionOxygene('NX 40 %')).toBe(0.4);
    expect(fractionOxygene('Trimix 18/45')).toBe(0.18);
    expect(fractionOxygene('Oxygène')).toBe(1);
    expect(fractionOxygene('O2 pur')).toBe(1);
  });

  it('L\'air, un gaz vide ou illisible n\'a pas de MOD à calculer', () => {
    expect(fractionOxygene('Air')).toBeNull();
    expect(fractionOxygene('air')).toBeNull();
    expect(fractionOxygene(null)).toBeNull();
    expect(fractionOxygene('  ')).toBeNull();
    expect(fractionOxygene('Mélange du club')).toBeNull();
    expect(fractionOxygene('Nitrox 150')).toBeNull();
  });

  it('MOD = (ppO2 max ÷ fraction d\'oxygène − 1) × 10, arrondie au mètre inférieur', () => {
    expect(profondeurMaximaleUtilisation('Nitrox 32', 1.4)).toBe(33);
    expect(profondeurMaximaleUtilisation('Nitrox 32', 1.6)).toBe(40);
    expect(profondeurMaximaleUtilisation('Nitrox 35', 1.4)).toBe(30);
    expect(profondeurMaximaleUtilisation('Nitrox 40', 1.5)).toBe(27);
    expect(profondeurMaximaleUtilisation('Oxygène', 1.6)).toBe(6);
  });

  it('Sans ppO2 choisie, la MOD se calcule à 1,4 bar', () => {
    expect(profondeurMaximaleUtilisation('Nitrox 32', null)).toBe(33);
  });

  it('À l\'air, pas de MOD', () => {
    expect(profondeurMaximaleUtilisation('Air', 1.6)).toBeNull();
  });

  it('Le gaz se résume avec sa MOD et sa ppO2', () => {
    expect(libelleGaz(plongeur({ gaz: 'Nitrox 32', ppo2Max: 1.6 }))).toBe('Nitrox 32 · MOD 40 m (ppO2 1,6)');
    expect(libelleGaz(plongeur({ gaz: 'Nitrox 32' }))).toBe('Nitrox 32 · MOD 33 m (ppO2 1,4)');
    expect(libelleGaz(plongeur({ gaz: 'Air' }))).toBeNull();
  });

  it('Une palanquée prévue plus profond que la MOD d\'un plongeur est signalée', () => {
    const p = palanquee({ profondeurPrevue: 40 });
    expect(alerteMod(p, plongeur({ gaz: 'Nitrox 32', ppo2Max: 1.4 })))
      .toBe('Nitrox 32 : MOD 33 m à ppO2 1,4, palanquée prévue à 40 m.');
    expect(alerteMod(p, plongeur({ gaz: 'Nitrox 32', ppo2Max: 1.6 }))).toBeNull();
    expect(alerteMod(palanquee(), plongeur({ gaz: 'Nitrox 40' }))).toBeNull();
    expect(alerteMod(p, plongeur({ gaz: 'Air' }))).toBeNull();
  });
});

describe('Plongeur ajouté puis laissé sans rien saisir', () => {
  it('Fermer sa fenêtre sans rien saisir le retire : c\'est une ligne vide', () => {
    expect(ligneVide(plongeur({ nom: '', prenom: ' ', aptitude: null }))).toBe(true);
  });

  it('Un plongeur dont un champ est rempli, ou dont le dossier est choisi, reste', () => {
    expect(ligneVide(plongeur({ nom: '', prenom: '', aptitude: 'N2' }))).toBe(false);
    expect(ligneVide(plongeur({ nom: '', prenom: '', aptitude: null, gaz: 'Air' }))).toBe(false);
    expect(ligneVide(plongeur({ nom: '', prenom: '', aptitude: null, eleveId: 4 }))).toBe(false);
  });
});

describe('Déplacer un plongeur d\'une palanquée à une autre', () => {
  const lea = plongeur({ prenom: 'Léa' });
  const bruno = plongeur({ prenom: 'Bruno' });
  const flora = plongeur({ prenom: 'Flora', fonction: 'ENCADRANT' });

  it('Le plongeur quitte sa palanquée et arrive en dernier dans l\'autre, avec tout ce qui est saisi', () => {
    const avant = [palanquee({ membres: [lea, bruno] }), palanquee({ numero: 2, membres: [flora] })];
    const apres = deplacerPlongeur(avant, 0, 1, 1);
    expect(apres[0].membres).toEqual([lea]);
    expect(apres[1].membres).toEqual([flora, bruno]);
  });

  it('Sans palanquée de destination, il part dans une nouvelle palanquée, au numéro suivant', () => {
    const avant = [palanquee({ membres: [lea] }), palanquee({ numero: 3, membres: [flora, bruno] })];
    const apres = deplacerPlongeur(avant, 1, 1, null);
    expect(apres).toHaveLength(3);
    expect(apres[1].membres).toEqual([flora]);
    expect(apres[2].numero).toBe(4);
    expect(apres[2].membres).toEqual([bruno]);
  });

  it('La palanquée vidée reste en place, avec son profil prévu', () => {
    const avant = [palanquee({ profondeurPrevue: 20, membres: [lea] }), palanquee({ numero: 2 })];
    const apres = deplacerPlongeur(avant, 0, 0, 1);
    expect(apres[0]).toEqual(palanquee({ profondeurPrevue: 20 }));
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

describe('Reprendre des palanquées d\'une autre séance', () => {
  it('Les palanquées reprises s\'ajoutent à la suite, avec leurs plongeurs et leur profil prévu', () => {
    const actuelles = [palanquee({ numero: 1, membres: [plongeur({ nom: 'DURAND' })] })];
    const reprise = palanquee({
      numero: 4, profondeurPrevue: 20, dureePrevue: 40,
      membres: [
        plongeur({ eleveId: 7, aptitude: 'PE40', gaz: 'Nitrox 32' }),
        plongeur({ prenom: 'Paul', fonction: 'GUIDE_PALANQUEE' })
      ]
    });
    const resultat = reprendrePalanquees(actuelles, [reprise]);
    expect(resultat.map(p => p.numero)).toEqual([1, 2]);
    expect(resultat[1]).toMatchObject({ profondeurPrevue: 20, dureePrevue: 40 });
    expect(resultat[1].membres.map(m => m.prenom)).toEqual(['Léa', 'Paul']);
    expect(resultat[1].membres[0]).toMatchObject({ eleveId: 7, aptitude: 'PE40', gaz: 'Nitrox 32' });
    expect(resultat[1].membres[1].fonction).toBe('GUIDE_PALANQUEE');
  });

  it('Ce qui a été plongé ce jour-là ne se reprend pas : profil réalisé et observations restent vides', () => {
    const reprise = palanquee({
      profondeurRealisee: 18, dureeRealisee: 38, paliers: '3 min à 3 m', heureImmersion: '10:05', heureSortie: '10:43',
      membres: [plongeur({ observations: 'Remontée rapide' })]
    });
    const [copie] = reprendrePalanquees([], [reprise]);
    expect(copie).toMatchObject({
      profondeurRealisee: null, dureeRealisee: null, paliers: null, heureImmersion: null, heureSortie: null
    });
    expect(copie.membres[0].observations).toBeNull();
  });

  it('La palanquée vide d\'une fiche neuve laisse sa place aux palanquées reprises', () => {
    const resultat = reprendrePalanquees([palanquee({ numero: 1 })], [palanquee({ numero: 3, membres: [plongeur()] })]);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].numero).toBe(1);
    expect(resultat[0].membres).toHaveLength(1);
  });

  it('Modifier la copie ne touche pas la fiche d\'origine', () => {
    const reprise = palanquee({ membres: [plongeur()] });
    const [copie] = reprendrePalanquees([], [reprise]);
    copie.membres[0].nom = 'AUTRE';
    expect(reprise.membres[0].nom).toBe('MARTIN');
  });
});

describe('Profondeur permise par l\'aptitude d\'un plongeur', () => {
  it('Reprend les prérogatives FFESSM : la plus étendue, encadrée ou autonome', () => {
    expect(profondeurPermise({ aptitude: 'N1', qualificationPreparee: null })).toBe(20);
    expect(profondeurPermise({ aptitude: 'N2', qualificationPreparee: null })).toBe(40);
    expect(profondeurPermise({ aptitude: 'PE40 PA20', qualificationPreparee: null })).toBe(40);
    expect(profondeurPermise({ aptitude: 'PE12', qualificationPreparee: null })).toBe(12);
    expect(profondeurPermise({ aptitude: 'N3', qualificationPreparee: null })).toBe(60);
    expect(profondeurPermise({ aptitude: 'E1 · N4', qualificationPreparee: null })).toBe(60);
  });

  it('Un élève en formation descend à la profondeur du niveau qu\'il prépare', () => {
    expect(profondeurPermise({ aptitude: 'N1', qualificationPreparee: 'N2' })).toBe(40);
  });

  it('Une aptitude non reconnue ne permet rien de deviner', () => {
    expect(profondeurPermise({ aptitude: 'Baptême', qualificationPreparee: null })).toBeNull();
    expect(profondeurPermise({ aptitude: null, qualificationPreparee: null })).toBeNull();
  });
});

describe('Refuser un plongeur dont l\'aptitude ne permet pas la profondeur prévue', () => {
  it('Un N1 ne s\'ajoute pas à une palanquée prévue à 30 m', () => {
    expect(refusAjout(palanquee({ numero: 2, profondeurPrevue: 30 }), plongeur({ aptitude: 'N1' })))
      .toBe('Ajout refusé : Léa MARTIN (N1) a une aptitude limitée à 20 m, la palanquée 2 est prévue à 30 m.');
  });

  it('Il s\'ajoute à une palanquée prévue dans ses prérogatives', () => {
    expect(refusAjout(palanquee({ profondeurPrevue: 20 }), plongeur({ aptitude: 'N1' }))).toBeNull();
  });

  it('Sans profondeur prévue, ou sans aptitude reconnue, rien n\'est refusé', () => {
    expect(refusAjout(palanquee({ profondeurPrevue: null }), plongeur({ aptitude: 'N1' }))).toBeNull();
    expect(refusAjout(palanquee({ profondeurPrevue: 40 }), plongeur({ aptitude: null }))).toBeNull();
  });
});

describe('Palanquée : ce qui est renseigné, en une ligne par plongeur', () => {
  it('Nom, aptitude et fonction quand elle n\'est pas « Plongeur »', () => {
    expect(libelleMembre(plongeur({ prenom: 'Flora', nom: 'VASSEUR', aptitude: 'E2', fonction: 'ENCADRANT' })))
      .toBe('Flora VASSEUR · E2 · Encadrant');
    expect(libelleMembre(plongeur({ fonction: 'GUIDE_PALANQUEE', aptitude: 'N4' })))
      .toBe('Léa MARTIN · N4 · Guide de palanquée');
    expect(libelleMembre(plongeur({ aptitude: 'N1' }))).toBe('Léa MARTIN · N1');
  });

  it('Un plongeur sans aptitude ni nom reste repérable', () => {
    expect(libelleMembre(plongeur({ aptitude: null }))).toBe('Léa MARTIN');
    expect(libelleMembre(plongeur({ prenom: '', nom: ' ', aptitude: null }))).toBe('Plongeur sans nom');
  });
});

describe('Nom d\'une palanquée sur la fiche', () => {
  it('Une palanquée porte le nom de son encadrant', () => {
    const p = palanquee({ numero: 3, membres: [
      plongeur(), plongeur({ prenom: 'Flora', nom: 'DUPONT', fonction: 'ENCADRANT' })
    ] });
    expect(nomPalanquee(p)).toBe('Palanquée de Flora DUPONT');
  });

  it('À défaut d\'encadrant, celui de son guide de palanquée', () => {
    const p = palanquee({ membres: [plongeur({ prenom: 'Hugo', nom: 'BLANC', fonction: 'GUIDE_PALANQUEE' })] });
    expect(nomPalanquee(p)).toBe('Palanquée de Hugo BLANC');
  });

  it('Sans encadrant ni guide (autonomes, palanquée neuve), elle garde son numéro', () => {
    expect(nomPalanquee(palanquee({ numero: 2, membres: [plongeur()] }))).toBe('Palanquée 2');
    expect(nomPalanquee(palanquee({ numero: 4, membres: [plongeur({ prenom: ' ', nom: '', fonction: 'ENCADRANT' })] })))
      .toBe('Palanquée 4');
  });

  it('Le refus d\'un plongeur nomme la palanquée par son encadrant', () => {
    const p = palanquee({ profondeurPrevue: 30, membres: [plongeur({ prenom: 'Flora', nom: 'DUPONT', fonction: 'ENCADRANT' })] });
    expect(refusAjout(p, plongeur({ aptitude: 'N1' })))
      .toBe('Ajout refusé : Léa MARTIN (N1) a une aptitude limitée à 20 m, la palanquée de Flora DUPONT est prévue à 30 m.');
  });
});

describe('Nouvelle palanquée : profondeur et durée prévues demandées', () => {
  it('Les deux sont obligatoires et positives', () => {
    expect(erreurProfilPrevu(null, 40)).toBe('Indiquez la profondeur prévue.');
    expect(erreurProfilPrevu(20, null)).toBe('Indiquez la durée prévue.');
    expect(erreurProfilPrevu(0, 40)).toBe('Indiquez la profondeur prévue.');
    expect(erreurProfilPrevu(20, 40)).toBeNull();
  });

  it('Un plongeur déplacé vers une nouvelle palanquée y arrive avec le profil prévu saisi', () => {
    const liste = [palanquee({ numero: 1, membres: [plongeur()] })];
    const resultat = deplacerPlongeur(liste, 0, 0, null, { profondeurPrevue: 12, dureePrevue: 35 });
    expect(resultat[1]).toMatchObject({ numero: 2, profondeurPrevue: 12, dureePrevue: 35 });
  });
});

describe('Demander la fonction d\'un encadrant ajouté à une palanquée', () => {
  it('Un moniteur du club (compte encadrant) est un encadrant possible', () => {
    expect(estEncadrantPossible({ utilisateurId: 12, aptitude: 'N2' })).toBe(true);
  });

  it('Une aptitude d\'encadrant (E1 à E4, MF1/MF2, GP, N4, N5) le désigne aussi', () => {
    for (const aptitude of ['E2', 'N3 E1', 'MF1', 'GP', 'N4', 'N5']) {
      expect(estEncadrantPossible({ utilisateurId: null, aptitude })).toBe(true);
    }
  });

  it('Un plongeur sans compte encadrant ni aptitude d\'encadrant n\'est pas concerné', () => {
    for (const aptitude of ['N1', 'N2', 'PE40', 'PA40', 'N3', null]) {
      expect(estEncadrantPossible({ utilisateurId: null, aptitude })).toBe(false);
    }
  });
});

describe('Une seule fenêtre pour une nouvelle palanquée et la fonction d\'un encadrant', () => {
  const encadrant = plongeur({ prenom: 'Flora', nom: 'VASSEUR', aptitude: 'E2', utilisateurId: 4 });

  it('Une palanquée vide ne demande que son profil prévu', () => {
    expect(questionsAjout(true, null)).toEqual({ profil: true, fonction: false });
  });

  it('Un plongeur placé dans une nouvelle palanquée : le profil, et sa fonction s\'il peut encadrer', () => {
    expect(questionsAjout(true, plongeur())).toEqual({ profil: true, fonction: false });
    expect(questionsAjout(true, encadrant)).toEqual({ profil: true, fonction: true });
  });

  it('Un encadrant ajouté à une palanquée existante : seulement sa fonction', () => {
    expect(questionsAjout(false, encadrant)).toEqual({ profil: false, fonction: true });
    expect(questionsAjout(false, plongeur())).toEqual({ profil: false, fonction: false });
  });

  it('Une fonction déjà choisie ne se redemande pas', () => {
    expect(questionsAjout(false, { ...encadrant, fonction: 'GUIDE_PALANQUEE' })).toEqual({ profil: false, fonction: false });
    expect(questionsAjout(true, { ...encadrant, fonction: 'ENCADRANT' })).toEqual({ profil: true, fonction: false });
  });
});

describe('Signature de la fiche par le DP', () => {
  const fiche = { id: 4, dpId: 12, signature: null };
  const signature = { signataireId: 12, signataire: 'Gwendoline Marchand', signeeLe: '2026-06-08T16:30:00Z', integre: true };

  it('Le DP signe sa fiche enregistrée, le jour de la plongée ou après', () => {
    expect(peutSignerFiche(fiche, 12, '2026-06-08', '2026-06-08')).toBe(true);
    expect(peutSignerFiche(fiche, 12, '2026-06-08', '2026-10-20')).toBe(true);
  });

  it('Ni un autre moniteur, ni avant la plongée, ni une fiche pas encore enregistrée', () => {
    expect(peutSignerFiche(fiche, 7, '2026-06-08', '2026-10-20')).toBe(false);
    expect(peutSignerFiche(fiche, undefined, '2026-06-08', '2026-10-20')).toBe(false);
    expect(peutSignerFiche(fiche, 12, '2026-11-02', '2026-10-20')).toBe(false);
    expect(peutSignerFiche({ ...fiche, id: null }, 12, '2026-06-08', '2026-10-20')).toBe(false);
  });

  it('Une fiche déjà signée ne se signe pas deux fois', () => {
    expect(peutSignerFiche({ ...fiche, signature }, 12, '2026-06-08', '2026-10-20')).toBe(false);
  });

  it('Le bandeau dit qui a signé et quand, et alerte si la fiche a été modifiée depuis', () => {
    expect(libelleSignature(signature)).toMatch(/^Signée par Gwendoline Marchand le 08\/06\/2026 à \d\d:30$/);
    expect(alerteIntegrite(signature)).toBeNull();
    expect(alerteIntegrite({ ...signature, integre: false })).toContain('modifiée après sa signature');
  });
});

describe('La fiche dans la liste des fiches de sécurité', () => {
  const seance = { date: '2026-06-08', ficheSecurite: true, ficheSignee: false, ficheDpId: 12 };

  it('Le lien « Signer la fiche » ne s\'offre qu\'à son DP, une fois la plongée passée', () => {
    expect(peutSignerDepuisLaListe(seance, 12, '2026-06-08')).toBe(true);
    expect(peutSignerDepuisLaListe(seance, 7, '2026-06-08')).toBe(false);
    expect(peutSignerDepuisLaListe(seance, 12, '2026-06-07')).toBe(false);
  });

  it('Ni sans fiche enregistrée, ni sur une fiche déjà signée', () => {
    expect(peutSignerDepuisLaListe({ ...seance, ficheSecurite: false }, 12, '2026-06-08')).toBe(false);
    expect(peutSignerDepuisLaListe({ ...seance, ficheSignee: true }, 12, '2026-06-08')).toBe(false);
  });

  it('Avant la plongée, son DP est prévenu qu\'il signera la fiche à partir du jour de la plongée', () => {
    expect(signatureAVenir(seance, 12, '2026-06-07')).toBe(true);
    expect(signatureAVenir(seance, 12, '2026-06-08')).toBe(false);
    expect(signatureAVenir(seance, 7, '2026-06-07')).toBe(false);
    expect(signatureAVenir({ ...seance, ficheSecurite: false }, 12, '2026-06-07')).toBe(false);
    expect(signatureAVenir({ ...seance, ficheSignee: true }, 12, '2026-06-07')).toBe(false);
  });
});
