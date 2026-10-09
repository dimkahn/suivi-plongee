-- ============================================================
--  Base d'exercices du N2 (MFT PA20 | PE40, mai 2026) : 11
--  competences, 9 exercices chacune (3 d'initiation, 3 de
--  perfectionnement, 3 de maitrise), soit 99 exercices.
--
--  Numeros N.1 a N.9 dans l'ordre des pages du MFT, qui est aussi
--  l'ordre des blocs de V8 (1 a 3 communes, 4 a 7 PA20, 8 a 11
--  PE40). Les blocs 12 et 13 (connaissances theoriques PA20 et
--  PE40, transverses) n'ont pas d'exercice propre.
--
--  Le N2 s'obtient en milieu naturel (referentiel
--  milieu_naturel_exclusif) : une note prise en piscine ou en fosse
--  n'est qu'un suivi d'entrainement, meme sur un exercice de maitrise
--  (EvaluationService.estEntrainement). D'ou des exercices de
--  maitrise tous decrits en milieu naturel ; l'initiation et le
--  perfectionnement peuvent se travailler en fosse.
--
--  Chaque exercice est relie aux criteres qu'il travaille (seconde
--  requete, criteres designes par leur ordre dans le bloc de V8) ;
--  chaque critere a au moins un exercice de maitrise.
--
--  Ensuite, la base se modifie depuis l'ecran /admin/exercices :
--  ne pas retoucher ce fichier une fois applique.
-- ============================================================

INSERT INTO exercice_competence (bloc_id, numero, ordre, phase, intitule, deroulement, critere_reussite)
SELECT b.id, v.numero, v.ordre, v.phase, v.intitule, v.deroulement, v.critere_reussite
  FROM bloc_competence b
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN (VALUES
    -- ---------- Competence 1 : S'equiper et se desequiper - Se mettre a l'eau et en sortir (commune) ----------
    (1, '1.1', 1, 'INITIATION', 'Choisir et gréer son matériel',
     'Au bord. Pour une plongée annoncée (profondeur, durée, température de l''eau), l''élève choisit son matériel : combinaison, lest, bloc, détendeur avec octopus, ordinateur, parachute de palanquée. Il grée seul, le moniteur contrôle. Dégréage, rinçage et désinfection de l''embout.',
     'Choix justifié, montage sans erreur.'),
    (1, '1.2', 2, 'INITIATION', 'Capelage et réglages en surface',
     'Au sec puis en surface. Capelage, réglage des sangles et du lest, essai de l''inflateur et des purges. Vérification croisée avec l''équipier : air ouvert, gilet, lest, octopus, ordinateur.',
     'Réglages corrects, vérification croisée complète.'),
    (1, '1.3', 3, 'INITIATION', 'Mises à l''eau et sortie par l''échelle',
     'Fosse, piscine ou bord abrité. Saut droit et bascule arrière, gilet légèrement gonflé, une main sur masque et détendeur. Sortie à l''échelle : palmes retirées dans l''eau, détendeur en bouche, une main sur l''échelle.',
     'Zone vérifiée, signe OK en surface, sortie sans précipitation.'),
    (1, '1.4', 4, 'PERFECTIONNEMENT', 'S''équiper en temps limité',
     'Simulation de bateau ou bord de quai, consignes du DP données. La palanquée s''équipe dans le temps imparti ; chacun vérifie aussi l''équipement de son équipier.',
     'Prêt à l''heure, aucun oubli, équipier vérifié.'),
    (1, '1.5', 5, 'PERFECTIONNEMENT', 'Décapelage et recapelage dans l''eau',
     'Grand fond ou pleine eau, gilet gonflé, détendeur en bouche. Décapelage, bloc passé au bateau ou à un équipier, récupéré, recapelage et serrage des sangles.',
     'Sans aide, calme, une main toujours sur le gilet.'),
    (1, '1.6', 6, 'PERFECTIONNEMENT', 'Mise à l''eau d''une embarcation',
     'Milieu naturel, depuis le bateau. Bascule arrière au signal du DP, saut droit depuis une plateforme, regroupement en surface. Remontée à l''échelle avec un peu de houle, sans lâcher l''échelle.',
     'Mise à l''eau au signal, palanquée regroupée aussitôt.'),
    (1, '1.7', 7, 'MAITRISE', 'Autonome du gréage à la sortie',
     'Milieu naturel. Sur une plongée réelle, l''élève choisit et grée son matériel, s''équipe, contrôle son équipier, se met à l''eau selon le site, puis se déséquipe et range. Le moniteur observe sans intervenir.',
     'Autonome du début à la fin, sans erreur.'),
    (1, '1.8', 8, 'MAITRISE', 'Anomalie sur le matériel de la palanquée',
     'Milieu naturel, avant la mise à l''eau. Le moniteur a glissé une anomalie dans le matériel de l''élève ou de son équipier : robinet entrouvert, inflateur débranché, sangle mal fermée.',
     'Anomalie trouvée et corrigée avant la mise à l''eau.'),
    (1, '1.9', 9, 'MAITRISE', 'Mises à l''eau et sorties en milieux variés',
     'Milieu naturel, sur au moins deux sites différents (bord, embarcation, plage ou carrière). Mise à l''eau et sortie choisies selon le lieu et les conditions, avec le souci de toute la palanquée.',
     'Technique adaptée au lieu, réalisée avec aisance.'),

    -- ---------- Competence 2 : S'immerger - Se propulser - Se ventiler (commune) ----------
    (2, '2.1', 1, 'INITIATION', 'Canard et phoque en palanquée',
     'Fosse, piscine ou petit fond. Au signal, immersion de toute la palanquée : phoque en vidant le gilet, puis canard capelé. Regroupement au fond.',
     'Immersion sans palmer en surface, palanquée groupée.'),
    (2, '2.2', 2, 'INITIATION', 'Palmages de surface',
     'Piscine ou plan d''eau calme. Palmage ventral, dorsal et costal, en PMT puis capelé ; 100 à 200 m à allure régulière, sans chronomètre.',
     'Palmage ample et régulier, ventilation calme.'),
    (2, '2.3', 3, 'INITIATION', 'REC guidée sur 5 à 6 m',
     'Fosse ou petit fond, le long d''un bout, moniteur face à l''élève. Départ du fond stabilisé, inspiration normale, remontée en expiration, embout en bouche.',
     'Expiration continue jusqu''en surface, sans précipitation.'),
    (2, '2.4', 4, 'PERFECTIONNEMENT', 'Descente et remontée contrôlées',
     'Pleine eau sans repère, jusqu''à 20 m. Descente au gilet et au poumon ballast, arrêt sur demande à une profondeur annoncée, remontée jusqu''au palier de 3 m.',
     'Arrêts tenus à ± 1 m, vitesse régulière.'),
    (2, '2.5', 5, 'PERFECTIONNEMENT', 'Palmage économique en immersion',
     'Milieu naturel ou fosse, 10 à 20 m. Palmage lent et ample sur un parcours, puis contre un léger courant ; l''élève règle son allure sur sa ventilation.',
     'Pas d''essoufflement, palanquée gardée groupée.'),
    (2, '2.6', 6, 'PERFECTIONNEMENT', 'REC depuis 10 m le long d''un bout',
     'Le long d''un bout, moniteur en face. Départ du fond stabilisé à 10 m, inspiration normale, remontée en expiration. En fosse, la note va au suivi d''entraînement.',
     'Rejet d''air tout au long, vitesse correcte.'),
    (2, '2.7', 7, 'MAITRISE', 'Immersion et descente sur consigne du GP',
     'Milieu naturel. Le GP annonce la technique (canard ou phoque, au mouillage ou en pleine eau). La palanquée s''immerge ensemble, descend équilibrée au gilet et au poumon ballast jusqu''au fond, puis remonte au palier.',
     'Technique demandée, rapide, cohésion gardée, immersion tenue sans difficulté.'),
    (2, '2.8', 8, 'MAITRISE', 'Nages de surface : 250 m PMT, 100 m capelé',
     'Milieu naturel. 250 m environ en PMT, puis 100 m environ capelé. Pas de chronomètre.',
     'Parcours terminé en bonnes conditions physiques, gestes efficaces.'),
    (2, '2.9', 9, 'MAITRISE', 'REC sur 10 m',
     'Milieu naturel. Départ du fond stabilisé, sur une inspiration normale, remontée en expiration, embout en bouche, sur un trajet vertical de 10 m au plus. Aucun critère de temps.',
     'Sans stress, rejet d''air continu, vitesse de remontée correcte.'),

    -- ---------- Competence 3 : Respecter le milieu et l'environnement (commune) ----------
    (3, '3.1', 1, 'INITIATION', 'Stabilisation sans appui',
     'Fosse ou petit fond. Au-dessus d''un fond fragile simulé (sable, cerceau posé), l''élève se stabilise sans toucher, palmes immobiles, puis repart en palmage de grenouille.',
     'Aucun contact avec le fond.'),
    (3, '3.2', 2, 'INITIATION', 'Palmer sans soulever le sable',
     'Fosse ou petit fond sableux. Palmage de grenouille et recul, palmes hautes, à 1 m du fond.',
     'Aucun nuage de sédiment derrière l''élève.'),
    (3, '3.3', 3, 'INITIATION', 'Charte et espèces du site',
     'Au sec. Présentation de la Charte internationale du plongeur responsable et des espèces courantes du site (fiches, photos). Règles : ne pas toucher, pas de nourrissage, éclairage limité, discrétion.',
     'Cite les règles de la charte et reconnaît 5 espèces.'),
    (3, '3.4', 4, 'PERFECTIONNEMENT', 'Évoluer près d''une paroi ou d''une épave',
     'Milieu naturel, 10 à 20 m. Évolution à 1 m d''un tombant, d''un herbier ou d''une épave, sans contact, en restant équilibré.',
     'Aucun contact, trajectoire stable.'),
    (3, '3.5', 5, 'PERFECTIONNEMENT', 'Observer sans déranger',
     'Milieu naturel. L''élève cherche et montre 5 espèces à son équipier, sans les toucher ni les poursuivre, lampe orientée à côté de l''animal.',
     '5 espèces montrées sans les déranger.'),
    (3, '3.6', 6, 'PERFECTIONNEMENT', 'Parcours d''obstacles sans contact',
     'Fosse ou milieu naturel. Passage dans des cerceaux ou sous des arches, à vitesse lente, sans toucher.',
     'Parcours fait sans contact ni appui.'),
    (3, '3.7', 7, 'MAITRISE', 'Plongée d''observation',
     'Milieu naturel. Plongée complète consacrée à l''observation. En surface, l''élève nomme et décrit les espèces vues.',
     'Aucun contact, au moins 5 espèces nommées et décrites.'),
    (3, '3.8', 8, 'MAITRISE', 'Plongée dans un milieu fragile',
     'Milieu naturel : herbier, coralligène, fond de carrière vaseux. Évolution sur toute la plongée, au fond comme au palier.',
     'Aucune dégradation, aucun nuage de sédiment.'),
    (3, '3.9', 9, 'MAITRISE', 'Comportement sur toutes les plongées',
     'Milieu naturel, tout au long de la formation. Le moniteur observe la discrétion, l''absence de nourrissage et de prélèvement, l''éclairage limité ; bilan au débriefing.',
     'Comportement respectueux et responsable sur toutes les plongées.'),

    -- ---------- Competence 4 : Etre attentif au materiel de ses equipiers (PA20) ----------
    (4, '4.1', 1, 'INITIATION', 'Le détendeur expliqué',
     'Au sec, sur un détendeur ou un schéma. Premier et second étage, détente, asservissement, débit continu et ses causes.',
     'L''élève explique la détente et l''asservissement avec ses mots.'),
    (4, '4.2', 2, 'INITIATION', 'Ajuster son lestage',
     'Fosse ou petit fond, avec son équipement complet. Test de lestage gilet vide, ajout ou retrait de 1 kg, résultat noté au carnet.',
     'Lestage juste, noté au carnet.'),
    (4, '4.3', 3, 'INITIATION', 'Présenter son matériel',
     'Au bord. Chacun présente à son équipier : ordinateur (réglages), gilet (inflateur, purges), octopus (emplacement), manomètre.',
     'Présentation complète, sans oubli.'),
    (4, '4.4', 4, 'PERFECTIONNEMENT', 'Découvrir le matériel d''un autre',
     'Au bord, avec un matériel que l''élève ne connaît pas. Il trouve les purges et l''inflateur, l''octopus, lit le manomètre et l''ordinateur.',
     'Tout est trouvé et compris sans aide.'),
    (4, '4.5', 5, 'PERFECTIONNEMENT', 'Contrôles avant l''immersion',
     'En surface, avant l''immersion. Contrôle croisé : air ouvert, gilet, octopus, ordinateur, lest. L''élève informe ses équipiers de toute anomalie.',
     'Contrôle fait sans rappel, anomalie annoncée.'),
    (4, '4.6', 6, 'PERFECTIONNEMENT', 'Matériel obligatoire en autonomie',
     'Au sec. L''élève vérifie sur le matériel de la palanquée le matériel obligatoire en plongée autonome et dit ce qui manque.',
     'Liste juste, manque repéré.'),
    (4, '4.7', 7, 'MAITRISE', 'Briefing matériel de la palanquée',
     'Milieu naturel, avant une plongée en autonomie. Chaque élève présente son matériel et se renseigne sur celui de ses équipiers : moyen de désaturation, gilet, détendeur de secours, contrôle de la pression.',
     'Réflexe spontané, informations justes pour chaque équipier.'),
    (4, '4.8', 8, 'MAITRISE', 'Lestage adapté au changement d''équipement',
     'Milieu naturel. Changement d''équipement annoncé (combinaison, bloc, eau douce ou salée) : l''élève adapte son lestage et le confirme au palier de 3 m en fin de plongée.',
     'Lestage ajusté dans le bon sens, palier tenu sans effort.'),
    (4, '4.9', 9, 'MAITRISE', 'Restituer le fonctionnement du détendeur',
     'Oral, au bord, en s''appuyant sur le matériel des équipiers. Détente et asservissement, différences entre les modèles de la palanquée.',
     'Explication juste, matériel des équipiers compris.'),

    -- ---------- Competence 5 : Evoluer en autonomie (PA20) ----------
    (5, '5.1', 1, 'INITIATION', 'Lire son ordinateur',
     'Au sec. Affichages : durée, profondeur instantanée et maximale, durée sans palier, paliers, durée de remontée, indicateur de vitesse, alarmes. Mode planification, carnet, conservatisme (GF bas = GF haut entre 85 et 90 % à l''air).',
     'Chaque affichage est lu et expliqué.'),
    (5, '5.2', 2, 'INITIATION', 'Ordinateurs différents dans la palanquée',
     'Au sec. On compare les ordinateurs de la palanquée en mode planification. La palanquée suit le plus conservateur.',
     'L''élève dit quel ordinateur guide la remontée et pourquoi.'),
    (5, '5.3', 3, 'INITIATION', 'Lancer un parachute',
     'Fosse ou petit fond (6 m au plus). Stabilisé, l''élève déroule le parachute, le gonfle à l''octopus et le lâche en tenant le dévidoir.',
     'Parachute en surface, sans être entraîné vers le haut.'),
    (5, '5.4', 4, 'PERFECTIONNEMENT', 'Autonomie surveillée',
     'Milieu naturel, 20 m au plus, moniteur en retrait. Binôme ou trinôme : contrôle régulier des paramètres et des équipiers, communication constante.',
     'Paramètres contrôlés, équipiers surveillés sans rappel.'),
    (5, '5.5', 5, 'PERFECTIONNEMENT', 'Parachute en pleine eau',
     'Pleine eau à 5-6 m, stabilisé. Lancement du parachute, puis remontée le long du bout à la vitesse indiquée par l''ordinateur et palier.',
     'Lancement propre, vitesse et palier respectés.'),
    (5, '5.6', 6, 'PERFECTIONNEMENT', 'Problème de table',
     'Au sec. Résolution d''un problème simple de table fédérale : pas d''utilisation planifiée, pas de lecture inverse, pas d''altitude ni de mélange autre que l''air, pas d''oxygène en surface ou au palier.',
     'Problème résolu, raisonnement expliqué.'),
    (5, '5.7', 7, 'MAITRISE', 'Plongée en autonomie',
     'Milieu naturel, 0 à 20 m, palanquée de 2 ou 3 autonomes, moniteur observateur. Consignes du DP respectées, vitesse de remontée, paliers, cohésion de la palanquée.',
     'Plongée menée sans intervention du moniteur.'),
    (5, '5.8', 8, 'MAITRISE', 'Parachute et sortie de l''eau',
     'Milieu naturel, en fin de plongée. Lancement du parachute au palier, remontée, surveillance de la surface et sortie de l''eau en sécurité.',
     'Parachute lancé, palier tenu, sortie sûre.'),
    (5, '5.9', 9, 'MAITRISE', 'Autonomie en conditions variées',
     'Milieu naturel : visibilité réduite, courant, site nouveau. Gestion de la désaturation partagée dans la palanquée ; questions orales sur des situations concrètes.',
     'Décisions adaptées, réponses justes.'),

    -- ---------- Competence 6 : Planifier la plongee en fonction des consignes du DP (PA20) ----------
    (6, '6.1', 1, 'INITIATION', 'Comprendre les consignes du DP',
     'Au sec, à partir d''un briefing de DP. L''élève reformule : profondeur et durée maximales, pression du bloc en fin de plongée, paliers éventuels, durée totale de remontée maximale.',
     'Toutes les consignes reformulées sans erreur.'),
    (6, '6.2', 2, 'INITIATION', 'Le compas à terre',
     'Au sec. Réglage d''un cap, visée, aller-retour à pied sur 20 à 30 m.',
     'Retour au point de départ.'),
    (6, '6.3', 3, 'INITIATION', 'Calculer sa consommation',
     'Au sec. Consommation en litres par minute et en bars par minute, en profondeur et au palier ; réserve de sécurité. Les calculs servent à comprendre.',
     'Calcul juste, autonomie déduite.'),
    (6, '6.4', 4, 'PERFECTIONNEMENT', 'Briefing de palanquée',
     'Au sec, avant une plongée. La palanquée fixe son profil dans le cadre du DP (pas de paliers profonds à l''air), compare ses ordinateurs et décide du contrôle des consommations (annonces, retour).',
     'Profil cohérent avec les consignes, protocole décidé.'),
    (6, '6.5', 5, 'PERFECTIONNEMENT', 'Compas en immersion',
     'Petit fond ou pleine eau, en binôme. Aller-retour au compas sur 20 à 30 m.',
     'Retour près du point de départ.'),
    (6, '6.6', 6, 'PERFECTIONNEMENT', 'Repères du site',
     'Sur la carte ou le croquis du site : mouillage, tombant, roches, profondeurs. Puis vérification en plongée accompagnée.',
     'Repères reconnus sous l''eau.'),
    (6, '6.7', 7, 'MAITRISE', 'Proposer une planification',
     'Milieu naturel, sur un cas concret. L''élève présente la planification et les procédures de chaque étape : descente, évolution, contrôle des consommations, retour, palier, sortie.',
     'Proposition complète, dans le cadre du DP.'),
    (6, '6.8', 8, 'MAITRISE', 'Aller-retour au compas et trajet prédéfini',
     'Milieu naturel. Aller-retour au compas sur 20 à 30 m, puis suivi d''un court trajet prédéfini.',
     'Retour au point de départ, trajet suivi.'),
    (6, '6.9', 9, 'MAITRISE', 'Plongée planifiée en autonomie',
     'Milieu naturel, 20 m au plus. La palanquée réalise la plongée qu''elle a planifiée : profondeur, durée, pression de retour. Débriefing des écarts.',
     'Plan respecté, écarts expliqués.'),

    -- ---------- Competence 7 : Intervenir et porter assistance a un plongeur en difficulte (PA20, validee en fin de formation) ----------
    (7, '7.1', 1, 'INITIATION', 'Reconnaître une difficulté',
     'Au sec puis en fosse. Rappel des signes conventionnels ; observation de situations simulées sans signe : ventilation anormale, agitation, inconscience, débit continu.',
     'Chaque situation reconnue et nommée.'),
    (7, '7.2', 2, 'INITIATION', 'Remontée assistée au gilet',
     'Fosse ou petit fond (6 m au plus). Saisie de l''assisté, une main sur son inflateur, l''autre sur sa purge ; remontée au gilet, l''assisté reste détendeur en bouche.',
     'Prise ferme, remontée régulière.'),
    (7, '7.3', 3, 'INITIATION', 'Passage d''octopus et remontée',
     'Fosse ou petit fond. Panne d''air simulée : l''élève donne son octopus, tient l''assisté et remonte avec lui.',
     'Octopus donné sans hésitation, remontée tenue.'),
    (7, '7.4', 4, 'PERFECTIONNEMENT', 'Assistance depuis 10 m',
     'Pleine eau. Remontée assistée au gilet depuis 10 m, arrêt marqué entre 5 et 3 m, puis surface.',
     'Vitesse régulière, arrêt marqué.'),
    (7, '7.5', 5, 'PERFECTIONNEMENT', 'Intervention en évolution',
     'Milieu naturel ou fosse. La difficulté survient pendant le déplacement : l''élève rejoint l''équipier, le stabilise et le prend en charge.',
     'Réaction rapide, sans brutalité.'),
    (7, '7.6', 6, 'PERFECTIONNEMENT', 'En surface jusqu''à la sortie',
     'En surface : gilets gonflés, signe de détresse au bateau, remorquage jusqu''au bateau ou au bord, aide au déséquipement.',
     'Assisté en sécurité, sortie de l''eau organisée.'),
    (7, '7.7', 7, 'MAITRISE', 'Assistance complète depuis le fond',
     'Milieu naturel, en fin de formation, au moins deux fois. Interprétation de la situation, prise en charge, remontée à une vitesse adaptée aux moyens de désaturation, arrêt marqué entre 5 et 3 m, sortie d''eau sécurisée. Gilets privilégiés, palmage autorisé.',
     'Interprétation juste, prise en charge rapide, remontée régulière, arrêt marqué.'),
    (7, '7.8', 8, 'MAITRISE', 'Seconde situation : panne d''air',
     'Milieu naturel, en fin de formation, au moins deux fois. Panne d''air simulée : passage de l''octopus, puis remontée assistée jusqu''à la sortie de l''eau.',
     'Situation différente de 7.7, réalisée intégralement.'),
    (7, '7.9', 9, 'MAITRISE', 'Étude de cas d''accidents',
     'Oral, à partir de cas pratiques. Causes, symptômes, prévention, conduite à tenir ; pour l''accident de désaturation : facteurs favorisants, profils à risque, plongée de réadaptation.',
     'Analyse juste de chaque cas.'),

    -- ---------- Competence 8 : Se ventiler - S'equilibrer (PE40) ----------
    (8, '8.1', 1, 'INITIATION', 'Passages tuba-embout et lâcher d''embout',
     'Fosse ou petit fond. Passage tuba-embout en surface, lâcher et reprise d''embout en immersion, expiration à la remontée.',
     'Gestes enchaînés, ventilation calme.'),
    (8, '8.2', 2, 'INITIATION', 'VDM stabilisé',
     'Fosse ou petit fond (6 m au plus). Retrait, remise et vidage du masque en pleine eau, sans repère au fond.',
     'Ventilation normale et profondeur gardées.'),
    (8, '8.3', 3, 'INITIATION', 'Stabilisation au poumon ballast',
     'Fosse. Gilet réglé, palmes immobiles, l''élève monte et descend de 1 m au seul poumon ballast.',
     'Stabilité tenue sans palmer.'),
    (8, '8.4', 4, 'PERFECTIONNEMENT', 'Ventiler à l''effort',
     'Milieu naturel, 10 à 20 m. Déplacement soutenu ou contre un léger courant : ventilation ample, expiration marquée ; l''élève signale un début d''essoufflement.',
     'Effort réglé, essoufflement évité ou signalé.'),
    (8, '8.5', 5, 'PERFECTIONNEMENT', 'VDM en pleine eau à 10-15 m',
     'Pleine eau, sans repère, 10 à 15 m. VDM complet, puis reprise de l''évolution.',
     'Ni descente ni remontée pendant le VDM.'),
    (8, '8.6', 6, 'PERFECTIONNEMENT', 'Stabilisation aux profondeurs annoncées',
     'Pleine eau. Arrêts successifs aux profondeurs annoncées par le moniteur, réglage au gilet puis au poumon ballast.',
     'Chaque arrêt tenu à ± 1 m.'),
    (8, '8.7', 7, 'MAITRISE', 'VDM à 20 m en situations variées',
     'Milieu naturel, 20 m. VDM stabilisé, en déplacement et après un lâcher d''embout.',
     'Sans stress, ventilation et stabilité gardées.'),
    (8, '8.8', 8, 'MAITRISE', 'Ventilation en profondeur',
     'Milieu naturel. Plongée progressive dans l''espace 0-40 m sous la responsabilité d''un E3 : ventilation adaptée à un effort normal à modéré, lâcher et reprise d''embout en profondeur.',
     'Ventilation régulée, aucun essoufflement.'),
    (8, '8.9', 9, 'MAITRISE', 'Stable sur toute la plongée',
     'Milieu naturel. Stabilisation sans appui à toutes les étapes : fond, observation, remontée, palier.',
     'Stabilité constante, palier tenu sans effort.'),

    -- ---------- Competence 9 : Communiquer avec le guide de palanquee (PE40) ----------
    (9, '9.1', 1, 'INITIATION', 'Tous les signes',
     'Au sec. Révision des signes du N1 et apprentissage de ceux de la plongée profonde : narcose, pression et consommation, paliers.',
     'Tous les signes faits et compris.'),
    (9, '9.2', 2, 'INITIATION', 'Annoncer ses paramètres',
     'Fosse ou petit fond. Le moniteur montre des cartes (pression, palier, ressenti) : l''élève annonce chaque paramètre par signe.',
     'Annonces claires et justes.'),
    (9, '9.3', 3, 'INITIATION', 'Briefing avec le GP',
     'Au sec. Le GP donne ses consignes ; l''élève les reformule et dit ce qu''il annoncera en plongée.',
     'Consignes reformulées sans oubli.'),
    (9, '9.4', 4, 'PERFECTIONNEMENT', 'Répondre au GP en immersion',
     'Milieu naturel. Le GP demande pression, paliers et état : réponses par signes.',
     'Réponses claires et rapides.'),
    (9, '9.5', 5, 'PERFECTIONNEMENT', 'Annonces spontanées',
     'Milieu naturel. Mi-pression, réserve, palier qui apparaît : l''élève prévient le GP sans attendre d''être sollicité.',
     'Chaque seuil annoncé sans rappel.'),
    (9, '9.6', 6, 'PERFECTIONNEMENT', 'Dire son ressenti',
     'Milieu naturel, après une descente plus profonde. L''élève signale son ressenti : narcose, froid, essoufflement.',
     'Ressenti analysé et signalé au GP.'),
    (9, '9.7', 7, 'MAITRISE', 'Plongée profonde encadrée',
     'Milieu naturel, plongée progressive jusqu''à 40 m sous la responsabilité d''un E3. L''ensemble des situations de communication est évalué, à terre et en plongée.',
     'Échanges clairs, réactions rapides et adaptées.'),
    (9, '9.8', 8, 'MAITRISE', 'Consignes inattendues du GP',
     'Milieu naturel. Le GP change la consigne en plongée (demi-tour, remontée, profondeur limitée) ou simule une situation demandant une réponse.',
     'Consigne comprise et suivie sans délai.'),
    (9, '9.9', 9, 'MAITRISE', 'Débriefing avec le GP',
     'Milieu naturel, en surface puis à terre. L''élève restitue au GP ses paramètres et son ressenti.',
     'Restitution complète et juste.'),

    -- ---------- Competence 10 : Retourner en surface (PE40) ----------
    (10, '10.1', 1, 'INITIATION', 'Paramètres de désaturation',
     'Au sec, ordinateur en simulation. Profondeur, temps, durée sans palier, durée totale de remontée, paliers.',
     'Chaque paramètre trouvé et expliqué.'),
    (10, '10.2', 2, 'INITIATION', 'Principes de la table fédérale',
     'Au sec, oral ou écrit. Palier, vitesse de remontée, différents types de plongée, sans exercice de calcul de table.',
     'Principes expliqués sans erreur.'),
    (10, '10.3', 3, 'INITIATION', 'Remontée le long d''un bout',
     'Fosse ou petit fond. Remontée en suivant l''indicateur de vitesse de l''ordinateur, palier simulé à 3 m.',
     'Vitesse respectée, palier tenu.'),
    (10, '10.4', 4, 'PERFECTIONNEMENT', 'Paramètres annoncés au GP',
     'Milieu naturel. L''élève annonce au GP sa durée sans palier restante et ses paliers, et suit ses consignes.',
     'Annonces justes, consignes suivies.'),
    (10, '10.5', 5, 'PERFECTIONNEMENT', 'Remontée en pleine eau sans repère',
     'Milieu naturel, depuis 15 à 20 m, moniteur à côté. Vitesse de l''ordinateur, palier tenu, tour d''horizon avant la surface.',
     'Vitesse et palier respectés sans repère.'),
    (10, '10.6', 6, 'PERFECTIONNEMENT', 'Plongée avec paliers',
     'Milieu naturel, avec le GP. Plongée qui demande un palier obligatoire : l''élève suit l''évolution de ses paramètres et gère ses paliers.',
     'Paliers effectués selon son ordinateur.'),
    (10, '10.7', 7, 'MAITRISE', 'Remontée isolée',
     'Milieu naturel, moniteur à proximité. Depuis le fond, l''élève remonte seul : vitesse, paliers, approche de la surface et tour d''horizon, gilet gonflé, signal au bateau, sortie de l''eau.',
     'Remontée sûre, sans aide.'),
    (10, '10.8', 8, 'MAITRISE', 'Gérer sa désaturation sur la plongée',
     'Milieu naturel. Contrôle des instruments à une fréquence adaptée à la profondeur, paramètres communiqués au GP sans être sollicité.',
     'Contrôles réguliers, annonces spontanées.'),
    (10, '10.9', 9, 'MAITRISE', 'Restituer sa plongée au DP',
     'Milieu naturel, après la plongée. L''élève donne au DP profondeur maximale, durée et paliers ; question orale sur la table fédérale.',
     'Paramètres exacts, principes connus.'),

    -- ---------- Competence 11 : Intervenir en relais sur un equipier en difficulte (PE40, validee en fin de formation) ----------
    (11, '11.1', 1, 'INITIATION', 'Donner son deuxième détendeur',
     'Fosse ou petit fond. Au signe « panne d''air », l''élève présente son deuxième détendeur, l''équipier le prend, l''élève le tient par le gilet.',
     'Détendeur présenté aussitôt, prise ferme.'),
    (11, '11.2', 2, 'INITIATION', 'Maintenir la profondeur à deux',
     'Fosse ou petit fond. Binôme relié par l''octopus : stabilisation au gilet sans descendre.',
     'Profondeur tenue, pas de descente.'),
    (11, '11.3', 3, 'INITIATION', 'Se déplacer jusqu''au GP',
     'Fosse. Le binôme relié par l''octopus rejoint le GP sur une dizaine de mètres.',
     'Déplacement calme, profondeur gardée.'),
    (11, '11.4', 4, 'PERFECTIONNEMENT', 'Relais en panne d''air à 10-15 m',
     'Milieu naturel, 10 à 15 m. Panne d''air simulée, deuxième détendeur donné, prise en charge.',
     'Réaction immédiate, confort de l''équipier.'),
    (11, '11.5', 5, 'PERFECTIONNEMENT', 'Relais sur essoufflement ou narcose',
     'Milieu naturel. Essoufflement ou narcose simulés : l''élève stabilise et rassure l''équipier, l''empêche de descendre et prévient le GP.',
     'Situation comprise, GP prévenu.'),
    (11, '11.6', 6, 'PERFECTIONNEMENT', 'Relais pendant l''évolution',
     'Milieu naturel. L''équipier fait un signe pendant le déplacement : l''élève intervient sans perdre la profondeur.',
     'Intervention rapide, profondeur gardée.'),
    (11, '11.7', 7, 'MAITRISE', 'Relais complet en panne d''air',
     'Milieu naturel, en fin de formation. Prise en charge du plongeur assisté, maintien de la profondeur, passage d''embout et déplacement jusqu''au GP.',
     'Les trois actions réalisées sans ambiguïté.'),
    (11, '11.8', 8, 'MAITRISE', 'Situations variées',
     'Milieu naturel, en fin de formation. Plusieurs situations tirées au sort nécessitant d''intervenir avant le GP : panne d''air, essoufflement, narcose, crampe.',
     'Action adaptée à chaque situation.'),
    (11, '11.9', 9, 'MAITRISE', 'Relais en zone profonde',
     'Milieu naturel, dans l''espace 0-40 m sous la responsabilité d''un E3. Intervention en relais en profondeur jusqu''à l''arrivée du GP.',
     'Profondeur pas augmentée, flottabilité assurée.')
  ) AS v(bloc_ordre, numero, ordre, phase, intitule, deroulement, critere_reussite)
    ON v.bloc_ordre = b.ordre
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)';

INSERT INTO exercice_competence_critere (exercice_id, critere_id)
SELECT e.id, c.id
  FROM exercice_competence e
  JOIN bloc_competence b ON b.id = e.bloc_id
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN critere c ON c.bloc_id = b.id
  JOIN (VALUES
    -- S'équiper : 1 gréage et dégréage, 2 capelage et décapelage, 3 saut droit, bascule, échelle
    ('1.1', 1), ('1.2', 2), ('1.3', 3), ('1.4', 1), ('1.4', 2), ('1.5', 2), ('1.6', 3),
    ('1.7', 1), ('1.7', 2), ('1.7', 3), ('1.8', 1), ('1.8', 2), ('1.9', 3),
    -- S'immerger : 1 canard et phoque, 2 palmages, 3 REC, 4 descente et remontée
    ('2.1', 1), ('2.2', 2), ('2.3', 3), ('2.4', 4), ('2.5', 2), ('2.6', 3),
    ('2.7', 1), ('2.7', 4), ('2.8', 2), ('2.9', 3),
    -- Milieu et environnement : 1 aisance aquatique
    ('3.1', 1), ('3.2', 1), ('3.3', 1), ('3.4', 1), ('3.5', 1), ('3.6', 1), ('3.7', 1), ('3.8', 1), ('3.9', 1),
    -- Matériel des équipiers : 1 son propre matériel, 2 matériel des équipiers
    ('4.1', 1), ('4.2', 1), ('4.3', 1), ('4.3', 2), ('4.4', 2), ('4.5', 1), ('4.5', 2), ('4.6', 1), ('4.6', 2),
    ('4.7', 1), ('4.7', 2), ('4.8', 1), ('4.9', 1), ('4.9', 2),
    -- Évoluer en autonomie : 1 sécurité de la palanquée
    ('5.1', 1), ('5.2', 1), ('5.3', 1), ('5.4', 1), ('5.5', 1), ('5.6', 1), ('5.7', 1), ('5.8', 1), ('5.9', 1),
    -- Planifier : 1 directives du DP, 2 topologie et orientation, 3 profil et procédures
    ('6.1', 1), ('6.2', 2), ('6.3', 3), ('6.4', 1), ('6.4', 3), ('6.5', 2), ('6.6', 2),
    ('6.7', 1), ('6.7', 3), ('6.8', 2), ('6.9', 1), ('6.9', 2), ('6.9', 3),
    -- Porter assistance : 1 observation, compréhension et réaction
    ('7.1', 1), ('7.2', 1), ('7.3', 1), ('7.4', 1), ('7.5', 1), ('7.6', 1), ('7.7', 1), ('7.8', 1), ('7.9', 1),
    -- Se ventiler - s'équilibrer : 1 ventilation, 2 vidage du masque, 3 stabilisation
    ('8.1', 1), ('8.2', 2), ('8.2', 3), ('8.3', 3), ('8.4', 1), ('8.5', 2), ('8.5', 3), ('8.6', 3),
    ('8.7', 2), ('8.7', 3), ('8.8', 1), ('8.9', 3),
    -- Communiquer avec le GP : 1 signes et codes
    ('9.1', 1), ('9.2', 1), ('9.3', 1), ('9.4', 1), ('9.5', 1), ('9.6', 1), ('9.7', 1), ('9.8', 1), ('9.9', 1),
    -- Retourner en surface : 1 gestion de la désaturation, 2 remontée isolée
    ('10.1', 1), ('10.2', 1), ('10.3', 2), ('10.4', 1), ('10.5', 2), ('10.6', 1),
    ('10.7', 2), ('10.8', 1), ('10.9', 1),
    -- Intervenir en relais : 1 intervention en relais
    ('11.1', 1), ('11.2', 1), ('11.3', 1), ('11.4', 1), ('11.5', 1), ('11.6', 1), ('11.7', 1), ('11.8', 1), ('11.9', 1)
  ) AS v(numero, critere_ordre)
    ON v.numero = e.numero AND v.critere_ordre = c.ordre
 WHERE r.niveau = 'N2' AND r.version_mft = 'PA20 | PE40 (2026-05)';
