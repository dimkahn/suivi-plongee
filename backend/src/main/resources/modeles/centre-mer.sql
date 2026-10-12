-- ============================================================
--  Modèle « centre de plongée en mer » (2026).
--
--  Ce n'est PAS une migration : le script n'est exécuté que sur
--  demande d'un admin, depuis /admin/progressions (bouton « Installer
--  le modèle », ModeleCentreMerService), sur une installation qui
--  forme en stage court, tout en mer. Le club associatif qui forme
--  sur l'année ne l'installe pas : sa base d'exercices et ses
--  progressions ne changent pas.
--
--  1. Une base d'exercices du N1 PE20 écrite pour la mer (numéros
--     « M1.1 » … « M10.6 », 44 exercices, avec conseils de
--     l'encadrant et critères travaillés) : la base du club (V51)
--     suppose une piscine. Chaque critère technique a au moins un
--     exercice de maîtrise, comme l'exige la notation.
--  2. Trois progressions découpées par plongées (V73), une par
--     niveau, sur la version courante du MFT : N1 PE20 en 6
--     plongées, N2 PA20 | PE40 en 8, N3 PA40 | PE60 en 10. Le N2
--     et le N3 reprennent la base d'exercices installée par les
--     migrations (V59, V61), déjà décrite en milieu naturel.
--
--  Tout passe par INSERT … SELECT : un référentiel absent ou un
--  exercice renuméroté est simplement laissé de côté. Réexécuter le
--  script ne crée pas de doublon d'exercice (NOT EXISTS) ; le service
--  refuse de toute façon une seconde installation des progressions.
--  Ensuite tout se modifie depuis /admin/exercices et
--  /admin/progressions.
-- ============================================================

-- ---------- 1. Base d'exercices N1 en mer ----------

INSERT INTO exercice_competence (bloc_id, numero, ordre, phase, intitule, deroulement, critere_reussite, conseils)
SELECT b.id, v.numero, v.ordre, v.phase, v.intitule, v.deroulement, v.critere_reussite, v.conseils
  FROM bloc_competence b
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN (VALUES
    -- ---------- S'équiper et se déséquiper (bloc 1) ----------
    (1, 'M1.1', 101, 'INITIATION', 'Gréage commenté au centre',
     'Au centre ou sur le ponton, avant d''embarquer. Le moniteur grée en commentant : bloc (pression, date d''épreuve, joint), gilet (sangle au niveau du robinet), détendeur (2e étage à droite), ouverture lente, lecture du manomètre, essai du détendeur, de l''octopus, de l''inflateur et des purges. L''élève grée ensuite le sien à côté de lui, puis dégrée au retour.',
     'L''élève grée seul et cite les vérifications dans l''ordre.',
     'Faire dire chaque vérification à voix haute. Ouvrir lentement, manomètre tourné vers le bas. Sur un bateau qui bouge, un bloc est toujours couché ou tenu : en prendre l''habitude dès le ponton.'),
    (1, 'M1.2', 102, 'PERFECTIONNEMENT', 'Capelage assis au bateau et vérification croisée',
     'Sur le bateau, à sa place. Capelage assis, bloc calé, sangles serrées, lest en place. Vérification croisée avec le binôme : air ouvert, inflateur branché, purges, lest, masque et palmes à portée.',
     'Prêt au signal du DP, vérification croisée complète.',
     'Le bateau impose de capeler assis : montrer comment se pencher pour attraper les bretelles. Ne jamais se lever bloc sur le dos sans y être invité. Laisser les binômes mener la vérification et ne compléter qu''à la fin.'),
    (1, 'M1.3', 103, 'MAITRISE', 'Prêt avant le départ du bateau',
     'L''élève choisit son matériel au centre (taille et épaisseur de combinaison, masque, palmes, gilet), ajuste son lestage d''après la plongée précédente, grée, embarque son matériel et s''équipe seul. Le moniteur observe sans aider.',
     'Matériel adapté, gréé sans erreur, capelé et vérifié dans le temps donné, sans rappel.',
     'Vérifier soi-même chaque équipement avant la mise à l''eau, même si l''élève est sûr de lui. Le choix du matériel est évalué : faire justifier la taille et l''épaisseur de la combinaison selon la température de l''eau.'),
    (1, 'M1.4', 104, 'MAITRISE', 'Décapelage et recapelage en surface',
     'En surface près du bateau ou du bout de mouillage, gilet bien gonflé. L''élève décapelle, tient son bloc devant lui, puis recapelle. Variante : passer le bloc à l''équipage avant de monter à l''échelle.',
     'Sans aide, calme, une main toujours sur le gilet.',
     'Choisir une mer calme et un bout de regroupement à portée. Erreur fréquente : lâcher le gilet pour se servir des deux mains. Un élève en difficulté se tient au bout et recommence plus lentement.'),

    -- ---------- Se mettre à l'eau et sortir de l'eau (bloc 2) ----------
    (2, 'M2.1', 101, 'INITIATION', 'Bascule arrière depuis le boudin',
     'Semi-rigide, élève assis sur le boudin, dos à la mer. Vérifier derrière soi, une main sur masque et détendeur, l''autre sur le lest ou la sangle, menton rentré, bascule. Gilet légèrement gonflé ; OK en surface et dégager la zone.',
     'Matériel en place, OK donné aussitôt, zone dégagée.',
     'Toujours un encadrant déjà dans l''eau. Donner un ordre de passage clair et attendre que la zone soit libre. Un élève qui appréhende bascule après le moniteur, qui l''attend en surface.'),
    (2, 'M2.2', 102, 'INITIATION', 'Saut droit depuis la plateforme',
     'Bateau à plateforme arrière. Vérifier la zone, une main sur masque et détendeur, l''autre sur le lest, regard à l''horizon, grand pas. OK en surface, puis rejoindre le bout de regroupement.',
     'Masque et détendeur gardés, regroupement immédiat.',
     'Regard à l''horizon : regarder l''eau fait basculer en avant. Sur une plateforme haute ou par mer formée, préférer la bascule ou l''entrée assise.'),
    (2, 'M2.3', 103, 'PERFECTIONNEMENT', 'Départ du bord ou de la plage',
     'Plage ou mise à l''eau du bord, en binôme. Chausser les palmes dans l''eau à mi-cuisse en se tenant au binôme (ou entrer à reculons), s''allonger et palmer sur le dos jusqu''à une profondeur suffisante. Au retour, déchausser dans l''eau avant de se relever.',
     'Entrée et retour sans chute, binôme gardé.',
     'Observer les vagues avant d''entrer : on passe entre deux séries. Erreur fréquente : marcher face au large palmes chaussées. Sur galets ou rochers, garder le détendeur en bouche.'),
    (2, 'M2.4', 104, 'PERFECTIONNEMENT', 'Sortie par l''échelle du bateau',
     'Au retour, en surface près de l''échelle, gilet gonflé. Attendre son tour hors de l''axe, tendre le lest puis le bloc à l''équipage (ou monter capelé selon le bateau), retirer les palmes une main sur l''échelle, monter détendeur en bouche.',
     'Ordre respecté, une main toujours sur l''échelle, zone dégagée pour le suivant.',
     'Le réceptionnaire est un encadrant ou l''équipage, jamais un élève. Ne jamais rester sous l''échelle : un bloc ou un plongeur peut tomber. Par houle, monter dans le creux de la vague.'),
    (2, 'M2.5', 105, 'MAITRISE', 'Mise à l''eau sur consigne du DP',
     'Briefing du DP avec ordre de passage et technique imposée (bascule ou saut). L''élève s''équipe, attend son tour, se met à l''eau à l''annonce et rejoint le bout de mouillage ou le GP.',
     'Technique demandée réalisée en sécurité, à son tour, regroupement sans rappel.',
     'L''écoute est évaluée autant que le geste : ne pas répéter les consignes. Varier la technique d''une plongée à l''autre pour valider les deux.'),
    (2, 'M2.6', 106, 'MAITRISE', 'Départ plage en palanquée',
     'Plongée du bord. L''élève choisit le moment d''entrer, s''équipe dans l''eau, rejoint la palanquée et, au retour, sort de l''eau sans aide en gardant son binôme.',
     'Entrée et sortie maîtrisées, sans chute ni séparation.',
     'À ne valider que si les conditions le permettent : une mer formée rend l''exercice dangereux. Un centre qui ne plonge qu''en bateau le prévoit sur une plage abritée.'),
    (2, 'M2.7', 107, 'MAITRISE', 'Retour au bateau et sortie de l''eau',
     'Fin de plongée : retour au bateau en surface, regroupement à l''échelle, passage du lest et du bloc (ou montée capelé), sortie et dégagement de la zone.',
     'Sortie sans aide, ordre respecté, tour d''horizon fait avant d''approcher l''échelle.',
     'Exiger le tour d''horizon avant d''approcher : hélice et autres palanquées. Valider après plusieurs sorties propres, par des mers différentes si possible.'),

    -- ---------- S'immerger (bloc 3) ----------
    (3, 'M3.1', 101, 'INITIATION', 'Phoque le long du bout de mouillage',
     'Au bout de mouillage, gilet vidé, purge levée, vertical. Expiration complète, descente lente main sur le bout, équilibrage des oreilles dès le premier mètre. Arrêt à 3 m pour vérifier l''équilibre.',
     'Immersion sans palmer, oreilles équilibrées tôt, arrêt à 3 m.',
     'Le bout rassure et permet de doser la vitesse. Erreur fréquente : palmer pour descendre. Un élève qui ne descend pas, gilet vide et expiration complète, manque de lest : corriger avant de reprendre.'),
    (3, 'M3.2', 102, 'PERFECTIONNEMENT', 'Canard capelé au-dessus d''un fond de sable',
     'Fond de 4 à 6 m, sable, bonne visibilité. En surface, gilet vidé, buste plié, jambes levées hors de l''eau, glisse vers le fond en équilibrant, stabilisation au-dessus du sable sans le toucher.',
     'Palmes hors de l''eau, immersion franche, arrivée stabilisée sans soulever le sable.',
     'Choisir un fond de sable pour ne rien abîmer. Décomposer au besoin : buste puis jambes. Équilibrer dès la glisse, les oreilles arrivent vite.'),
    (3, 'M3.3', 103, 'MAITRISE', 'Immersion sur consigne du GP, sans repère',
     'En pleine eau, loin du bout. Le GP annonce la technique (canard ou phoque) et la profondeur de regroupement. La palanquée s''immerge au signe, descend en équilibrant et se stabilise à la profondeur annoncée, regard vers le GP.',
     'Technique demandée, descente maîtrisée, stabilisation à la profondeur annoncée.',
     'Le MFT insiste sur l''équilibre à 3 m : le vérifier avant de poursuivre. Rester à portée de main pendant la descente et arrêter au moindre signe de gêne aux oreilles.'),

    -- ---------- Se propulser (bloc 4) ----------
    (4, 'M4.1', 101, 'INITIATION', 'Palmages de surface jusqu''au mouillage',
     'Du bateau au bout de mouillage ou à la bouée, 30 à 50 m : palmage ventral sur tuba, puis dorsal gilet légèrement gonflé, puis arrêt en sustentation le temps d''un signe OK.',
     'Jambes tendues, palmes sous la surface, ventilation calme.',
     'Chaque trajet en surface est un temps d''exercice : en profiter pour corriger le palmage. Erreur de base : le « vélo », genoux qui plient. Un gilet trop gonflé redresse et freine.'),
    (4, 'M4.2', 102, 'PERFECTIONNEMENT', 'Palmage en immersion au-dessus du fond',
     'Fond de sable ou d''herbier, 5 à 10 m. L''élève suit le moniteur à distance constante, horizontal, palmage ample et lent, sans toucher le fond ni soulever de sable.',
     'Assiette horizontale, aucun contact avec le fond, distance gardée.',
     'Un élève « assis » dans l''eau palme vers le haut et soulève le fond : corriger d''abord le lestage et le gilet, ensuite le geste. Se retourner souvent pour vérifier la distance.'),
    (4, 'M4.3', 103, 'MAITRISE', 'Retour au bateau en capelé',
     'Fin de plongée, retour en surface au bateau sur 50 à 100 m, gilet légèrement gonflé : sur le dos en levant la tête pour garder le cap, ou sur le ventre sur tuba.',
     'Retour sans essoufflement, cap tenu, capable de parler à l''arrivée.',
     'Annoncer le point d''arrivée. La gestion de l''effort compte plus que la vitesse : un élève qui ne peut plus parler à l''arrivée doit ralentir. Jamais contre un courant fort : le bateau vient chercher.'),
    (4, 'M4.4', 104, 'MAITRISE', 'Sustentation et palmages en attendant le bateau',
     'En surface, sans appui, gilet presque vide : sustentation une minute en gardant la tête hors de l''eau, puis palmage ventral et dorsal sur 25 m chacun.',
     'Geste efficace, sans essoufflement, ventilation maîtrisée.',
     'Le faire en fin de plongée, quand l''élève attend le bateau : c''est la situation réelle. Gilet presque vide pour que la sustentation vienne des palmes, encadrant à côté.'),
    (4, 'M4.5', 105, 'MAITRISE', 'Évoluer en palanquée sur toute la plongée',
     'Plongée d''exploration jusqu''à 20 m. L''élève tient sa place à distance constante du GP, adapte son allure, ne touche ni le fond ni la faune.',
     'Distance tenue sur toute la plongée, palmage économe, aucun contact.',
     'Rappeler la règle de distance au briefing. Un élève qui se laisse distancer regarde souvent le fond : se retourner souvent. La consommation reflète l''efficacité du palmage.'),

    -- ---------- Se ventiler (bloc 5) ----------
    (5, 'M5.1', 101, 'INITIATION', 'Ventilation sur tuba en attendant la palanquée',
     'En surface, au bout de mouillage ou près du bateau, visage dans l''eau : ventilation calme sur tuba, puis vidage du tuba par une expiration franche après une immersion du visage.',
     'Vidage franc, reprise prudente, ventilation régulière.',
     'La houle remplit le tuba : apprendre à inspirer prudemment après chaque vidage. Rassurer : avaler un peu d''eau n''est pas grave.'),
    (5, 'M5.2', 102, 'INITIATION', 'Vidage de masque à genoux sur le sable',
     'Fond de sable de 3 à 6 m, moniteur en face. Laisser entrer un peu d''eau, puis la chasser : tête légèrement relevée, main sur le haut de la jupe, souffler par le nez. Progression : un filet d''eau, la moitié, le masque plein.',
     'Masque vidé sans remonter, ventilation gardée.',
     'Ne passer au palier suivant que sans stress. Erreur fréquente : souffler par la bouche ou tête baissée. L''eau de mer pique les yeux : le dire avant, et laisser l''élève fermer les yeux au début.'),
    (5, 'M5.3', 103, 'PERFECTIONNEMENT', 'Lâcher et reprise d''embout sur le sable',
     'À genoux, 3 à 6 m. Lâcher l''embout en laissant filer un filet de bulles, le récupérer d''un geste du bras (ou en se penchant à droite), le remettre et le vider par expiration puis par le bouton de surpression.',
     'Deux méthodes de vidage maîtrisées, jamais d''inspiration sans embout.',
     'Rappeler sans cesse : on n''inspire jamais sans embout. Moniteur en face, octopus prêt. Une apnée reste courte, jamais précédée d''hyperventilation.'),
    (5, 'M5.4', 104, 'MAITRISE', 'Vidage de masque et LRE en pleine eau',
     'En pleine eau, stabilisé entre 3 et 6 m, à la demande du GP : vidage de masque, puis lâcher et reprise d''embout, sans changer de profondeur.',
     'Gestes réussis du premier coup, profondeur tenue à 1 m près, calme.',
     'En pleine eau, l''équilibre s''ajoute au geste : n''y venir qu''une fois les gestes sûrs au fond. Un élève qui se pose pour réussir n''est pas encore prêt.'),
    (5, 'M5.5', 105, 'MAITRISE', 'Ventilation calme sur toute la plongée',
     'Plongée d''exploration. Le moniteur observe le rythme des bulles et l''attitude ; à mi-plongée, l''élève annonce sa pression. En cas d''effort (léger courant), il ralentit et reprend une expiration longue.',
     'Ventilation ample et lente, consommation cohérente, pas d''essoufflement.',
     'L''expiration plus longue que l''inspiration est la clé contre l''essoufflement : la rappeler au briefing. Comparer la consommation d''une plongée à l''autre, elle doit baisser.'),
    (5, 'M5.6', 106, 'MAITRISE', 'Tuba et masque en surface agitée',
     'En surface avec un peu de clapot, en attendant le bateau : ventilation sur tuba visage dans l''eau, vidage du tuba après une vague, vidage du masque en surface si besoin.',
     'Ventilation tenue sans boire la tasse, sans panique.',
     'Seulement par mer peu agitée, encadrant au contact. Apprendre à tourner le dos aux vagues et à reprendre le détendeur si la mer se forme : c''est la vraie consigne de sécurité.'),

    -- ---------- S'équilibrer (bloc 6) ----------
    (6, 'M6.1', 101, 'INITIATION', 'Poumon ballast au-dessus du sable',
     'Allongé au-dessus d''un fond de sable de 5 à 6 m, gilet réglé pour flotter juste. À l''inspiration on monte un peu, à l''expiration on redescend : l''élève joue sur l''amplitude pour décoller et se reposer sans les mains.',
     'L''élève décolle et se repose au poumon ballast, sans palmer.',
     'Régler le gilet d''abord, par petites injections. Faire sentir le délai entre l''inspiration et la montée : l''erreur est de corriger trop vite.'),
    (6, 'M6.2', 102, 'PERFECTIONNEMENT', 'Stabilisation au gilet à 6 m',
     'En pleine eau à 6 m, près d''un repère (bout, tombant). L''élève s''équilibre au gilet par petites injections et purges, puis tient sa profondeur une minute en ventilation normale.',
     'Profondeur tenue à 1 m près, sans palmer ni se tenir.',
     'Petite injection, attente, puis correction : l''élève qui gonfle trop part vers la surface. Montrer la purge haute et la purge basse selon la position.'),
    (6, 'M6.3', 103, 'MAITRISE', 'Stabilisation à la demande à plusieurs profondeurs',
     'Pendant la plongée, le GP arrête la palanquée à plusieurs profondeurs (6 m, 12 m, 20 m) : chacun s''équilibre au gilet puis affine au poumon ballast ; le reste de la plongée se fait sans contact avec le fond.',
     'Stabilisation rapide à chaque arrêt, gilet et poumon ballast combinés.',
     'Expliquer pourquoi le gilet perd du volume en descendant et en reprend en remontant : c''est ce qui fait réagir l''élève à temps. Valider sur toute la plongée, pas sur un arrêt réussi.'),

    -- ---------- Respecter le milieu et l'environnement (bloc 7) ----------
    (7, 'M7.1', 101, 'INITIATION', 'Découvrir le site et ses habitants',
     'Au briefing, présentation du site, des espèces courantes et des dangers locaux (oursins, méduses, rascasses, courant). Pendant la plongée, le moniteur montre deux ou trois espèces sans les toucher.',
     'L''élève reconnaît les espèces montrées et cite les gestes à éviter.',
     'Préparer deux ou trois espèces faciles à trouver sur le site. Les dangers locaux sont aussi de la prévention. La charte du plongeur responsable trouve ici un exemple concret.'),
    (7, 'M7.2', 102, 'PERFECTIONNEMENT', 'Évoluer sans toucher',
     'Au-dessus d''un herbier ou près des roches, l''élève se déplace, s''arrête et se retourne sans poser les mains ni les palmes et sans soulever de sable.',
     'Aucun contact avec le fond ou la faune pendant l''exercice.',
     'L''herbier de posidonie est protégé : c''est l''occasion d''en parler. Un élève qui touche le fond a souvent un problème de lestage ou d''assiette, pas de bonne volonté.'),
    (7, 'M7.3', 103, 'MAITRISE', 'Plongée d''observation respectueuse',
     'Plongée d''exploration. L''élève observe, montre au moniteur ce qu''il voit, garde ses distances avec la faune et reste stable sans contact, du début à la fin.',
     'Déplacements équilibrés, aucun contact, observation active.',
     'C''est l''attitude sur toute la plongée qui est évaluée. Au débriefing, faire raconter ce qui a été vu : l''observation est le plaisir du plongeur.'),

    -- ---------- Communiquer (bloc 8) ----------
    (8, 'M8.1', 101, 'INITIATION', 'Les signes pendant le trajet en bateau',
     'Pendant le trajet, révision de tous les signes : OK, monter, descendre, ça ne va pas, mi-pression, réserve, panne d''air, essoufflement, froid, fin de plongée. Le moniteur fait un signe, l''élève le nomme et donne la réponse.',
     'Tous les signes reconnus, la bonne réponse donnée.',
     'Le trajet est le bon moment : tout le monde est là. Insister sur la réponse attendue à chaque signe, pas seulement sur sa signification.'),
    (8, 'M8.2', 102, 'PERFECTIONNEMENT', 'Répondre au GP pendant la plongée',
     'Pendant la plongée, le GP demande régulièrement « ça va ? » et la pression. L''élève répond sans délai, lit son manomètre et montre la valeur.',
     'Réponses justes et rapides, manomètre lu sans aide.',
     'Interroger à des moments variés, pas seulement aux arrêts. Vérifier que l''élève lit vraiment son manomètre et ne répond pas OK par réflexe.'),
    (8, 'M8.3', 103, 'MAITRISE', 'Annoncer de soi-même ses paramètres et son état',
     'Sur toute la plongée, l''élève annonce de lui-même la mi-pression, la réserve, le froid ou une gêne, et réagit aux signes du GP.',
     'Annonces faites au bon moment sans être sollicité, aucune incompréhension.',
     'L''initiative est évaluée : ne pas demander la pression pendant cette plongée, attendre que l''élève l''annonce. Revenir au débriefing sur ce qui n''a pas été dit.'),

    -- ---------- Évoluer en sécurité (bloc 9) ----------
    (9, 'M9.1', 101, 'INITIATION', 'Les procédures du GP au briefing',
     'Au briefing, le GP explique ce qu''il fera en cas de réserve, de froid, de perte de palanquée (chercher une minute, remonter, regroupement en surface) et d''incident. L''élève les reformule.',
     'Procédures reformulées sans erreur.',
     'La perte de palanquée est la situation la plus probable en mer : y insister. Faire reformuler plutôt que demander « c''est compris ? ».'),
    (9, 'M9.2', 102, 'PERFECTIONNEMENT', 'Passage d''octopus à genoux sur le sable',
     'Fond de sable de 3 à 6 m. Le moniteur fait le signe « panne d''air » ; l''élève lui présente son octopus (ou son détendeur, selon la consigne du centre), le tient par la sangle ou le bras, et les deux remontent de quelques mètres ensemble.',
     'Octopus donné sans délai, contact gardé, ventilation calme.',
     'Suivre la consigne du centre (octopus ou détendeur principal donné). Décomposer : donner, se tenir, se stabiliser, puis remonter.'),
    (9, 'M9.3', 103, 'MAITRISE', 'Réagir aux procédures du GP en plongée',
     'Pendant la plongée, le GP déclenche une procédure annoncée au briefing : réserve, froid, retour au bateau, remontée anticipée. L''élève l''applique aussitôt et reste avec la palanquée.',
     'Procédure appliquée sans hésitation, cohésion gardée.',
     'Annoncer au briefing qu''une procédure sera déclenchée, sans dire quand. Varier d''une plongée à l''autre.'),
    (9, 'M9.4', 104, 'MAITRISE', 'Panne d''air simulée en évolution',
     'En pleine eau, à 6 m au plus, pendant un déplacement, le moniteur fait le signe « panne d''air ». L''élève donne son octopus, stabilise le duo et suit la remontée conduite par le moniteur.',
     'Réaction immédiate, passage d''embout réussi, duo stable.',
     'L''élève intervient en relais : c''est le moniteur qui conduit la remontée. Évaluer la réactivité et le contact, pas la vitesse. Toujours annoncé au briefing.'),

    -- ---------- Retourner en surface (bloc 10) ----------
    (10, 'M10.1', 101, 'INITIATION', 'Remontée le long du bout de mouillage',
     'Fin de plongée, main sur le bout, regard sur l''ordinateur : remontée lente (moins de 15 m/min), en purgeant le gilet au fur et à mesure.',
     'Vitesse tenue, gilet purgé, expiration normale.',
     'Le bout donne le repère qui manque en pleine eau. Faire lire la vitesse sur l''ordinateur. Erreur fréquente : oublier de purger dans les derniers mètres, là où le volume varie le plus.'),
    (10, 'M10.2', 102, 'INITIATION', 'Remontée en expiration guidée le long du bout',
     'Au bout de mouillage, départ de 3 m puis de 6 m. Inspiration normale, embout en bouche, remontée lente en soufflant en continu, moniteur en face qui tient l''élève. Gilet gonflé en surface.',
     'Rejet d''air continu jusqu''à la surface, vitesse lente.',
     'Jamais d''inspiration forcée avant le départ. Le moniteur garde la main sur l''élève pour freiner une remontée trop rapide. Faire l''exercice en début de plongée plutôt qu''en fin.'),
    (10, 'M10.3', 103, 'PERFECTIONNEMENT', 'Palier de sécurité au bout',
     'À 3 ou 5 m, palier de 3 minutes en stabilisation à côté du bout, puis lâcher le bout et tenir la profondeur sans repère.',
     'Profondeur tenue à 1 m près pendant tout le palier.',
     'Commencer près du bout, puis s''en écarter. La houle fait varier la profondeur près de la surface : apprendre à corriger au poumon ballast.'),
    (10, 'M10.4', 104, 'MAITRISE', 'Remontée en pleine eau et palier sans repère',
     'Fin de plongée loin du bout. Remontée en palanquée sur consigne du GP, vitesse lue à l''ordinateur, palier de 3 minutes en pleine eau, puis remontée lente jusqu''à la surface.',
     'Vitesse et palier tenus sans repère, palanquée groupée.',
     'Les derniers mètres sont les plus délicats. Si l''élève monte trop vite : purger, s''arrêter, repartir. Valider seulement après une remontée propre complète.'),
    (10, 'M10.5', 105, 'MAITRISE', 'Arrivée en surface en sécurité',
     'Avant l''arrivée, l''élève regarde et écoute (bateaux, hélice), lève un bras au-dessus de la tête, fait un tour d''horizon en surface, gonfle son gilet, puis signale OK au bateau.',
     'Tour d''horizon et gilet gonflé à chaque arrivée, sans rappel.',
     'Le tour d''horizon se perd vite : l''exiger à chaque plongée, même bateau tout proche. Les autres bateaux ne voient pas les plongeurs.'),
    (10, 'M10.6', 106, 'MAITRISE', 'Remontée en expiration contrôlée depuis 6 m',
     'En pleine eau ou à côté du bout, départ stabilisé à 6 m, inspiration normale, remontée en expiration continue, embout en bouche, sans précipitation, moniteur en face.',
     'Rejet continu jusqu''à la surface, vitesse maîtrisée, gilet gonflé en surface.',
     'Pas plus de 6 m, comme le prévoit le N1. Le moniteur reste au contact et peut freiner. En début de plongée plutôt qu''en fin, quand l''élève a encore peu d''azote.')
  ) AS v(bloc_ordre, numero, ordre, phase, intitule, deroulement, critere_reussite, conseils)
    ON v.bloc_ordre = b.ordre
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
   AND NOT EXISTS (SELECT 1 FROM exercice_competence x WHERE x.bloc_id = b.id AND x.numero = v.numero);

-- Critères travaillés : (numéro, ordre du critère dans son bloc, V7).
INSERT INTO exercice_competence_critere (exercice_id, critere_id)
SELECT e.id, c.id
  FROM exercice_competence e
  JOIN bloc_competence b ON b.id = e.bloc_id
  JOIN referentiel r ON r.id = b.referentiel_id
  JOIN critere c ON c.bloc_id = b.id
  JOIN (VALUES
    -- S'équiper : 1 gréage et dégréage, 2 capelage et décapelage, 3 matériel personnel
    ('M1.1', 1), ('M1.2', 2), ('M1.2', 1), ('M1.3', 1), ('M1.3', 2), ('M1.3', 3), ('M1.4', 2),
    -- Mise à l'eau : 1 saut droit, 2 bascule arrière, 3 départ plage, 4 sortir de l'eau
    ('M2.1', 2), ('M2.2', 1), ('M2.3', 3), ('M2.4', 4), ('M2.5', 1), ('M2.5', 2), ('M2.6', 3), ('M2.7', 4),
    -- S'immerger : 1 canard, 2 phoque
    ('M3.1', 2), ('M3.2', 1), ('M3.3', 1), ('M3.3', 2),
    -- Se propulser : 1 ventral, 2 dorsal, 3 sustentation, 4 en immersion, 5 capelé
    ('M4.1', 1), ('M4.1', 2), ('M4.1', 3), ('M4.2', 4), ('M4.3', 5), ('M4.3', 1), ('M4.3', 2),
    ('M4.4', 3), ('M4.4', 1), ('M4.4', 2), ('M4.5', 4),
    -- Se ventiler : 1 en immersion, 2 tuba, 3 masque, 4 lâcher et reprise d'embout
    ('M5.1', 2), ('M5.2', 3), ('M5.3', 4), ('M5.4', 3), ('M5.4', 4), ('M5.5', 1), ('M5.6', 2),
    -- S'équilibrer : 1 gilet, 2 poumon ballast
    ('M6.1', 2), ('M6.2', 1), ('M6.3', 1), ('M6.3', 2),
    -- Milieu : 1 aisance aquatique ; Communiquer : 1 signes
    ('M7.1', 1), ('M7.2', 1), ('M7.3', 1), ('M8.1', 1), ('M8.2', 1), ('M8.3', 1),
    -- Sécurité : 1 procédures du GP, 2 intervention en relais
    ('M9.1', 1), ('M9.2', 2), ('M9.3', 1), ('M9.4', 2),
    -- Retour en surface : 1 vitesse, 2 palier, 3 tour d'horizon, 4 gonflage du gilet, 5 REC
    ('M10.1', 1), ('M10.2', 5), ('M10.3', 2), ('M10.4', 1), ('M10.4', 2), ('M10.5', 3), ('M10.5', 4),
    ('M10.6', 5)
  ) AS v(numero, critere_ordre)
    ON v.numero = e.numero AND v.critere_ordre = c.ordre
 WHERE r.niveau = 'N1' AND r.version_mft = 'PE20 (2025-12)'
   AND NOT EXISTS (SELECT 1 FROM exercice_competence_critere x WHERE x.exercice_id = e.id AND x.critere_id = c.id);

-- ---------- 2. Progressions par plongées ----------

INSERT INTO progression_type (referentiel_id, nom, description, decoupage)
SELECT r.id, v.nom, v.description, 'PLONGEES'
  FROM referentiel r
  JOIN (VALUES
    ('N1', 'PE20 (2025-12)', 'N1 – centre de plongée en mer (6 plongées)',
     'Stage en mer, sans piscine : exercices techniques entre 3 et 6 m, exploration jusqu''à 20 m au plus. Base d''exercices « M » écrite pour la mer. À adapter au centre.'),
    ('N2', 'PA20 | PE40 (2026-05)', 'N2 – centre de plongée en mer (8 plongées)',
     'Stage en mer : PA20 validé sur les plongées 5 et 6, puis zone 20-40 m et PE40 sur les plongées 7 et 8. À adapter au centre.'),
    ('N3', 'PA40 | PE60 (2025-12)', 'N3 – centre de plongée en mer (10 plongées)',
     'Stage en mer : PA40 validé sur les plongées 7 et 8, zone 40-60 m et compétences N3 sur les plongées 9 et 10, sous la responsabilité d''un E4. À adapter au centre.')
  ) AS v(niveau, version_mft, nom, description)
    ON v.niveau = r.niveau AND v.version_mft = r.version_mft;

INSERT INTO periode_progression (progression_id, rang, intitule, plongee_debut, plongee_fin, milieu, note)
SELECT p.id, v.rang, v.intitule, v.debut, v.fin, 'NATUREL', v.note
  FROM progression_type p
  JOIN (VALUES
    ('N1 – centre de plongée en mer (6 plongées)', 1, 'Première plongée en mer', 1, 1,
     '0 à 6 m. S''équiper, entrer et sortir de l''eau, ventiler sur détendeur et sur tuba, les signes. Théorie : matériel, pression et oreilles.'),
    ('N1 – centre de plongée en mer (6 plongées)', 2, 'Immersion, masque et embout', 2, 2,
     '6 m au plus, fond de sable. Phoque et canard, vidage de masque, lâcher et reprise d''embout, premiers pas du poumon ballast.'),
    ('N1 – centre de plongée en mer (6 plongées)', 3, 'Équilibre et vie de palanquée', 3, 3,
     '12 m au plus. Immersion sur consigne, stabilisation au gilet, palier, octopus. Théorie : barotraumatismes, flottabilité.'),
    ('N1 – centre de plongée en mer (6 plongées)', 4, 'Sécurité et retour en surface', 4, 4,
     '15 m au plus. Masque et embout en pleine eau, procédures du GP, panne d''air simulée, remontée et palier sans repère, REC depuis 6 m.'),
    ('N1 – centre de plongée en mer (6 plongées)', 5, 'Plongées de validation, jusqu''à 20 m', 5, 6,
     'Exploration jusqu''à 20 m, exercices de validation entre 3 et 6 m. Théorie : désaturation, réglementation, prérogatives du N1.'),

    ('N2 – centre de plongée en mer (8 plongées)', 1, 'Plongée de reprise et bilan', 1, 1,
     '20 m au plus. Matériel, mises à l''eau, immersion et ventilation du N1 revues, signes et paramètres annoncés au GP.'),
    ('N2 – centre de plongée en mer (8 plongées)', 2, 'Stabilisation, remontée, communication', 2, 2,
     '20 m au plus. Palmage économique, stabilisation sans appui, REC guidée, paliers et paramètres de désaturation.'),
    ('N2 – centre de plongée en mer (8 plongées)', 3, 'Assistance et relais', 3, 3,
     '20 m au plus. Reconnaître une difficulté, remontée assistée au gilet, passage d''octopus, relais vers le GP.'),
    ('N2 – centre de plongée en mer (8 plongées)', 4, 'Autonomie à 20 m : planifier et s''orienter', 4, 4,
     '20 m au plus. Ordinateur, parachute, compas, consignes du DP, plongée en autonomie surveillée. Théorie PA20.'),
    ('N2 – centre de plongée en mer (8 plongées)', 5, 'Validation PA20', 5, 6,
     'Plongées en autonomie à 20 m au plus, sous la surveillance d''un E3 : validation des compétences communes et PA20, assistance en dernier.'),
    ('N2 – centre de plongée en mer (8 plongées)', 6, 'PE40 : zone 20-40 m et validation', 7, 8,
     'Plongées encadrées entre 20 et 40 m : ventilation et stabilisation en profondeur, communication, retour en surface, relais en dernier. Théorie PE40.'),

    ('N3 – centre de plongée en mer (10 plongées)', 1, 'Reprise et planification', 1, 2,
     '30 m au plus. Consignes du DP, étude du site, calculs pour la zone 20-40 m, orientation, surveillance mutuelle, stabilisation fine.'),
    ('N3 – centre de plongée en mer (10 plongées)', 2, 'Assistance en profondeur', 3, 4,
     '30 m au plus. Reconnaître une difficulté en profondeur, assistance au gilet depuis 20 puis 30 m, nage capelée, sensations en profondeur.'),
    ('N3 – centre de plongée en mer (10 plongées)', 3, 'Autonomie et organisation jusqu''à 40 m', 5, 6,
     '40 m au plus. Parcours varié en autonomie, paliers sous parachute, descente et remontée jusqu''à 40 m, organisation de la plongée et plan de secours.'),
    ('N3 – centre de plongée en mer (10 plongées)', 4, 'Validation PA40', 7, 8,
     'Plongées en autonomie jusqu''à 40 m, évaluées par un E3 : planification, autonomie, assistance à 40 m, respect du milieu.'),
    ('N3 – centre de plongée en mer (10 plongées)', 5, 'PE60 et compétences N3', 9, 10,
     'Zone 40-60 m, progressivement et sous la responsabilité d''un E4. Organiser une plongée, autonomie de 0 à 60 m, désaturation en zone profonde.')
  ) AS v(progression, rang, intitule, debut, fin, note)
    ON v.progression = p.nom
 WHERE p.decoupage = 'PLONGEES'
   AND NOT EXISTS (SELECT 1 FROM periode_progression x WHERE x.progression_id = p.id AND x.rang = v.rang);

-- Blocs de chaque étape, désignés par leur ordre dans le référentiel : ils font l'échéance de
-- chaque compétence (dernière plongée de la dernière étape qui la contient).
INSERT INTO periode_progression_bloc (periode_id, bloc_id)
SELECT pp.id, b.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN bloc_competence b ON b.referentiel_id = p.referentiel_id
  JOIN (VALUES
    ('N1', 1, 1), ('N1', 1, 2), ('N1', 1, 5), ('N1', 1, 8), ('N1', 1, 11),
    ('N1', 2, 1), ('N1', 2, 2), ('N1', 2, 3), ('N1', 2, 4), ('N1', 2, 5), ('N1', 2, 8),
    ('N1', 3, 3), ('N1', 3, 4), ('N1', 3, 6), ('N1', 3, 8), ('N1', 3, 9), ('N1', 3, 10),
    ('N1', 4, 5), ('N1', 4, 6), ('N1', 4, 7), ('N1', 4, 9), ('N1', 4, 10),
    ('N1', 5, 1), ('N1', 5, 2), ('N1', 5, 4), ('N1', 5, 6), ('N1', 5, 7), ('N1', 5, 9), ('N1', 5, 10), ('N1', 5, 11),

    ('N2', 1, 1), ('N2', 1, 2), ('N2', 1, 4), ('N2', 1, 8), ('N2', 1, 9),
    ('N2', 2, 2), ('N2', 2, 3), ('N2', 2, 8), ('N2', 2, 9), ('N2', 2, 10),
    ('N2', 3, 7), ('N2', 3, 10), ('N2', 3, 11),
    ('N2', 4, 4), ('N2', 4, 5), ('N2', 4, 6), ('N2', 4, 12),
    ('N2', 5, 1), ('N2', 5, 2), ('N2', 5, 3), ('N2', 5, 4), ('N2', 5, 5), ('N2', 5, 6), ('N2', 5, 7), ('N2', 5, 12),
    ('N2', 6, 8), ('N2', 6, 9), ('N2', 6, 10), ('N2', 6, 11), ('N2', 6, 13),

    ('N3', 1, 1), ('N3', 1, 2), ('N3', 1, 7), ('N3', 1, 8),
    ('N3', 2, 3), ('N3', 2, 4),
    ('N3', 3, 2), ('N3', 3, 4), ('N3', 3, 5), ('N3', 3, 6), ('N3', 3, 7),
    ('N3', 4, 1), ('N3', 4, 2), ('N3', 4, 3), ('N3', 4, 7), ('N3', 4, 8),
    ('N3', 5, 4), ('N3', 5, 5), ('N3', 5, 6), ('N3', 5, 8)
  ) AS v(niveau, rang, bloc_ordre)
    ON v.rang = pp.rang AND v.bloc_ordre = b.ordre
  JOIN referentiel r ON r.id = p.referentiel_id AND r.niveau = v.niveau
 WHERE p.decoupage = 'PLONGEES' AND p.nom LIKE '% – centre de plongée en mer (%'
   AND NOT EXISTS (SELECT 1 FROM periode_progression_bloc x WHERE x.periode_id = pp.id AND x.bloc_id = b.id);

-- Exercices de chaque étape : le parcours, de l'initiation à la maîtrise.
INSERT INTO periode_progression_exercice (periode_id, exercice_id)
SELECT pp.id, e.id
  FROM periode_progression pp
  JOIN progression_type p ON p.id = pp.progression_id
  JOIN referentiel r ON r.id = p.referentiel_id
  JOIN bloc_competence b ON b.referentiel_id = r.id
  JOIN exercice_competence e ON e.bloc_id = b.id
  JOIN (VALUES
    ('N1', 1, 'M1.1'), ('N1', 1, 'M1.2'), ('N1', 1, 'M2.1'), ('N1', 1, 'M2.2'), ('N1', 1, 'M2.4'),
    ('N1', 1, 'M3.1'), ('N1', 1, 'M4.1'), ('N1', 1, 'M5.1'), ('N1', 1, 'M7.1'), ('N1', 1, 'M8.1'),
    ('N1', 1, 'M9.1'), ('N1', 1, 'M10.1'),
    ('N1', 2, 'M2.3'), ('N1', 2, 'M3.2'), ('N1', 2, 'M4.2'), ('N1', 2, 'M5.2'), ('N1', 2, 'M5.3'),
    ('N1', 2, 'M6.1'), ('N1', 2, 'M8.2'), ('N1', 2, 'M10.2'),
    ('N1', 3, 'M1.4'), ('N1', 3, 'M3.3'), ('N1', 3, 'M6.2'), ('N1', 3, 'M7.2'), ('N1', 3, 'M8.3'),
    ('N1', 3, 'M9.2'), ('N1', 3, 'M10.3'),
    ('N1', 4, 'M4.4'), ('N1', 4, 'M5.4'), ('N1', 4, 'M5.6'), ('N1', 4, 'M9.3'), ('N1', 4, 'M9.4'),
    ('N1', 4, 'M10.4'), ('N1', 4, 'M10.5'), ('N1', 4, 'M10.6'),
    ('N1', 5, 'M1.3'), ('N1', 5, 'M2.5'), ('N1', 5, 'M2.6'), ('N1', 5, 'M2.7'), ('N1', 5, 'M4.3'),
    ('N1', 5, 'M4.5'), ('N1', 5, 'M5.5'), ('N1', 5, 'M6.3'), ('N1', 5, 'M7.3'),

    ('N2', 1, '1.1'), ('N2', 1, '1.2'), ('N2', 1, '1.3'), ('N2', 1, '2.1'), ('N2', 1, '2.2'),
    ('N2', 1, '3.3'), ('N2', 1, '4.1'), ('N2', 1, '4.2'), ('N2', 1, '4.3'), ('N2', 1, '8.1'),
    ('N2', 1, '8.2'), ('N2', 1, '8.3'), ('N2', 1, '9.1'), ('N2', 1, '9.2'), ('N2', 1, '9.3'),
    ('N2', 2, '1.4'), ('N2', 2, '1.5'), ('N2', 2, '2.3'), ('N2', 2, '2.4'), ('N2', 2, '2.5'),
    ('N2', 2, '3.1'), ('N2', 2, '3.2'), ('N2', 2, '8.4'), ('N2', 2, '8.6'), ('N2', 2, '9.4'),
    ('N2', 2, '9.5'), ('N2', 2, '10.1'), ('N2', 2, '10.2'), ('N2', 2, '10.3'),
    ('N2', 3, '1.6'), ('N2', 3, '2.6'), ('N2', 3, '7.1'), ('N2', 3, '7.2'), ('N2', 3, '7.3'),
    ('N2', 3, '10.4'), ('N2', 3, '11.1'), ('N2', 3, '11.2'), ('N2', 3, '11.3'),
    ('N2', 4, '3.4'), ('N2', 4, '3.5'), ('N2', 4, '3.6'), ('N2', 4, '4.4'), ('N2', 4, '4.5'),
    ('N2', 4, '4.6'), ('N2', 4, '5.1'), ('N2', 4, '5.2'), ('N2', 4, '5.3'), ('N2', 4, '5.4'),
    ('N2', 4, '5.5'), ('N2', 4, '5.6'), ('N2', 4, '6.1'), ('N2', 4, '6.2'), ('N2', 4, '6.3'),
    ('N2', 4, '6.4'), ('N2', 4, '6.5'), ('N2', 4, '6.6'), ('N2', 4, '7.4'), ('N2', 4, '7.5'),
    ('N2', 4, '7.6'),
    ('N2', 5, '1.7'), ('N2', 5, '1.8'), ('N2', 5, '1.9'), ('N2', 5, '2.7'), ('N2', 5, '2.8'),
    ('N2', 5, '2.9'), ('N2', 5, '3.7'), ('N2', 5, '3.8'), ('N2', 5, '3.9'), ('N2', 5, '4.7'),
    ('N2', 5, '4.8'), ('N2', 5, '4.9'), ('N2', 5, '5.7'), ('N2', 5, '5.8'), ('N2', 5, '5.9'),
    ('N2', 5, '6.7'), ('N2', 5, '6.8'), ('N2', 5, '6.9'), ('N2', 5, '7.7'), ('N2', 5, '7.8'),
    ('N2', 5, '7.9'),
    ('N2', 6, '8.5'), ('N2', 6, '8.7'), ('N2', 6, '8.8'), ('N2', 6, '8.9'), ('N2', 6, '9.6'),
    ('N2', 6, '9.7'), ('N2', 6, '9.8'), ('N2', 6, '9.9'), ('N2', 6, '10.5'), ('N2', 6, '10.6'),
    ('N2', 6, '10.7'), ('N2', 6, '10.8'), ('N2', 6, '10.9'), ('N2', 6, '11.4'), ('N2', 6, '11.5'),
    ('N2', 6, '11.6'), ('N2', 6, '11.7'), ('N2', 6, '11.8'), ('N2', 6, '11.9'),

    ('N3', 1, '1.1'), ('N3', 1, '1.2'), ('N3', 1, '1.3'), ('N3', 1, '1.4'), ('N3', 1, '1.5'),
    ('N3', 1, '1.6'), ('N3', 1, '2.1'), ('N3', 1, '2.2'), ('N3', 1, '2.3'), ('N3', 1, '7.1'),
    ('N3', 1, '7.2'), ('N3', 1, '7.3'),
    ('N3', 2, '3.1'), ('N3', 2, '3.2'), ('N3', 2, '3.3'), ('N3', 2, '3.4'), ('N3', 2, '3.5'),
    ('N3', 2, '3.6'), ('N3', 2, '4.1'), ('N3', 2, '4.2'), ('N3', 2, '4.3'),
    ('N3', 3, '2.4'), ('N3', 3, '2.5'), ('N3', 3, '2.6'), ('N3', 3, '4.4'), ('N3', 3, '4.5'),
    ('N3', 3, '4.6'), ('N3', 3, '5.1'), ('N3', 3, '5.2'), ('N3', 3, '5.3'), ('N3', 3, '5.4'),
    ('N3', 3, '5.5'), ('N3', 3, '5.6'), ('N3', 3, '6.1'), ('N3', 3, '6.2'), ('N3', 3, '6.3'),
    ('N3', 3, '6.4'), ('N3', 3, '6.5'), ('N3', 3, '6.6'), ('N3', 3, '7.4'), ('N3', 3, '7.5'),
    ('N3', 3, '7.6'),
    ('N3', 4, '1.7'), ('N3', 4, '1.8'), ('N3', 4, '1.9'), ('N3', 4, '2.7'), ('N3', 4, '2.8'),
    ('N3', 4, '2.9'), ('N3', 4, '3.7'), ('N3', 4, '3.8'), ('N3', 4, '3.9'), ('N3', 4, '4.7'),
    ('N3', 4, '7.7'), ('N3', 4, '7.8'), ('N3', 4, '7.9'),
    ('N3', 5, '4.8'), ('N3', 5, '4.9'), ('N3', 5, '5.7'), ('N3', 5, '5.8'), ('N3', 5, '5.9'),
    ('N3', 5, '6.7'), ('N3', 5, '6.8'), ('N3', 5, '6.9')
  ) AS v(niveau, rang, numero)
    ON v.niveau = r.niveau AND v.rang = pp.rang AND v.numero = e.numero
 WHERE p.decoupage = 'PLONGEES' AND p.nom LIKE '% – centre de plongée en mer (%'
   AND NOT EXISTS (SELECT 1 FROM periode_progression_exercice x WHERE x.periode_id = pp.id AND x.exercice_id = e.id);
