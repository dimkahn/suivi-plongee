#!/usr/bin/env python3
"""
Génère la migration Flyway du référentiel MFT (plongeur N1, N2, N3).

Le référentiel est décrit ici sous forme de données pour pouvoir être
régénéré à chaque révision du MFT sans toucher au code de l'application.
Les intitulés de compétences sont ceux du MFT ; les critères de réalisation
sont volontairement condensés — remplace-les par le texte intégral du MFT
si tu veux que tes moniteurs lisent le libellé officiel dans l'appli.

Source : https://mft.readthedocs.io/fr/latest/ (CTN FFESSM)
Usage   : python3 generer_referentiel.py > ../backend/src/main/resources/db/migration/V2__referentiel_mft.sql

Chaque bloc est un tuple (code, intitule, transverse, en_dernier, criteres) ou,
depuis la revision PE20 (decembre 2025) du N1 qui a abandonne les codes C1-C9
au profit de competences nommees structurees en Technique/Comportement/
Theorie/Modalites d'evaluation, un tuple a six elements dont le dernier est un
dict optionnel {competence_attendue, comportement, theorie,
modalites_evaluation, regroupement} porte par bloc_competence (colonnes
ajoutees en V7 et V8). `regroupement` est un simple libelle d'affichage
("Commun", "PA20", "PE40", ...) pour les niveaux qui, depuis mai/decembre
2026, se scindent en plusieurs qualifications (N2 = PA20 + PE40, N3 = PA40 +
PE60 + competences complementaires) fusionnees ici en un seul referentiel par
niveau (pas de suivi separe par qualification, voir CLAUDE.md). Format
volontairement variable pour ne pas retoucher les blocs deja migres.
"""

REFERENTIELS = [
    {
        "niveau": "N1",
        "version": "2016-11-15",
        "date_application": "2016-11-15",
        "age_minimum": 14,
        "prerequis": None,
        "qualification": None,
        "milieu_naturel_exclusif": False,
        "encadrant_validation": "E1",
        "encadrant_delivrance": "E3",
        "prof_validation": 6,
        "prof_formation": 20,
        "prerogative": 20,
        "blocs": [
            ("C1", "Utiliser l'équipement de plongée", False, False, [
                ("S'équiper du matériel individuel.",
                 "Choisit un équipement et un lestage adaptés aux conditions et à la nature de la plongée."),
                ("Gréer et dégréer l'ensemble bloc / gilet / détendeur.",
                 "Monte le matériel sans erreur et effectue les réglages nécessaires."),
                ("Tester et vérifier le fonctionnement de l'équipement.",
                 "Contrôle le bon fonctionnement, vérifie la quantité d'air, ajuste son lestage, signale tout défaut."),
                ("Entretenir le matériel.",
                 "Rince avec les précautions d'usage, sait décontaminer un détendeur, range correctement."),
                ("Embarquer sur un navire support de plongée.",
                 "Porte et range son équipement sans risque pour lui-même et son entourage."),
            ]),
            ("C2", "Évoluer en environnement aquatique et subaquatique", False, False, [
                ("Se mettre à l'eau et remonter sur le support.",
                 "Utilise une technique adaptée au support et aux conditions ; prévient les incidents de cette phase."),
                ("S'immerger.",
                 "Choisit une technique d'immersion adaptée au contexte et équilibre ses oreilles."),
                ("Se déplacer en surface et en immersion.",
                 "Palmage adapté au contexte ; une distance d'environ 50 m doit pouvoir être parcourue."),
                ("Se ventiler en surface et en immersion.",
                 "Utilise tuba ou détendeur selon le besoin ; ne bloque pas l'expiration à la remontée (REC de 6 m)."),
                ("Éliminer l'eau du masque en immersion.",
                 "Maintient une ventilation normale au contact de l'eau et évacue l'eau sans stress."),
                ("S'équilibrer en surface et à toute profondeur.",
                 "Ajuste sa flottabilité au gilet et au poumon-ballast, en statique comme en dynamique."),
            ]),
            ("C3", "Évoluer en palanquée guidée", False, False, [
                ("Comprendre et respecter les consignes du GP.",
                 "Applique sans erreur les conditions d'évolution fixées ; interroge le GP en cas de doute."),
                ("Surveiller son stock d'air.",
                 "Suit la pression du bloc et informe le GP aux valeurs convenues."),
                ("Se positionner selon les situations et les conditions.",
                 "Reste au contact du GP et des équipiers, se place dans son champ de vision en cas d'intervention."),
                ("Assurer sa remontée en palanquée.",
                 "Respecte la vitesse de remontée et les paliers éventuels, avec ou sans appui."),
            ]),
            ("C6", "Participer à la sécurité en plongée", False, False, [
                ("Connaître les risques de l'activité et leur prévention.",
                 "Cite pour lui-même les mesures de prévention et les procédures de sécurité courantes."),
                ("Demander et recevoir l'aide du GP ou d'un équipier.",
                 "Demande de l'aide dès que nécessaire, assure sa flottabilité, adopte un comportement conforme."),
                ("Gérer une remontée isolée après perte de palanquée.",
                 "Remonte à vitesse normale, tour d'horizon, se signale en surface et attend une prise en charge."),
                ("Prendre en charge un équipier en difficulté en attendant le GP.",
                 "Réagit au signe conventionnel, évite d'augmenter la profondeur, fournit air ou aide adaptée (simulation)."),
            ]),
            ("C7", "Connaître et respecter l'environnement marin", False, False, [
                ("Évoluer en limitant son impact sur le milieu.",
                 "Maîtrise flottabilité et palmage, évite tout contact avec la faune et la flore, ne nourrit ni ne harcèle."),
                ("Développer sa capacité d'observation.",
                 "Évite les gestes brusques, approche discrètement, échange avec le GP après la plongée."),
                ("Connaître la charte internationale du plongeur responsable.",
                 "Applique les gestes et attitudes décrits dans la charte."),
                ("Reconnaître les principales espèces rencontrées.",
                 "Décrit et nomme les animaux couramment observés pendant la formation."),
            ]),
            ("C8", "Connaissances en appui des compétences", True, False, [
                ("Équipement du plongeur : rôles, montage, entretien, hygiène.",
                 "S'équipe sans erreur, règle et teste le matériel, identifie et signale les dysfonctionnements."),
                ("Procédures de désaturation.",
                 "Connaît la courbe de plongée sans palier et les différents moyens de désaturation."),
                ("Risques de l'activité, prévention et bonnes pratiques.",
                 "Cite les principaux risques et les mesures de prévention, avec des notions de physique simples."),
                ("Réglementation relative à l'activité.",
                 "Prérogatives du N1, documents nécessaires, carnet et passeport de plongée, cadre fédéral."),
            ]),
        ],
    },
    {
        # PE20, version decembre 2025 : revision qui abandonne les codes C1-C9
        # au profit de dix competences nommees (voir docstring du module).
        "niveau": "N1",
        "version": "PE20 (2025-12)",
        "source": "Manuel de Formation Technique - Plongeur Niveau 1 - PE20, "
                  "Commission Technique Nationale FFESSM, version decembre 2025",
        "date_application": "2025-12-01",
        "age_minimum": 12,
        "prerequis": None,
        "qualification": None,
        "milieu_naturel_exclusif": False,
        "encadrant_validation": "E1",
        "encadrant_delivrance": "E3",
        "prof_validation": 6,
        "prof_formation": 20,
        "prerogative": 20,
        "blocs": [
            ("B1", "S'équiper et se déséquiper", False, False, [
                ("Gréage et dégréage",
                 "Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, "
                 "vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du "
                 "gilet et du détendeur. Équipement en surface et dans l'eau, lestage approprié au milieu "
                 "(eau douce, eau salée) et au matériel."),
                ("Capelage et décapelage",
                 "Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, "
                 "vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du "
                 "gilet et du détendeur. Équipement en surface et dans l'eau, lestage approprié au milieu "
                 "(eau douce, eau salée) et au matériel."),
                ("Choix de son matériel personnel",
                 "Gréage et dégréage de son équipement (bouteille, gilet stabilisateur et détendeur) sans erreur, "
                 "vérification de la pression de la bouteille avant utilisation ainsi que du bon fonctionnement du "
                 "gilet et du détendeur. Équipement en surface et dans l'eau, lestage approprié au milieu "
                 "(eau douce, eau salée) et au matériel."),
            ], {
                "competence_attendue": "Le plongeur est capable de mettre en œuvre son équipement de manière "
                                        "autonome et d'en vérifier le bon fonctionnement.",
                "comportement": "Le plongeur est autonome dans la mise en œuvre et l'utilisation du matériel. "
                                "Il respecte les consignes de sécurité. Il développe les notions de palanquée, "
                                "d'entraide et de solidarité entre les plongeurs.",
                "theorie": "Prévention des accidents liés aux chutes de la bouteille et des équipements sous "
                           "pression. Connaissance des règles d'entretien et d'hygiène du matériel (signalement "
                           "d'un dysfonctionnement, rinçage, désinfection, ...). Notions de flottabilité en "
                           "rapport avec le lestage.",
                "modalites_evaluation": "Le plongeur est capable de gérer son équipement sans l'assistance de "
                                        "l'encadrant. Il a un comportement adapté au contexte d'une palanquée. "
                                        "Il est capable de s'équiper au sec comme dans l'eau de manière autonome. "
                                        "Il met en œuvre les précautions d'usage pour éviter les accidents.",
            }),
            ("B2", "Se mettre à l'eau et sortir de l'eau", False, False, [
                ("Saut droit",
                 "Maîtrise des techniques de mise à l'eau en scaphandre comme en plongée libre."),
                ("Bascule arrière",
                 "Maîtrise des techniques de mise à l'eau en scaphandre comme en plongée libre."),
                ("Départ plage",
                 "Maîtrise des techniques de mise à l'eau en scaphandre comme en plongée libre."),
                ("Sortir de l'eau",
                 "Retrait de l'ensemble bloc-gilet en surface et passage à un support de plongée."),
            ], {
                "competence_attendue": "Le plongeur est capable de se mettre à l'eau et d'en sortir en sécurité "
                                        "pour lui et pour les autres plongeurs selon les modalités définies par "
                                        "le guide de palanquée.",
                "comportement": "Le plongeur se met à l'eau et sort de l'eau dans le souci de sa sécurité et de "
                                "celle des autres. Son comportement est adapté au contexte de la plongée et au "
                                "type d'embarcation (pneumatique, barge, chalutier,...) Il est attentif et "
                                "respecte les consignes du DP (communication, vérifications des sécurités "
                                "d'usage,...).",
                "theorie": "Prévention des accidents, sensibilisation aux risques liés à la mise en œuvre des "
                           "différentes techniques (chutes, percussion du bateau ou d'un autre plongeur) en "
                           "fonction des conditions (hauteur, courant,...).",
                "modalites_evaluation": "Le plongeur démontre sa capacité à se mettre à l'eau et à en sortir dans "
                                        "le respect des consignes du DP. Les techniques les plus usuelles sont "
                                        "maîtrisées. Les situations d'apprentissage et d'évaluation en milieu "
                                        "artificiel doivent être les plus proches possible de la réalité "
                                        "(constitution de la palanquée, consignes du DP et mise en œuvre).",
            }),
            ("B3", "Évoluer dans l'eau - S'immerger", False, False, [
                ("Canard",
                 "Maîtrise des deux techniques du phoque et du canard en scaphandre et en plongée libre. "
                 "Utilisation d'un lestage adapté : recherche essentielle de l'équilibre à 3 m."),
                ("Phoque",
                 "Maîtrise des deux techniques du phoque et du canard en scaphandre et en plongée libre. "
                 "Utilisation d'un lestage adapté : recherche essentielle de l'équilibre à 3 m."),
            ], {
                "competence_attendue": "Le plongeur est capable de s'immerger selon la technique définie par le "
                                        "GP dans le respect de ses consignes.",
                "comportement": "Le plongeur adopte un comportement adapté à la demande du GP et dans le respect "
                                "de ses consignes.",
                "theorie": "Prévention des barotraumatismes de l'oreille, des sinus et du plaquage de masque. "
                           "Flottabilité en lien avec la ventilation et le poumon ballast.",
                "modalites_evaluation": "Les deux techniques du canard et du phoque doivent être maitrisées, le "
                                        "N1 doit être capable de s'immerger rapidement à la commande, en suivant "
                                        "les indications du GP.",
            }),
            ("B4", "Évoluer dans l'eau - Se propulser", False, False, [
                ("Palmage ventral en surface",
                 "Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, "
                 "dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l'efficacité "
                 "du geste technique doivent être privilégiées, la performance n'est pas une priorité."),
                ("Palmage dorsal",
                 "Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, "
                 "dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l'efficacité "
                 "du geste technique doivent être privilégiées, la performance n'est pas une priorité."),
                ("Palmage de sustentation",
                 "Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, "
                 "dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l'efficacité "
                 "du geste technique doivent être privilégiées, la performance n'est pas une priorité."),
                ("Palmage en immersion",
                 "Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, "
                 "dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l'efficacité "
                 "du geste technique doivent être privilégiées, la performance n'est pas une priorité."),
                ("Nage en capelé",
                 "Maîtrise des différentes techniques de palmage : palmage de surface (sustentation, ventral, "
                 "dorsal et costal), palmage en immersion, nage capelée. La qualité de réalisation et l'efficacité "
                 "du geste technique doivent être privilégiées, la performance n'est pas une priorité."),
            ], {
                "competence_attendue": "Le plongeur assure ses déplacements de manière autonome en surface comme "
                                        "en immersion.",
                "comportement": "Le plongeur maîtrise la gestion de son effort, il a le souci de l'unité de la "
                                "palanquée (entraide et cohésion). Il se maintient à proximité du GP en "
                                "respectant la profondeur et les consignes données.",
                "theorie": "La notion d'appui de la surface de la palme et le principe du bras de levier doivent "
                           "venir en soutien dans les explications du geste technique. Présentation des "
                           "différents types de palmes. Prévention de l'essoufflement, gestion de la "
                           "consommation.",
                "modalites_evaluation": "Les deux types de nage de surface doivent être évalués sur des "
                                        "distances de l'ordre de 100 m pour le PMT et 50 m pour le capelé "
                                        "(simulation de retour au bateau). La qualité et l'efficacité du geste "
                                        "technique demeurent les principaux critères d'évaluation. Il n'y a pas "
                                        "d'épreuve chronométrée au N1, la capacité à effectuer un parcours en "
                                        "surface dans de bonnes conditions physiques (absence d'essoufflement) "
                                        "doit être le seul critère de performance.",
            }),
            ("B5", "Évoluer dans l'eau - Se ventiler", False, False, [
                ("Ventilation en immersion",
                 "Maîtrise et régulation de la ventilation en immersion (fréquence, amplitude et ventilation "
                 "normale dans le volume courant)."),
                ("Ventilation sur tuba et vidage du tuba",
                 "Maîtrise de la ventilation en surface sur tuba et du vidage du tuba."),
                ("Vidage du masque",
                 "Vidage du masque par évacuation de l'eau en introduisant l'air par le nez et maintien d'une "
                 "ventilation normale au contact de l'eau."),
                ("Lâcher et reprise d'embout",
                 "Maîtrise du lâcher-reprise d'embout et des deux techniques : vidage par expiration et "
                 "utilisation du bouton de surpression. Réalisation d'une apnée (profondeur et distance "
                 "modérées)."),
            ], {
                "competence_attendue": "Le plongeur gère et adapte sa ventilation, il réagit sereinement à une "
                                        "entrée volontaire ou accidentelle d'eau dans son masque.",
                "comportement": "Le plongeur adapte son rythme ventilatoire, il maîtrise sa ventilation et la "
                                "maintient dans la zone de confort, il s'autocontrôle par des apnées de "
                                "contrôle. Le plongeur vide son masque sans stress dans des situations variées. "
                                "Il maîtrise sa ventilation dans la phase de remontée en prévention des "
                                "barotraumatismes.",
                "theorie": "Prévention des accidents : notions simples de physique pour expliquer les "
                           "barotraumatismes de l'oreille et leur prévention (Valsalva, BTV, Frenzel), des sinus "
                           "et du plaquage de masque. Prévention de la noyade. Consommation : notions simples de "
                           "physique pour expliquer la consommation en air et sa répercussion sur la "
                           "flottabilité.",
                "modalites_evaluation": "Le plongeur montre sa capacité à gérer et réguler sa ventilation dans un "
                                        "contexte d'effort normal à modéré (faire face à un léger courant, "
                                        "retourner au bateau). Il est capable de faire, sans difficultés, des "
                                        "déplacements courts en apnée (quelques mètres en apnée inspiratoire et "
                                        "expiratoire). Il est capable de vider son masque dans des situations "
                                        "variées et sans stress (pas de situation brutale de nature à générer de "
                                        "l'insécurité). L'évaluation se fait dans la zone de 0 à 6 m.",
            }),
            ("B6", "Évoluer dans l'eau - S'équilibrer", False, False, [
                ("Gestion du gilet de stabilisation",
                 "Maîtrise de la technique du poumon ballast et utilisation du gilet pour s'équilibrer : "
                 "utilisation de l'inflateur et des différentes purges. Maîtrise de la combinaison des deux "
                 "techniques."),
                ("Poumon ballast",
                 "Maîtrise de la technique du poumon ballast et utilisation du gilet pour s'équilibrer : "
                 "utilisation de l'inflateur et des différentes purges. Maîtrise de la combinaison des deux "
                 "techniques."),
            ], {
                "competence_attendue": "Le plongeur gère sa stabilité grâce au poumon ballast et au gilet de "
                                        "stabilisation de manière autonome.",
                "comportement": "Le plongeur se met en situation d'équilibre à la demande, il est réactif et "
                                "ajuste son réglage en fonction des variations de profondeur. Il est capable de "
                                "maintenir une profondeur stable sur poumon ballast.",
                "theorie": "Notions de flottabilité (positive, négative, neutre) en lien avec la ventilation et "
                           "le poumon ballast. Informations sur les éléments permettant à l'élève de trouver son "
                           "lestage.",
                "modalites_evaluation": "Le plongeur s'équilibre à la demande du GP. Les situations d'évaluation "
                                        "doivent être variées. La compétence est évaluée de manière répétitive, "
                                        "la performance du plongeur est contrôlée dans des situations statique "
                                        "et dynamique avec une variation de plus ou moins 1 mètre.",
            }),
            ("B7", "Respecter le milieu et l'environnement", False, False, [
                ("Aisance aquatique",
                 "Réalisation de déplacements équilibrés, sans appui, avec un palmage et une stabilisation "
                 "maîtrisés."),
            ], {
                "competence_attendue": "Le plongeur adopte une attitude éco-responsable, il évolue dans le "
                                        "respect de l'environnement subaquatique et en connaissance du milieu.",
                "comportement": "Le plongeur évolue en limitant son impact sur l'environnement. Il développe sa "
                                "capacité d'observation.",
                "theorie": "Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). "
                           "Connaissances liées au respect de l'environnement, à l'impact du plongeur sur le "
                           "milieu (respect de la tranquillité de la faune, absence de dégradation). "
                           "Présentation de la Charte internationale du plongeur responsable. Froid et dangers "
                           "du milieu : connaissance des risques et de la prévention.",
                "modalites_evaluation": "Au cours des plongées en milieu naturel, le comportement respectueux et "
                                        "responsable du plongeur est évalué.",
            }),
            ("B8", "Communiquer", False, False, [
                ("Exécution des signes conventionnels",
                 "Identification et réalisation de l'ensemble des signes conventionnels : OK, monter, descendre, "
                 "ça ne va pas, mi-pression, réserve, panne d'air, essoufflement, froid, fin de "
                 "plongée/d'exercice."),
            ], {
                "competence_attendue": "Le plongeur est en mesure de comprendre et d'échanger les informations "
                                        "utiles à la gestion de la plongée avec le GP et les autres plongeurs.",
                "comportement": "Le plongeur est attentif et réactif, il sait anticiper les gestes et prendre "
                                "l'initiative de communiquer sans attendre le questionnement du GP, il est "
                                "rigoureux dans l'exécution des signes.",
                "theorie": "Connaissance des signes et des réponses possibles.",
                "modalites_evaluation": "Les deux aspects de la communication sont évalués, compréhension et "
                                        "réalisation. Les situations d'évaluation doivent être variées "
                                        "(statiques, dynamiques, individuelles ou en palanquée). L'exactitude et "
                                        "la promptitude de la réalisation des gestes est attendue. Le plongeur "
                                        "doit être efficace dans sa communication.",
            }),
            ("B9", "Évoluer en sécurité", False, False, [
                ("Application des procédures mises en œuvre par le GP",
                 "Application des procédures mises en œuvre par le GP. Familiarisation avec les procédures "
                 "usuelles mises en œuvre par le GP : réserve, froid. Familiarisation avec la mise en œuvre des "
                 "procédures en situation d'incident : panne d'air (réalisation d'une apnée expiratoire sur une "
                 "distance de 10 m à l'horizontale, utilisation de l'octopus du GP), essoufflement, crampe, "
                 "malaise."),
                ("Intervention en relais",
                 "Intervention en relais auprès d'un équipier en difficulté : passage de l'octopus et simulation "
                 "d'échange d'embout en cas de panne d'air."),
            ], {
                "competence_attendue": "Le plongeur est familiarisé à la mise en œuvre des procédures liées aux "
                                        "différentes situations auxquelles il est confronté.",
                "comportement": "Le plongeur sait réagir aux différentes situations. Il exécute la procédure "
                                "demandée sans hésitation, de manière automatique et sans erreur. Il accepte la "
                                "procédure du guide de palanquée calmement. Il interprète le signe correctement, "
                                "l'action est immédiate : apport d'une source d'air, aide à l'équipier, "
                                "sollicitation du GP.",
                "theorie": "Protocoles et procédures : connaissance des codes de communication et des réponses "
                           "possibles dans le cadre de procédures normales et anormales. Règle en cas de perte de "
                           "palanquée.",
                "modalites_evaluation": "L'ensemble des situations nécessitant une intervention du GP doit être "
                                        "évalué. Le plongeur est familiarisé avec la procédure mise en œuvre par "
                                        "le GP, il l'accepte en gardant son calme. L'accoutumance doit reposer "
                                        "sur la répétition et la variété des situations d'évaluation.",
            }),
            ("B10", "Retourner en surface", False, False, [
                ("Maîtrise de la vitesse de remontée",
                 "Maîtrise de la vitesse de remontée en utilisant les palmes et le gilet (avec et sans repères "
                 "visuels)."),
                ("Tenue d'un palier",
                 "Tenue d'un palier y compris en pleine eau."),
                ("Tour d'horizon",
                 "Capacité à assurer sa sécurité en sortie d'eau (tour d'horizon et gonflage du gilet en "
                 "surface)."),
                ("Gonflage du gilet en surface",
                 "Capacité à assurer sa sécurité en sortie d'eau (tour d'horizon et gonflage du gilet en "
                 "surface)."),
                ("Remontée en expiration contrôlée",
                 "Remontée en expiration, embout en bouche, d'une profondeur n'excédant pas 6 m : rejet continu "
                 "d'air tout au long de la remontée après un départ du fond, sans précipitation, sur une "
                 "inspiration normale."),
            ], {
                "competence_attendue": "Le plongeur gère son retour en surface en toute sécurité en respectant "
                                        "les consignes du GP.",
                "comportement": "Le plongeur est attentif à la cohésion de la palanquée. Il est à l'écoute du GP "
                                "et réactif à ses consignes. Il est capable de revenir en surface et de se "
                                "signaler en cas de perte de sa palanquée.",
                "theorie": "Accidents : principes des barotraumatismes et prévention. Faire le lien avec les "
                           "notions de physique simples pour expliquer les variations de volume, notamment "
                           "concernant la zone de 0 à 10 m. Les règles d'approche de la surface sont explicitées. "
                           "Un accent particulier est mis sur la surpression pulmonaire. Désaturation : principe "
                           "de l'accident de désaturation, courbe de plongée sans palier, connaissance de "
                           "différents outils (ordinateur et table fédérale) : lecture simple des informations "
                           "et utilisation basique. Procédures de remontée anormale y compris la remontée "
                           "isolée.",
                "modalites_evaluation": "Le plongeur sait gérer sa remontée en totale autonomie ou au sein d'une "
                                        "palanquée. Il sait également se mettre en sécurité en surface, seul ou "
                                        "en palanquée. Pour la remontée en expiration, aucun critère de temps "
                                        "n'est recherché, la réalisation sans stress et en respectant une "
                                        "vitesse correcte de remontée est recherchée.",
            }),
            ("B11", "Connaissances théoriques", True, False, [
                ("Notions de physique",
                 "Principes de physique simples, flottabilité, variations de pression et de volume, influence "
                 "du milieu sur la perception des couleurs, des distances et des tailles. Influence du milieu "
                 "sur la perception des sons. Ces principes sont présentés sans calcul."),
                ("Accidents",
                 "Principes des barotraumatismes et leur prévention. Causes et prévention de l'essoufflement."),
                ("Procédures de désaturation",
                 "Principe de l'accident de désaturation, courbe de plongée sans palier, connaissance de "
                 "différents moyens de décompression (ordinateur et table fédérale). La table fédérale sert de "
                 "support pédagogique (durée, profondeur, palier, vitesse de remontée). Information sur "
                 "l'utilisation basique des ordinateurs de plongée (connaissance de son ordinateur). Procédures "
                 "de remontée anormale, y compris la remontée isolée."),
                ("Froid et dangers du milieu",
                 "Connaissance des risques et de la prévention."),
                ("Réglementation",
                 "Prérogatives du plongeur, documents pour plonger. Réglementation relative aux espaces "
                 "d'évolution, à la plongée en autonomie et à la responsabilité. Respect des consignes de "
                 "l'encadrant. Présentation de la FFESSM, information sur l'organisation de la plongée. "
                 "Utilisation du carnet de plongée numérique."),
                ("Milieu et environnement",
                 "Charte internationale du plongeur responsable, connaissances minimales du milieu subaquatique. "
                 "Respect du milieu (palmage, stabilisation...)."),
            ], {
                "competence_attendue": "Les connaissances des niveaux antérieurs sont considérées comme "
                                        "maîtrisées. L'évaluation peut permettre de vérifier ce point.",
                "modalites_evaluation": "Les connaissances théoriques sont évaluées à l'oral, lors des mises en "
                                        "situations pratiques. Il n'y a pas d'examen écrit. L'accent est mis sur "
                                        "la prévention.",
            }),
        ],
    },
    {
        # PA20 | PE40, version mai 2026 : le N2 se scinde desormais en deux
        # qualifications (PA20 = plongeur autonome a 20 m, PE40 = plongeur
        # encadre a 40 m) plus des blocs communs ; le brevet N2 est delivre
        # quand les deux qualifications sont acquises. Fusionne ici en un
        # seul referentiel (regroupement = "Commun"/"PA20"/"PE40" par bloc),
        # voir la note dans CLAUDE.md sur ce choix de modelisation.
        "niveau": "N2",
        "version": "PA20 | PE40 (2026-05)",
        "source": "Manuel de Formation Technique - Plongeur Niveau 2 - PA20 | PE40, "
                  "Commission Technique Nationale FFESSM, version mai 2026",
        "date_application": "2026-05-01",
        "age_minimum": 15,
        "prerequis": "N1",
        "qualification": None,
        "milieu_naturel_exclusif": True,
        "encadrant_validation": "E2",
        "encadrant_delivrance": "E3",
        "prof_validation": 20,
        "prof_formation": 40,
        "prerogative": 40,
        "blocs": [
            ("C1", "S'équiper et se déséquiper - Se mettre à l'eau et en sortir", False, False, [
                ("Gréage et dégréage",
                 "Perfectionnement des techniques acquises au N1: choix du matériel adapté à la plongée, "
                 "montage sans erreur, réglages corrects en surface."),
                ("Capelage et décapelage",
                 "Perfectionnement des techniques acquises au N1: choix du matériel adapté à la plongée, "
                 "montage sans erreur, réglages corrects en surface."),
                ("Saut droit et bascule arrière - Remontée à l'échelle",
                 "Mise à l'eau et sortie de l'eau adaptées au lieu et aux conditions de plongée, aisance de "
                 "pratique."),
            ], {
                "competence_attendue": "Le plongeur est capable de mettre en œuvre son équipement de manière "
                                        "autonome et d'en vérifier le bon fonctionnement, de se mettre à l'eau, "
                                        "de sortir de l'eau efficacement et en autonomie.",
                "comportement": "Le plongeur porte une attention particulière au bon fonctionnement de son "
                                "matériel, à l'équipement des équipiers. Il respecte les consignes du DP et met "
                                "en œuvre les techniques avec rapidité et aisance.",
                "theorie": "Rappel des principes d'entretien et de fonctionnement du matériel, d'hygiène et de "
                           "désinfection. Prévention de l'essoufflement en lien avec une utilisation déficiente "
                           "du matériel. Flottabilité et lestage adapté à la plongée profonde.",
                "modalites_evaluation": "Evaluation en contrôle continu en cours de formation. Le plongeur doit "
                                        "être autonome dans la gestion de son matériel et de son équipement, il "
                                        "doit être attentif au matériel de ses équipiers. Le plongeur maîtrise "
                                        "les techniques usuelles de mise à l'eau et de sortie de l'eau, du bord "
                                        "ou d'une embarcation, dans des contextes de milieux naturels variés. Il "
                                        "a le souci de la sécurité globale de la palanquée.",
                "regroupement": "Commun",
            }),
            ("C2", "S'immerger - Se propulser - Se ventiler", False, False, [
                ("Canard et phoque",
                 "Renforcement et perfectionnement des techniques d'immersion acquises, adaptées aux conditions "
                 "de la plongée et réalisées efficacement (rapidité et maintien de la cohésion de la "
                 "palanquée)."),
                ("Palmages",
                 "Optimisation des techniques de palmage acquises pour limiter les risques d'accident, "
                 "notamment en zone profonde."),
                ("Remontée en expiration contrôlée REC",
                 "Remontée en expiration, embout en bouche, sur un trajet vertical n'excédant pas 10 m (rejet "
                 "d'air tout au long de la remontée après un départ du fond stabilisé, sans précipitation, sur "
                 "une inspiration normale)."),
                ("Descente et remontée",
                 "Evolution équilibrée à la descente, au fond, en profondeur, à la remontée au palier par "
                 "l'utilisation combinée du gilet et du poumon ballast."),
            ], {
                "competence_attendue": "Le plongeur est capable de s'immerger selon la technique définie par le "
                                        "DP ou le GP, dans le respect de ses consignes et dans toutes les "
                                        "conditions de pratique. Il assure ses déplacements de manière autonome "
                                        "en surface comme dans sa zone d'immersion.",
                "comportement": "Le plongeur est capable de gérer ses efforts afin d'éviter les incidents, pour "
                                "lui comme pour ses équipiers de la palanquée.",
                "theorie": "Prévention des accidents notamment en zone profonde : essoufflement, accident de "
                           "désaturation, narcose, froid. Flottabilité et lestage.",
                "modalites_evaluation": "Nages de surface : distances de l'ordre de 250 m pour le PMT et 100 m "
                                        "pour le capelé. Les capacités physiques sont développées pour répondre "
                                        "aux exigences de la plongée. La qualité et l'efficacité des gestes "
                                        "techniques demeurent essentiels. Pas d'épreuve chronométrée, seule la "
                                        "capacité à effectuer un parcours en surface dans de bonnes conditions "
                                        "physiques doit être le critère retenu. Pour la REC, lors des situations "
                                        "d'évaluation, aucun critère de temps n'est recherché. La réalisation "
                                        "sans stress et en respectant une vitesse correcte de remontée est "
                                        "primordiale. En revanche, l'automatisme de l'expiration contrôlée est "
                                        "vérifié lors de toutes les situations d'apprentissage technique "
                                        "nécessitant une remontée. Descente, remontée : maintien un niveau "
                                        "d'immersion durablement et sans difficulté.",
                "regroupement": "Commun",
            }),
            ("C3", "Respecter le milieu et l'environnement", False, False, [
                ("Aisance aquatique",
                 "Réalisation de déplacements équilibrés, sans appui, avec un palmage et une stabilisation "
                 "maitrisés."),
            ], {
                "competence_attendue": "Le plongeur adopte une attitude éco-responsable, il évolue dans le "
                                        "respect de l'environnement subaquatique et en connaissance du milieu.",
                "comportement": "Le plongeur évolue en limitant son impact sur l'environnement. Il adopte une "
                                "attitude respectueuse à l'égard de la faune et de la flore : il limite "
                                "l'éclairage et les nuisances sonores, il est le plus discret possible, il "
                                "refuse le nourrissage. Il développe sa capacité d'observation.",
                "theorie": "Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). "
                           "Connaissance liée au respect de l'environnement, à l'impact du plongeur sur le "
                           "milieu (respect de la tranquillité de la faune, absence de dégradation). "
                           "Présentation de la Charte internationale du plongeur responsable.",
                "modalites_evaluation": "Au cours des plongées en milieu naturel, le comportement respectueux et "
                                        "responsable du plongeur est évalué. Il sait décrire et nommer les "
                                        "espèces les plus fréquemment rencontrées.",
                "regroupement": "Commun",
            }),
            ("C4", "Être attentif au matériel de ses équipiers", False, False, [
                ("Mise en œuvre de son propre matériel",
                 "Adaptation du lestage à son équipement. Contrôle du bon fonctionnement de son matériel et "
                 "information à ses équipiers."),
                ("Connaissance du matériel des équipiers",
                 "Connaissance du moyen de désaturation utilisé par ses équipiers. Connaissance du fonctionnement "
                 "de leur gilet, de la localisation de leur détendeur de secours et de leur moyen de contrôle de "
                 "la pression d'air."),
            ], {
                "competence_attendue": "Le plongeur est capable d'adapter son matériel en fonction de la "
                                        "plongée, il connaît le matériel de ses équipiers et leur mise en "
                                        "œuvre.",
                "comportement": "Le plongeur est autonome dans le choix du matériel, il a le réflexe de "
                                "présenter son matériel à ses équipiers et de se renseigner sur le matériel des "
                                "autres membres de la palanquée. Le principe de la co-gestion de la palanquée "
                                "doit rester à l'esprit du plongeur dans sa manière de gérer et d'utiliser le "
                                "matériel.",
                "theorie": "Réglementation sur le matériel obligatoire en plongée autonome. Notions simples de "
                           "physique pour expliquer et comprendre les principes de fonctionnement des "
                           "détendeurs (pression, forces, équilibre des forces, débit continu, ...).",
                "modalites_evaluation": "Le plongeur est capable de présenter à ses équipiers son matériel et en "
                                        "connaît les principes de fonctionnement. Il est capable de comprendre "
                                        "le fonctionnement du matériel de ses équipiers. Il est capable de "
                                        "restituer oralement les principes de fonctionnement d'un détendeur "
                                        "(détente et asservissement).",
                "regroupement": "PA20",
            }),
            ("C5", "Évoluer en autonomie", False, False, [
                ("Sécurité de la palanquée",
                 "Connaissance du fonctionnement de son instrument de désaturation, lecture des principaux "
                 "paramètres : durée et profondeurs, vitesse de remontée, durée de plongée sans palier, durée et "
                 "profondeur des paliers, etc. Participation à la cohésion de la palanquée : respect de la "
                 "vitesse de remontée, tenue du palier, cohabitation de différents moyens de désaturation. Mise "
                 "en œuvre de la sécurité pour la sortie de l'eau, lancement du parachute."),
            ], {
                "competence_attendue": "Le plongeur sait évoluer en immersion en toute autonomie dans le souci "
                                        "de la sécurité de la palanquée et dans le respect des choix de "
                                        "planification.",
                "comportement": "Les plongeurs autonomes étant coresponsables, une attention constante doit être "
                                "portée à la communication avec les autres membres de la palanquée, à leur "
                                "surveillance régulière, au contrôle des différents paramètres de plongée "
                                "prédéfinis sur le plan de l'autonomie en air et de la désaturation. Une "
                                "vigilance accrue est attendue dans la gestion de la désaturation.",
                "theorie": "Information sur la modélisation de la désaturation. Le plongeur sait utiliser son "
                           "ordinateur de plongée : il identifie les différents affichages et paramètres (durée, "
                           "profondeur instantanée et maximale, durée maximale de plongée sans palier, paliers "
                           "facultatifs et obligatoires, durée de la remontée, indicateur de vitesse, alarmes...), "
                           "il connait les critères de conservatisme, il sait utiliser le mode planification et "
                           "carnet de plongée. Il connait les valeurs limites de GF (gradient factor) pour la "
                           "plongée à l'air (GF bas = GF haut = entre 85 et 90%). Le plongeur est capable de "
                           "gérer la désaturation au sein d'une palanquée utilisant des moyens différents. "
                           "Connaissance de la table fédérale et de ses principes de fonctionnement. Connaissance "
                           "des obligations règlementaires et des incidences sur les responsabilités civiles et "
                           "pénales partagées des plongeurs.",
                "modalites_evaluation": "Les comportements doivent être évalués tout au long de la formation et "
                                        "au travers de mises en situations variées (milieu, condition de "
                                        "visibilité, courant, ...). Le plongeur est capable de respecter la "
                                        "vitesse de remontée, les paliers et de mettre en place un parachute. Il "
                                        "participe activement à la gestion de la désaturation, intègre les "
                                        "consignes du DP et tient compte des différents matériels. Pour la "
                                        "partie théorique, ces connaissances sont à vérifier de manière orale, "
                                        "ciblées sur des situations concrètes, pratiques et réalistes. "
                                        "Résolution d'au moins un problème de table (pas d'utilisation "
                                        "planifiée, pas de lecture inverse, pas d'utilisation en altitude ni de "
                                        "mélanges autres que l'air, pas de respiration d'O2 en surface ou au "
                                        "palier).",
                "regroupement": "PA20",
            }),
            ("C6", "Planifier la plongée en fonction des consignes du DP", False, False, [
                ("Compréhension des directives du DP",
                 "Identification des consignes de durée et de profondeur, connaissance des conditions de fin de "
                 "plongée et des règles de désaturation imposées : pression du bloc en fin de plongée, paliers "
                 "éventuels, durée totale de remontée maximale."),
                ("Compréhension de la topologie du site de plongée, orientation",
                 "Compréhension de la géographie du site ainsi que des repères à utiliser pour l'orientation. "
                 "Utilisation d'un compas."),
                ("Détermination du profil de la plongée et des différentes procédures en immersion",
                 "En concertation avec ses équipiers : définition du profil de plongée et du choix des "
                 "paramètres en fonction du cadre fixé par le DP (pas de paliers profonds à l'air), prise en "
                 "compte des différents moyens de désaturation présents dans la palanquée, détermination du "
                 "protocole de contrôle des consommations."),
            ], {
                "competence_attendue": "Le plongeur est capable de planifier sa plongée en autonomie avec ses "
                                        "équipiers en respectant les consignes du directeur de plongée.",
                "comportement": "Le plongeur a le souci de la gestion collégiale de la planification. Il "
                                "s'attache au respect du cadre réglementaire et à celui défini par le directeur "
                                "de plongée. Il prend en compte l'expérience de ses équipiers. En immersion, il "
                                "porte une attention constante à la mise en œuvre du parcours, à la prise de "
                                "repères.",
                "theorie": "Réglementation relative aux espaces d'évolution, à la plongée en autonomie et à la "
                           "responsabilité. Gestion de procédures de désaturation différentes au sein d'une même "
                           "palanquée (capable d'identifier ce type de situation avant la plongée et d'agir en "
                           "conséquence). Notions de physique permettant de calculer l'autonomie et la "
                           "consommation du plongeur en profondeur et au palier en litre/minute et en "
                           "bar/minute.",
                "modalites_evaluation": "Le plongeur est capable, en s'appuyant sur un cas concret, de présenter "
                                        "une proposition de planification. Il peut préciser les procédures qu'il "
                                        "souhaite mettre en place à chaque étape de l'immersion. Le contrôle se "
                                        "fait en cours de formation, avec le souci de varier les situations "
                                        "d'évaluation et d'en conserver la dimension pratique. Il sait réaliser "
                                        "des calculs simples de consommation et d'autonomie. Il peut réaliser un "
                                        "aller-retour au compas sur une distance courte (20 à 30 m), il sait "
                                        "suivre un court trajet prédéfini.",
                "regroupement": "PA20",
            }),
            ("C7", "Intervenir et porter assistance à un plongeur en difficulté", False, True, [
                ("Observation, compréhension et réaction face à un incident",
                 "Interprétation des signes conventionnels d'un équipier. Réaction aux manifestations "
                 "observables en l'absence de signe conventionnel (ventilation anormale, agitation, "
                 "inconscience, débit continu,...). Prise en charge du plongeur en difficulté. Si nécessaire, "
                 "passage de l'octopus, assistance et remontée à l'aide des moyens disponibles, gilets et "
                 "palmes."),
            ], {
                "competence_attendue": "Le plongeur est capable d'identifier une situation anormale et "
                                        "d'adopter un comportement adapté pour y remédier efficacement jusqu'à "
                                        "la prise en charge par le DP.",
                "comportement": "La réaction est rapide, sans brutalité, la prise en charge est calme et "
                                "sécurisante. Le plongeur qui intervient a le souci du confort de l'assisté, il "
                                "adopte une attitude rassurante.",
                "theorie": "Causes, symptômes, prévention et conduites à tenir pour l'ensemble des accidents : "
                           "barotraumatismes, accident de désaturation, essoufflement, froid, malaises, etc. "
                           "Concernant les accidents de désaturation, en particulier, les facteurs favorisants, "
                           "les profils de plongée à risque, l'acclimatation à la désaturation (plongée de "
                           "réadaptation).",
                "modalites_evaluation": "Toutes les situations qui nécessitent une intervention sont travaillées. "
                                        "L'assistance doit être réalisée dans au moins deux situations "
                                        "différentes, chacune étant réalisée intégralement, au moins deux fois. "
                                        "Le plongeur doit réaliser une bonne interprétation de la situation, une "
                                        "prise en charge rapide et efficace, une remontée régulière à une "
                                        "vitesse adaptée aux moyens de désaturation utilisés, un arrêt marqué "
                                        "dans la zone 5 à 3 m et une sortie d'eau sécurisée. Le palmage est "
                                        "autorisé mais l'utilisation optimale des gilets doit être privilégiée. "
                                        "L'évaluation des connaissances relatives à la prévention des accidents "
                                        "de désaturation se fait à travers l'étude de cas pratiques.",
                "regroupement": "PA20",
            }),
            ("C8", "Se ventiler - S'équilibrer", False, False, [
                ("Ventilation en surface et en immersion",
                 "Maîtrise de toutes les techniques, quelle que soit la profondeur : passage embout tuba, "
                 "lâcher-reprise d'embout, expiration à la remontée. Adaptation de la ventilation et de la "
                 "gestion de l'effort en profondeur."),
                ("Vidage du masque",
                 "Maintien d'une ventilation normale et de la stabilité pendant le VDM. Perfectionnement de la "
                 "technique jusqu'à une profondeur de 20 m."),
                ("Stabilisation",
                 "Maintien d'une ventilation normale et de la stabilité pendant le VDM. Perfectionnement de la "
                 "technique jusqu'à une profondeur de 20 m."),
            ], {
                "competence_attendue": "Le plongeur gère et adapte sa ventilation en fonction de la profondeur. "
                                        "Il maitrise sa stabilisation dans toutes les situations, de manière "
                                        "autonome.",
                "comportement": "Le plongeur fait preuve de rapidité et d'efficacité dans la mise en œuvre des "
                                "différentes techniques et compétences aquatiques.",
                "theorie": "Prévention des accidents : accident de désaturation, narcose, essoufflement. "
                           "Consommation : incidence de la profondeur sur la consommation et l'autonomie, "
                           "démontrée à partir d'un calcul. Flottabilité : loi de Mariotte, compréhension de "
                           "l'incidence de la profondeur sur la flottabilité.",
                "modalites_evaluation": "Le plongeur montre sa capacité à gérer et réguler sa ventilation dans "
                                        "un contexte d'effort normal à modéré. Il est capable de vider son "
                                        "masque dans des situations variées et sans stress à 20 m.",
                "regroupement": "PE40",
            }),
            ("C9", "Communiquer avec le guide de palanquée", False, False, [
                ("Connaissance de tous les signes et codes",
                 "Connaissance de tous les signes, réactivation des acquis du code de communication et "
                 "acquisition des signes propres à la plongée profonde : narcose, consommation, paramètres de "
                 "désaturation."),
            ], {
                "competence_attendue": "Le plongeur est en mesure de comprendre et d'échanger les informations "
                                        "utiles à la gestion de la plongée par le GP.",
                "comportement": "Le plongeur comprend les consignes du GP. Il informe spontanément le GP à terre "
                                "et en plongée, de tous les paramètres utiles à la plongée, en particulier sa "
                                "consommation et sa désaturation. Le GP attend de sa part une vigilance accrue "
                                "dans tous les moments de la plongée. Il est capable d'analyser ses propres "
                                "sensations, son ressenti, d'adapter son propre comportement et de prévenir le "
                                "GP (narcose, essoufflement, ...).",
                "theorie": "Risques de la plongée profonde : narcose, froid, essoufflement, consommation, "
                           "désaturation. Le plongeur sait utiliser son ordinateur de plongée : il identifie les "
                           "différents affichages et paramètres (durée, profondeur instantanée et maximale, "
                           "durée maximale de plongée sans palier, paliers facultatifs et obligatoires, durée de "
                           "la remontée, indicateur de vitesse, alarmes...), il connait les critères de "
                           "conservatisme, il sait utiliser le mode planification, connaît les valeurs limites "
                           "de GF (gradient factor) pour la plongée à l'air (GF bas = GF haut = entre 85 et "
                           "90%).",
                "modalites_evaluation": "L'évaluation est réalisée en situations pratiques réelles, l'ensemble "
                                        "des situations de communication est évaluée. Les échanges sont clairs, "
                                        "les réactions rapides et adaptées.",
                "regroupement": "PE40",
            }),
            ("C10", "Retourner en surface", False, False, [
                ("Gestion de la désaturation",
                 "Identification de tous les paramètres de son moyen de désaturation utiles à la gestion de la "
                 "plongée : profondeur, temps, durée sans palier, durée totale de remontée, paliers. "
                 "Communication au GP et suivi des consignes de celui-ci. Maitrise des fonctionnalités de son "
                 "instrument de désaturation."),
                ("Gestion d'une remontée isolée",
                 "Réalisation du retour en surface en respectant la vitesse de remontée et les paliers "
                 "inhérents à la plongée effectuée."),
            ], {
                "competence_attendue": "Le plongeur connait le fonctionnement de ses moyens de décompression et "
                                        "les utilise à bon escient en plongée. Il est capable de réaliser et de "
                                        "gérer sa remontée vers la surface en toutes circonstances.",
                "comportement": "Le plongeur est attentif à l'évolution de ses paramètres. La fréquence du "
                                "contrôle des instruments doit être adaptée à la profondeur. Il fait preuve "
                                "d'initiative en communiquant ses paramètres au GP sans attendre d'être "
                                "sollicité par ce dernier. Il respecte les consignes du GP spécifiques au "
                                "déroulement de la plongée. En cas de remontée isolée, le plongeur assure sa "
                                "propre sécurité : vitesse, paliers, approche surface, sortie de l'eau.",
                "theorie": "Connaissance du fonctionnement de son moyen de désaturation. Connaissance du "
                           "fonctionnement de la table fédérale. Notions de physique simples : flottabilité, loi "
                           "de Mariotte (compréhension des variations de volume). Accidentologie : prévention "
                           "des barotraumatismes et de l'accident de désaturation.",
                "modalites_evaluation": "L'évaluation doit être réalisée tout au long de la formation. Le "
                                        "plongeur démontre sa capacité à identifier et à communiquer les "
                                        "paramètres utiles à la procédure de désaturation. L'évaluation de la "
                                        "connaissance des principes de fonctionnement de la table fédérale "
                                        "(palier, vitesse de remontée, différents types de plongée, ...), est "
                                        "orale ou écrite, sans recours aux exercices de calcul de table. Le "
                                        "plongeur démontre sa capacité à remonter seul en toute sécurité. Il est "
                                        "capable de restituer les paramètres de sa plongée au DP.",
                "regroupement": "PE40",
            }),
            ("C11", "Intervenir en relais sur un équipier en difficulté", False, True, [
                ("Intervention en relais",
                 "Intervention en relais auprès d'un équipier. Maintien du niveau d'immersion et présentation "
                 "de son deuxième détendeur en cas de panne d'air, prise en charge de l'équipier jusqu'à "
                 "l'intervention du GP."),
            ], {
                "competence_attendue": "Le plongeur est capable d'identifier et de prendre en charge un "
                                        "équipier en difficulté, en attendant l'intervention du guide de "
                                        "palanquée.",
                "comportement": "Le plongeur analyse et réagit sans ambiguïté au signe d'un équipier. Il agit "
                                "calmement et rapidement dès perception de la situation nécessitant une "
                                "intervention. Toute intervention ne doit pas augmenter la profondeur, la "
                                "flottabilité est assurée lorsque cela est nécessaire. Il a le souci d'assurer "
                                "un certain confort durant la prise en charge : mise en bouche du détendeur, "
                                "quantité d'air fusante, etc.",
                "theorie": "Protocoles et procédures : il connait les codes de communication et les réponses "
                           "possibles dans le cadre de procédures normales et exceptionnelles. Recommandations "
                           "fédérales et procédures de rattrapage en cas de remontée anormale.",
                "modalites_evaluation": "Les situations évaluées qui nécessitent l'intervention du plongeur "
                                        "avant celle du GP doivent être variées. Le plongeur réagit rapidement "
                                        "et réalise une action adaptée à la situation : prise en charge du "
                                        "plongeur assisté, maintien de la profondeur, passage d'embout et "
                                        "déplacement jusqu'au GP.",
                "regroupement": "PE40",
            }),
            ("C12", "Connaissances théoriques PA20", True, False, [
                ("Théorie de l'activité",
                 "Flottabilité, variations de pression et de volume. Incidence de la profondeur sur la "
                 "consommation et l'autonomie, prévention de la panne d'air, notion de marge de sécurité "
                 "(consommation en profondeur et au palier en litre/minute et en bar/minute). Les calculs "
                 "viennent en appui de la démonstration et ne constituent pas un outil d'évaluation."),
                ("Accidents",
                 "Rappels des préventions orientés vers l'autonomie (prise en compte des équipiers) pour "
                 "l'accident de désaturation, les barotraumatismes, l'essoufflement et le froid. Différentes "
                 "conduites à tenir en lien avec les prérogatives (intervention jusqu'à la prise en charge par "
                 "le DP). Causes, symptômes, prévention et conduite à tenir pour l'ensemble des accidents."),
                ("Procédures de désaturation",
                 "Connaissance des différents moyens de désaturation, fonctionnement des tables de plongée (le "
                 "calcul vient en appui des démonstrations, il ne sert pas de moyen d'évaluation). Fonctionnement "
                 "de l'ordinateur, principe et règles de cohabitation des différentes procédures (paliers, "
                 "vitesse, personnalisation,...)."),
                ("Matériel",
                 "Connaissance du fonctionnement du premier étage d'un détendeur : information sur le principe "
                 "de détente, l'asservissement, la compensation, le débit continu. Règles d'entretien et "
                 "précautions d'utilisation de l'ensemble de son matériel (rinçage, stockage, ...)."),
                ("Réglementation",
                 "Prérogatives du plongeur, documents nécessaires à la pratique de la plongée. Règlementation "
                 "relative aux espaces d'évolution, à la plongée en autonomie et à la responsabilité. "
                 "Règlementation sur le matériel obligatoire en plongée autonome. Connaissance des ressources et "
                 "recherche de l'information : différentes autorités, clubs locaux, etc. Connaissance du cadre "
                 "fédéral (organes déconcentrés, commissions, ...)."),
                ("Milieu et environnement",
                 "Charte internationale du plongeur responsable, connaissance minimale du milieu subaquatique : "
                 "le comportement respectueux et responsable du plongeur est évalué. Connaissance des risques et "
                 "dangers du milieu (faune, épaves, grottes, ...). Identification des espèces courantes."),
            ], {
                "competence_attendue": "Les connaissances des niveaux antérieurs sont considérées comme "
                                        "maîtrisées. L'évaluation peut permettre de vérifier ce point.",
                "regroupement": "PA20",
            }),
            ("C13", "Connaissances théoriques PE40", True, False, [
                ("Théorie de l'activité",
                 "Flottabilité, variations de pression et de volume. Flottabilité et lestage, prise en compte de "
                 "l'augmentation de la profondeur d'évolution et impact sur l'équilibre. Consommation : "
                 "incidence de la profondeur sur la consommation et l'autonomie, prévention de la panne d'air, "
                 "notion de marge de sécurité. Notions sur les pressions partielles : seuils de toxicité des "
                 "gaz. Les calculs viennent en appui de la démonstration et ne constituent pas un outil "
                 "d'évaluation."),
                ("Accidents",
                 "Prévention des accidents liés à la profondeur : accident de désaturation, essoufflement, "
                 "froid, narcose. Sensibilisation à l'accroissement des risques liés à la profondeur. "
                 "Connaissance des risques et dangers du milieu."),
                ("Procédures de désaturation",
                 "Rappel de la courbe de plongée sans palier. Connaissance du fonctionnement de l'ordinateur "
                 "ciblé sur son utilisation, identification des paramètres utiles : durée, profondeur, paliers, "
                 "durée totale de remontée, vitesse de remontée. Notions de personnalisation."),
                ("Réglementation",
                 "Prérogatives du plongeur, documents nécessaires à la pratique de la plongée. Règlementation "
                 "relative aux espaces d'évolution, à la plongée en autonomie et à la responsabilité. "
                 "Connaissance du cadre fédéral (organes déconcentrés, commissions, ...)."),
                ("Milieu et environnement",
                 "Charte internationale du plongeur responsable, connaissances minimales du milieu subaquatique. "
                 "Sensibilisation aux risques et dangers du milieu. Identification des espèces courantes."),
            ], {
                "competence_attendue": "Les connaissances des niveaux antérieurs sont considérées comme "
                                        "maîtrisées. L'évaluation peut permettre de vérifier ce point.",
                "regroupement": "PE40",
            }),
        ],
    },
    {
        "niveau": "N2",
        "version": "2015-01-02",
        "date_application": "2015-01-02",
        "age_minimum": 16,
        "prerequis": "N1",
        "qualification": None,
        "milieu_naturel_exclusif": True,
        "encadrant_validation": "E2",
        "encadrant_delivrance": "E3",
        "prof_validation": 20,
        "prof_formation": 40,
        "prerogative": 40,
        "blocs": [
            ("C1", "Utiliser l'équipement de plongée", False, False, [
                ("S'équiper du matériel individuel.",
                 "Choisit équipement et lestage adaptés ; le lestage est déterminant en vue de la plongée à 40 m."),
                ("Gréer et dégréer l'ensemble bloc / gilet / détendeur.",
                 "Monte le matériel sans erreur et effectue les réglages nécessaires."),
                ("Tester et vérifier le fonctionnement de l'équipement.",
                 "Contrôle son matériel, vérifie son air et prend connaissance de l'équipement de ses équipiers."),
                ("Entretenir le matériel.",
                 "Rince avec les précautions d'usage, sait décontaminer un détendeur, range correctement."),
                ("Embarquer sur un navire support de plongée.",
                 "Porte et range son équipement sans risque ni gêne pour les autres."),
            ]),
            ("C2", "Évoluer en environnement aquatique et subaquatique", False, False, [
                ("Se mettre à l'eau et remonter sur le support.",
                 "Utilise une technique adaptée au support et aux conditions ; prévient les incidents de cette phase."),
                ("S'immerger.",
                 "Choisit une technique d'immersion adaptée au contexte et équilibre ses oreilles."),
                ("Se déplacer en surface et en immersion.",
                 "Palmage adapté au contexte ; une distance d'environ 250 m doit pouvoir être parcourue."),
                ("Se ventiler en surface et en immersion.",
                 "Utilise tuba ou détendeur selon le besoin ; ne bloque pas l'expiration à la remontée (REC de 10 m)."),
                ("Éliminer l'eau du masque en immersion.",
                 "Maintient une ventilation normale au contact de l'eau et évacue l'eau spontanément, sans stress."),
                ("S'équilibrer en surface et à toute profondeur.",
                 "Ajuste sa flottabilité au gilet et au poumon-ballast et adapte sa ventilation à la profondeur."),
                ("Maîtriser la vitesse de descente et de remontée.",
                 "Combine un palmage minimal et une gestion progressive du gilet ; arrive au fond pratiquement équilibré."),
            ]),
            ("C3", "Évoluer en palanquée guidée", False, False, [
                ("Comprendre et respecter les consignes du GP.",
                 "Applique sans erreur les conditions d'évolution fixées ; comportement responsable dans la palanquée."),
                ("Surveiller son stock d'air.",
                 "Suit la pression du bloc et informe le GP aux valeurs convenues."),
                ("Se positionner selon les situations et les conditions.",
                 "Reste au contact, vérifie régulièrement la situation du GP et des équipiers."),
            ]),
            ("C4", "Planifier et organiser la plongée en autonomie", False, False, [
                ("Comprendre le site de plongée et les conditions environnementales.",
                 "Décrit la topographie et les conditions probables à partir du briefing du DP et de sa propre observation."),
                ("Comprendre et respecter les directives du DP.",
                 "Identifie zone et conditions d'évolution, interroge le DP, l'informe de tout élément utile."),
                ("Prendre connaissance de l'expérience, de l'équipement et des attentes des équipiers.",
                 "Échange et se concerte, s'informe du fonctionnement du matériel de ses équipiers."),
                ("Décider du profil de plongée et des procédures, prévoir les variantes.",
                 "Convient du déroulement avec ses équipiers, choisit le protocole de décompression, vérifie l'autonomie en air."),
            ]),
            ("C5", "Maîtriser, adapter l'évolution en immersion", False, False, [
                ("Se diriger en utilisant le milieu et les instruments.",
                 "Mémorise la topographie, maîtrise son itinéraire et émerge à moins de 50 m du point prévu."),
                ("Appliquer les bonnes pratiques d'évolution et les procédures définies.",
                 "Surveille ses équipiers, respecte vitesses et paliers, évite les profils à risque, "
                 "signale ses paliers au parachute, arrêt et tour d'horizon à 3 m."),
            ]),
            ("C6", "Participer à la sécurité des équipiers", False, True, [
                ("Se rappeler les mesures de prévention des risques avant l'immersion.",
                 "Cite les procédures de sécurité, y compris remontée lente ou rapide et paliers interrompus."),
                ("Identifier les comportements et circonstances susceptibles de générer une situation dangereuse.",
                 "Interprète les signes conventionnels et les manifestations visibles d'un plongeur en difficulté."),
                ("Réagir individuellement et collectivement à une situation anormale.",
                 "Fournit une source d'air (simulation), prend le contrôle de la remontée aux gilets, "
                 "sécurise en surface et participe à la sortie de l'eau."),
            ]),
            ("C7", "Connaître et respecter l'environnement marin", False, False, [
                ("Évoluer en limitant son impact sur le milieu.",
                 "Gère ses instruments source de perturbation et explore dans le respect du milieu, en l'absence de GP."),
                ("Développer sa capacité d'observation.",
                 "Approche sans effrayer, reconnaît les types d'habitats, partage ses observations avec la palanquée."),
                ("Connaître la charte internationale du plongeur responsable.",
                 "Applique les gestes et attitudes décrits dans la charte."),
                ("Reconnaître les principaux groupes rencontrés.",
                 "Identifie des représentants des groupes les plus couramment rencontrés en formation."),
            ]),
            ("C8", "Connaissances en appui des compétences", True, False, [
                ("Équipement du plongeur : rôles, montage, entretien, hygiène.",
                 "S'équipe sans erreur, règle et teste le matériel, sait décontaminer un détendeur."),
                ("Réglementation relative à l'activité.",
                 "Prérogatives du N2, documents nécessaires, carnet et passeport de plongée, cadre fédéral."),
                ("Notions physiques utiles à la pratique.",
                 "Effets du milieu, fonctionnement du matériel, calcul d'une autonomie en air ou d'une flottabilité."),
                ("Incidents, accidents et risques liés à l'autonomie.",
                 "Causes, symptômes, prévention et conduite à tenir."),
                ("Outils et procédures de décompression, planification d'une plongée.",
                 "Tables et ordinateur, plongées consécutives et successives, remontées anormales, calcul de consommation."),
            ]),
        ],
    },
    {
        # PA40 | PE60, version decembre 2025 : le N3 se scinde en PA40
        # (plongeur autonome a 40 m) + PE60 (plongeur encadre a 60 m) + des
        # competences complementaires N3, plus un bloc commun. PA60 (plongeur
        # autonome a 60 m, sans DP) est une qualification supplementaire
        # obtenue apres le N3 : non importee ici (hors perimetre du brevet
        # N3 lui-meme), voir la note dans CLAUDE.md. Fusionne comme le N2 en
        # un seul referentiel (regroupement = "Commun"/"PA40"/"PE60"/"N3").
        "niveau": "N3",
        "version": "PA40 | PE60 (2025-12)",
        "source": "Manuel de Formation Technique - Plongeur Niveau 3 - PA40 | PE60 | PA60, "
                  "Commission Technique Nationale FFESSM, version decembre 2025",
        "date_application": "2025-12-01",
        "age_minimum": 17,
        "prerequis": "N2",
        "qualification": "RIFAP",
        "milieu_naturel_exclusif": True,
        "encadrant_validation": "E3",
        "encadrant_delivrance": "E3",
        "prof_validation": 40,
        "prof_formation": 60,
        "prerogative": 60,
        "blocs": [
            ("C1", "Planifier la plongée", False, False, [
                ("Prise en compte des directives du DP",
                 "Intégration des consignes du DP dans la planification : respect strict des profondeurs et "
                 "temps de plongée, consignes pour les paliers et le retour en surface, informations sur le "
                 "site, etc."),
                ("Compréhension de la topologie du site orientation",
                 "Prise en considération des contraintes de la topologie du site dans la planification de la "
                 "plongée. Définition des moyens d'orientation appropriés : instruments, orientation "
                 "instinctive."),
                ("Determination du profil de la plongée et des différentes procédures en immersion",
                 "En concertation avec les équipiers : définition du profil de plongée et choix des paramètres "
                 "en fonction du cadre fixé par le DP, intégration de toutes les spécificités des moyens de "
                 "désaturation présents dans la palanquée, anticipation au cours de la préparation de la "
                 "plongée, détermination du protocole de contrôle des consommations et de celui du retour en "
                 "surface, ordinaire ou avec incident."),
            ], {
                "competence_attendue": "Le plongeur est capable de planifier sa plongée en autonomie, avec ses "
                                        "équipiers et en respectant les consignes du directeur de plongée.",
                "comportement": "Le plongeur a le souci de la gestion collégiale de la planification. Il est "
                                "particulièrement vigilant au respect du cadre réglementaire et à celui défini "
                                "par le directeur de plongée. Les spécificités de la zone d'évolution doivent "
                                "l'inciter à une préparation minutieuse de la plongée qui s'appuie sur la prise "
                                "en compte de l'expérience de ses équipiers.",
                "theorie": "Réglementation relative aux espaces d'évolution, à la plongée en autonomie et à la "
                           "responsabilité (matériel obligatoire). Connaissance des principes des modèles "
                           "utilisés dans les différents moyens de désaturation (incidence de l'application des "
                           "GF sur les paliers). Notions de physique permettant de calculer l'autonomie du "
                           "plongeur et sa consommation en profondeur et au palier en litre/minute et en "
                           "bar/minute.",
                "modalites_evaluation": "Le plongeur est capable de présenter et d'argumenter la planification "
                                        "d'une plongée dans la zone de 20 à 40 m dans le respect des consignes "
                                        "du DP. Le contrôle se fait en cours de formation, avec le souci de "
                                        "varier les situations d'évaluation et d'en conserver la dimension "
                                        "pratique. Les calculs de consommation et d'autonomie sont adaptés à la "
                                        "zone d'évolution.",
                "regroupement": "PA40",
            }),
            ("C2", "Évoluer en autonomie (PA40)", False, False, [
                ("Orientation",
                 "Perfectionnement des compétences, orientation sur des parcours variés en utilisant le milieu "
                 "(courant, relief, lumière, etc…), en identifiant des points remarquables et également en "
                 "utilisant un instrument."),
                ("Évolution subaquatique",
                 "Mise en œuvre d'une communication adaptée avec les membres de sa palanquée : connaissance du "
                 "code de communication, surveillance et intervention éventuelle, maintien de la cohésion de la "
                 "palanquée. Prise en compte des imprévus (problèmes humains, environnementaux, matériels) et "
                 "adaptation du déroulement de la plongée aux contraintes choisies ou qui s'imposent."),
                ("Désaturation",
                 "Connaissance et parfaite maîtrise de son moyen de désaturation en vue d'une application des "
                 "procédures de désaturation adaptées : vitesse de remontée, paliers, cohésion de la palanquée. "
                 "Prise en compte de la diversité des moyens de désaturation utilisés dans la palanquée."),
            ], {
                "competence_attendue": "Le plongeur est capable d'évoluer en immersion et en surface en "
                                        "autonomie, dans le souci de la sécurité de la palanquée et dans le "
                                        "respect des choix de planification, conformément à ses prérogatives "
                                        "dans sa zone d'évolution.",
                "comportement": "Le plongeur a le souci de la maîtrise de son itinéraire tout au long de la "
                                "plongée (efficacité pour rejoindre la zone d'intérêt, capacité à se situer dans "
                                "son déplacement, retour à proximité du bateau, ...). Comme au PA20, les "
                                "plongeurs autonomes sont co-responsables, ils portent une attention constante à "
                                "la communication avec les autres membres de la palanquée, à leur surveillance "
                                "régulière, au contrôle des différents paramètres de plongée prédéfinis sur le "
                                "plan de l'autonomie en air et de la désaturation. Une vigilance accrue est "
                                "attendue dans la gestion de la désaturation en raison de la spécificité de la "
                                "zone d'évolution (gestion des paliers). Il évite les comportements « à risques » "
                                ": profils de plongée inversés, yoyo, plongées répétitives, etc. Il est soucieux "
                                "du déroulement des paliers et à la sécurité du retour en surface. Il signale "
                                "l'exécution de paliers en pleine eau avec un parachute de signalisation, il "
                                "rejoint la surface en respectant un arrêt et un tour d'horizon de sécurité à 3 "
                                "m, etc.",
                "theorie": "Perfectionnement de l'utilisation d'un instrument d'orientation sur des parcours "
                           "variés. Connaissance de l'existence de différents modèles de désaturation. "
                           "Connaissance du principe de fonctionnement d'un ordinateur et des règles "
                           "d'utilisation en plongée (profils, nombre de plongées, ...). Gestion de la "
                           "désaturation au sein d'une palanquée utilisant des moyens différents.",
                "modalites_evaluation": "L'évaluation s'effectue à une profondeur proche de 40 m, en proposant "
                                        "au moins deux situations différentes. L'évaluation des capacités à "
                                        "utiliser un ordinateur de plongée s'effectue à partir de l'analyse de "
                                        "cas concrets, de captures d'écrans. Les situations proposées doivent "
                                        "induire des comportements adaptés.",
                "regroupement": "PA40",
            }),
            ("C3", "Intervenir et porter assistance à un plongeur en difficulté", False, False, [
                ("Observation, compréhension et réaction face à un incident",
                 "Interprétation des signes conventionnels. Réaction aux manifestations observables en "
                 "l'absence de signe conventionnel (ventilation anormale, agitation, perte de vigilance, "
                 "inconscience, ...). Prise en charge du plongeur en difficulté. Si nécessaire, passage de "
                 "l'octopus, assistance et remontée à l'aide des moyens disponibles, gilets et palmes. Maîtrise "
                 "de la vitesse de remontée et de la réalisation du palier en situation d'assistance."),
            ], {
                "competence_attendue": "Le plongeur est capable d'identifier une situation anormale et "
                                        "d'adopter un comportement adapté pour y remédier efficacement.",
                "comportement": "La réaction est rapide, sans brutalité, la prise en charge est calme et "
                                "sécurisante. Le plongeur qui intervient a le souci du confort de l'assisté, il "
                                "adopte une attitude rassurante. Au regard des spécificités de la zone "
                                "d'évolution, le plongeur se doit d'être constamment attentif à ses "
                                "co-équipiers. Une bonne condition physique est garante d'une sécurité active au "
                                "sein de la palanquée.",
                "theorie": "Causes, symptômes, prévention et conduites à tenir pour l'ensemble des accidents "
                           "(barotraumatismes, accident de désaturation, essoufflement, oedème pulmonaire "
                           "d'immersion, narcose, froid, malaises, ...).",
                "modalites_evaluation": "Toutes les situations qui nécessitent une intervention sont évaluées à "
                                        "40 m. L'assistance doit être réalisée dans au moins deux situations "
                                        "différentes, chacune étant réalisée intégralement, au moins deux fois. "
                                        "Le plongeur doit réaliser une bonne interprétation de la situation, une "
                                        "prise en charge rapide et efficace, une remontée régulière à une "
                                        "vitesse adaptée aux moyens de désaturation utilisés, un arrêt marqué "
                                        "dans la zone 5 à 3 m et une sortie d'eau sécurisée. Une sortie rapide de "
                                        "la zone d'évolution jusqu'à 30 m est acceptée dans la mesure où elle est "
                                        "suivie d'une régulation de la vitesse. Le palmage est autorisé mais "
                                        "l'utilisation optimale des gilets doit être privilégiée. Les capacités "
                                        "physiques sont développées pour répondre aux exigences de la plongée "
                                        "profonde. Elles sont évaluées par une nage capelée : il ne s'agit pas "
                                        "d'une épreuve chronométrée, la capacité à effectuer un parcours en "
                                        "surface de 300 m dans de bonnes conditions physiques constitue le "
                                        "critère d'évaluation.",
                "regroupement": "PA40",
            }),
            ("C4", "S'adapter à la profondeur", False, False, [
                ("Stabilisation",
                 "Adaptation de la maîtrise de la stabilisation par la prise en compte de l'augmentation de la "
                 "profondeur et de ses incidences. Utilisation combinée du gilet et du poumon ballast : "
                 "évolution équilibrée à la descente, au fond, en profondeur, à la remontée, au palier."),
                ("Mise en œuvre de l'ensemble des autres techniques",
                 "Entretien et perfectionnement des compétences acquises au PE40 : réalisation des techniques de "
                 "ventilation, de déplacement, de communication avec le GP et ses équipiers, d'intervention en "
                 "relai auprès d'un équipier en difficulté."),
            ], {
                "competence_attendue": "Le plongeur est capable d'évoluer en sécurité et d'adapter son "
                                        "comportement en fonction de la profondeur.",
                "comportement": "La mise en œuvre des prérogatives dans la zone de 40 à 60 m se réalise de "
                                "manière progressive et adaptée. Les comportements attendus sont identiques à "
                                "ceux acquis au PE40. L'ensemble de ces comportements est entretenu et le "
                                "plongeur est sensibilisé à la nécessité de prendre en considération les "
                                "contraintes liées à la plongée en zone profonde : contrôle de la consommation, "
                                "prévention des incidents et accidents, communication spécifique, retour en "
                                "surface et gestion de la désaturation.",
                "theorie": "Sensibilisation à l'accroissement des risques liés à la profondeur (consommation, "
                           "essoufflement, narcose, froid, désaturation) afin d'adapter son comportement en "
                           "terme de prévention et de réaction (vigilance, réactivité, ...). Accident de "
                           "désaturation : mécanismes et principaux symptômes, manifestations plus rares (cutis "
                           "marmorata), prévention (respect des procédures, facteurs favorisants, comportements "
                           "avant, pendant et après la plongée, profils de plongée à risques, acclimatation à la "
                           "désaturation) et traitement (se limiter à la prise en charge enseignée au RIFAP).",
                "modalites_evaluation": "L'évaluation est réalisée en situation pratique à une profondeur qui "
                                        "n'excède pas 40 m par un E3 minimum. Les éléments d'information "
                                        "théoriques sont intégrés à la pratique. L'exercice des prérogatives "
                                        "dans la zone de 40 à 60 m, à l'occasion de plongées encadrées par un "
                                        "E4, permet la mise en œuvre des compétences de manière progressive.",
                "regroupement": "PE60",
            }),
            ("C5", "Organiser la plongée", False, False, [
                ("Choix du site",
                 "Prise d'informations météorologiques (vent, courant, houle, ...). Connaissance de la "
                 "topologie, analyse du site et de ses particularités (courant, vent, marée, possibilités de "
                 "mouillage du bateau, ...), connaissance des conditions réglementaires (restrictions de "
                 "mouillage, zone protégée ou interdite, ...)."),
                ("Organisation des conditions de la plongée",
                 "Prise d'informations météorologiques. En cas d'utilisation d'une embarcation, vérification de "
                 "sa conformité à la réglementation. Choix des modalités de plongée : surveillance surface, "
                 "rotation des palanquées, etc."),
                ("Sécurisation de l'activité",
                 "Rédaction de la fiche de sécurité, utilisation du pavillon alpha. Vérification du matériel de "
                 "secours et d'oxygénothérapie, des moyens de communication, ... (cf. RIFAP Plongée). Adaptation "
                 "des conditions de plongée à l'environnement : météo, courant, vent, etc."),
            ], {
                "competence_attendue": "Le plongeur est capable d'organiser et de mettre œuvre une plongée dans "
                                        "la zone de 0 à 40 m en l'absence de DP et dans le respect de la "
                                        "réglementation, conformément à ses prérogatives.",
                "comportement": "L'organisation de la plongée est mise en œuvre avec la rigueur et le sérieux "
                                "qui président aux conditions de sécurité optimales, dans le respect des "
                                "différentes réglementations.",
                "theorie": "Connaissance des risques et dangers du milieu. Connaissance des obligations "
                           "réglementaires et des incidences sur la responsabilité civile et pénale partagées "
                           "des plongeurs. Connaissance des ressources et recherche de l'information : "
                           "différentes autorités, clubs locaux, etc.",
                "modalites_evaluation": "L'évaluation repose sur la mise en œuvre complète d'une organisation de "
                                        "plongée, dans 2 ou 3 situations différentes a minima. La faisabilité et "
                                        "la pertinence des choix d'organisation constituent les critères "
                                        "principaux de la validation des compétences.",
                "regroupement": "N3",
            }),
            ("C6", "Évoluer en autonomie (0-60 m)", False, False, [
                ("Orientation",
                 "Perfectionnement des compétences, orientation sur des parcours variés en utilisant le milieu "
                 "(courant, relief, lumière, etc…), en identifiant des points remarquables et également en "
                 "utilisant un instrument."),
                ("Évolution subaquatique",
                 "Mise en œuvre d'une communication adaptée avec les membres de sa palanquée : connaissance du "
                 "code de communication, surveillance et intervention éventuelle, maintien de la cohésion de la "
                 "palanquée. Prise en compte des imprévus (problèmes humains, environnementaux, matériels) et "
                 "adaptation du déroulement de la plongée aux contraintes choisies ou qui s'imposent."),
                ("Désaturation",
                 "Connaissance et parfaite maîtrise de son moyen de désaturation en vue d'une application des "
                 "procédures de désaturation adaptées : vitesse de remontée, paliers, cohésion de la palanquée. "
                 "Prise en compte de la diversité des moyens de désaturation utilisés dans la palanquée."),
            ], {
                "competence_attendue": "Le plongeur est capable d'évoluer en immersion et en surface en "
                                        "autonomie dans le souci de la sécurité de la palanquée et dans le "
                                        "respect des choix de planification, conformément à ses prérogatives "
                                        "entre 0 et 60 m.",
                "comportement": "Les techniques sont semblables à celles du PA40 mais le comportement du "
                                "plongeur doit être adapté aux impératifs de la plongée dans l'espace de 0 à 60 "
                                "m. Une attention particulière doit être portée sur : la consommation, la "
                                "planification et la gestion de la désaturation, les risques accrus (narcose, "
                                "froid, essoufflement, ...), la communication et la co-gestion de la palanquée.",
                "theorie": "Perfectionnement de l'utilisation d'un instrument d'orientation sur des parcours "
                           "variés. Consommation en profondeur et au palier en litre/minute et en bar/minute. Le "
                           "plongeur sait utiliser son ordinateur de plongée. Il identifie les différents "
                           "affichages et paramètres, il connait les critères de conservatisme, sait utiliser le "
                           "mode planification, connaît les valeurs limites de GF pour la plongée à l'air (GF "
                           "bas = GF haut = 85 à 90%). Le plongeur est capable de gérer la désaturation au sein "
                           "d'une palanquée utilisant des moyens différents.",
                "modalites_evaluation": "L'évaluation s'effectue en proposant au moins deux situations "
                                        "différentes. Si elle s'effectue à une profondeur maximale de 40 m, le "
                                        "comportement attendu doit correspondre aux exigences des conditions de "
                                        "pratique de l'espace de 40 à 60 m.",
                "regroupement": "N3",
            }),
            ("C7", "Respecter le milieu et l'environnement", False, False, [
                ("Aisance aquatique",
                 "Perfectionnement des acquis du PA20 dans la réalisation de déplacements équilibrés, sans "
                 "appui, avec un palmage et une stabilisation maitrisés."),
            ], {
                "competence_attendue": "Le plongeur adopte une attitude éco-responsable, il évolue dans le "
                                        "respect de l'environnement subaquatique et en connaissance du milieu.",
                "comportement": "Le plongeur évolue en limitant son impact sur l'environnement. Il adopte une "
                                "attitude respectueuse à l'égard de la faune et de la flore : il limite "
                                "l'éclairage et les nuisances sonores, il est le plus discret possible, il "
                                "refuse le nourrissage. Il développe sa capacité d'observation.",
                "theorie": "Connaissance du milieu (faune et flore courantes, risques et dangers du milieu). "
                           "Connaissance liée au respect de l'environnement, à l'impact du plongeur sur le "
                           "milieu (respect de la tranquillité de la faune, absence de dégradation). "
                           "Présentation de la Charte internationale du plongeur responsable.",
                "modalites_evaluation": "Au cours des plongées en milieu naturel, le comportement respectueux et "
                                        "responsable du plongeur est évalué. Il sait décrire et nommer les "
                                        "espèces les plus fréquemment rencontrées.",
                "regroupement": "Commun",
            }),
            ("C8", "Connaissances théoriques PA40 - N3", True, False, [
                ("Théorie de l'activité",
                 "Notions de physique en lien avec les prérogatives, calculs de consommation et d'autonomie en "
                 "gaz permettant de planifier la plongée (consommation en profondeur et au palier en "
                 "litre/minute et en bar/minute)."),
                ("Accidents",
                 "Causes, symptômes, prévention et conduite à tenir pour l'ensemble des accidents. Les "
                 "mécanismes sont précisés pour permettre une bonne compréhension des phénomènes dans le cadre "
                 "des prérogatives d'autonomie. L'accent est mis sur les accidents en lien avec la zone "
                 "d'évolution : narcose, froid, essoufflement, accident de désaturation. La prévention et la "
                 "conduite à tenir constituent les éléments fondamentaux à acquérir."),
                ("Procédures de désaturation",
                 "Connaissance du modèle de Haldane et dérivés. Principe du modèle (M-values et GF), jeux de "
                 "paramètres (Bühlmann, ZHL-16C, RGBM). Non-modélisation des plongées successives, principe de "
                 "la majoration. Connaissance du principe de fonctionnement d'un ordinateur et des règles "
                 "d'utilisation en plongée, principes et règles de cohabitation de différentes procédures."),
                ("Réglementation",
                 "Prérogatives et responsabilités du plongeur, réglementation relative aux espaces d'évolution, "
                 "à la plongée en autonomie (avec et sans DP) et à la responsabilité. Connaissance du cadre "
                 "fédéral."),
                ("Milieu et environnement",
                 "Charte internationale du plongeur responsable, connaissances du milieu subaquatique (le "
                 "comportement respectueux et responsable du plongeur est évalué). Connaissance des dangers du "
                 "milieu."),
            ], {
                "competence_attendue": "Les connaissances des niveaux antérieurs sont considérées comme "
                                        "maîtrisées. L'évaluation peut permettre de vérifier ce point.",
                "regroupement": "PA40 - N3",
            }),
        ],
    },
    {
        "niveau": "N3",
        "version": "2016-01-01",
        "date_application": "2016-01-01",
        "age_minimum": 18,
        "prerequis": "N2",
        "qualification": "RIFAP",
        "milieu_naturel_exclusif": True,
        "encadrant_validation": "E3",
        "encadrant_delivrance": "E3",
        "prof_validation": 40,
        "prof_formation": 60,
        "prerogative": 60,
        "blocs": [
            ("C4", "Planifier et organiser la plongée", False, False, [
                ("Évaluer les caractéristiques du site et les conditions de plongée.",
                 "Comprend la topographie et les conditions à partir du DP et de sa propre analyse ; la partage avec ses équipiers."),
                ("S'approprier et respecter les directives du DP.",
                 "Comprend les paramètres de zone et de conditions, interroge le DP, l'informe de tout élément utile."),
                ("S'intéresser au profil des équipiers.",
                 "Dialogue sur l'expérience, l'équipement et les attentes ; sait utiliser le matériel de ses équipiers."),
                ("Prévoir les phases de la plongée et les variantes utiles.",
                 "Élabore le profil prévu, définit le protocole de décompression, vérifie l'autonomie en air nécessaire."),
            ]),
            ("C5", "Maîtriser, adapter l'évolution en immersion", False, False, [
                ("Se diriger en utilisant le milieu et les instruments.",
                 "Maîtrise son itinéraire, sait où il se trouve à tout moment et retrouve le mouillage."),
                ("Respecter des pratiques et des procédures d'évolution sécurisantes.",
                 "Surveille ses équipiers, respecte les paramètres du DP et les procédures de décompression, "
                 "évite les profils à risque, arrêt et tour d'horizon à 3 m."),
            ]),
            ("C6", "Participer à la sécurité en plongée", False, False, [
                ("Se préparer à prévenir les risques avant l'immersion.",
                 "Connaît les mesures de prévention et les procédures de sécurité à appliquer."),
                ("Identifier les situations anormales et les demandes d'aide des équipiers.",
                 "Réagit sans délai au signe conventionnel et connaît les signes visibles d'un plongeur en difficulté."),
                ("Intervenir pour un équipier en difficulté.",
                 "Maintient l'immersion si possible, apporte l'aide nécessaire, prend le contrôle de la remontée "
                 "aux gilets et sécurise en surface."),
            ]),
            ("C7", "Connaître et respecter l'environnement marin", False, False, [
                ("Évoluer en limitant son impact sur le milieu.",
                 "Gère ses instruments source de perturbation ; acquis du N2 à perfectionner."),
                ("Développer sa capacité d'observation.",
                 "Identifie traces et indices de présence animale, connaît les caractéristiques des milieux explorés."),
                ("Connaître la charte internationale du plongeur responsable.",
                 "Applique les gestes et attitudes décrits dans la charte."),
                ("Identifier les grands groupes d'animaux et de végétaux.",
                 "Identifie, décrit et nomme des représentants des principaux groupes, par clés de détermination."),
            ]),
            ("C8", "Connaissances en appui des compétences", True, False, [
                ("Équipement du plongeur : rôles, montage, entretien, hygiène.",
                 "S'équipe sans erreur, règle et teste le matériel, signale le matériel hors d'état."),
                ("Réglementation relative à l'activité.",
                 "Prérogatives du N3, documents, matériel de secours et armement du bateau, cadre fédéral."),
                ("Notions physiques utiles à la pratique.",
                 "Effets du milieu, fonctionnement du matériel, calcul d'une autonomie en air ou d'une flottabilité."),
                ("Incidents, accidents et risques liés à l'autonomie.",
                 "Causes, symptômes, prévention et conduite à tenir."),
                ("Outils et procédures de décompression, planification d'une plongée.",
                 "Tables et ordinateur, plongées consécutives et successives, remontées anormales, calcul de consommation."),
            ]),
            ("C9", "Choisir un site de plongée", False, False, [
                ("Prendre en compte l'expérience des équipiers et le support surface.",
                 "Recueille ces informations, analyse le contexte et prévoit un site approprié."),
                ("Recueillir les informations sur le site et sur le trajet.",
                 "Cartes marines, bulletins météo, annuaire des marées, courants, mouillage, fréquentation, durée du trajet."),
                ("Analyser les conditions environnementales sur site.",
                 "Vérifie sur place la faisabilité de la plongée prévue, y compris le matériel de sécurité disponible."),
                ("Planifier et organiser la plongée en l'absence de DP.",
                 "Établit la fiche de sécurité et les paramètres, définit le protocole de décompression, "
                 "applique les procédures du plan de secours."),
            ]),
        ],
    },
]

SOURCE = "MFT CTN FFESSM - https://mft.readthedocs.io/fr/latest/"


def q(valeur):
    """Litteral SQL : NULL, booleen ou chaine echappee."""
    if valeur is None:
        return "NULL"
    if isinstance(valeur, bool):
        return "TRUE" if valeur else "FALSE"
    if isinstance(valeur, int):
        return str(valeur)
    return "'" + str(valeur).replace("'", "''") + "'"


def main():
    out = []
    out.append("-- ============================================================")
    out.append("--  Referentiel de competences MFT : plongeur N1, N2 et N3")
    out.append("--  Genere par outils/generer_referentiel.py - ne pas editer a la main.")
    out.append(f"--  Source : {SOURCE}")
    out.append("-- ============================================================")
    out.append("")

    for r in REFERENTIELS:
        out.append(f"-- ---------- {r['niveau']} (MFT {r['version']}) ----------")
        out.append(
            "INSERT INTO referentiel (niveau, version_mft, date_application, source, actif,\n"
            "        age_minimum, niveau_prerequis, qualification_requise, milieu_naturel_exclusif,\n"
            "        niveau_encadrant_validation, niveau_encadrant_delivrance,\n"
            "        profondeur_max_validation, profondeur_max_formation, prerogative_profondeur)\n"
            f"VALUES ({q(r['niveau'])}, {q(r['version'])}, DATE {q(r['date_application'])}, "
            f"{q(r.get('source', SOURCE))}, TRUE,\n"
            f"        {r['age_minimum']}, {q(r['prerequis'])}, {q(r['qualification'])}, {q(r['milieu_naturel_exclusif'])},\n"
            f"        {q(r['encadrant_validation'])}, {q(r['encadrant_delivrance'])},\n"
            f"        {r['prof_validation']}, {r['prof_formation']}, {r['prerogative']});"
        )
        out.append("")

        for ordre_bloc, bloc_data in enumerate(r["blocs"], start=1):
            # 5-tuple (blocs historiques) ou 6-tuple avec un dict de texte
            # libre en plus (revisions post-PE20, voir docstring du module).
            code, intitule, transverse, en_dernier, criteres = bloc_data[:5]
            extra = bloc_data[5] if len(bloc_data) > 5 else {}
            out.append(
                "INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, "
                "valider_en_dernier, competence_attendue, comportement, theorie, modalites_evaluation, "
                "regroupement)\n"
                f"SELECT id, {q(code)}, {q(intitule)}, {ordre_bloc}, {q(transverse)}, {q(en_dernier)},\n"
                f"       {q(extra.get('competence_attendue'))}, {q(extra.get('comportement'))},\n"
                f"       {q(extra.get('theorie'))}, {q(extra.get('modalites_evaluation'))}, "
                f"{q(extra.get('regroupement'))}\n"
                f"  FROM referentiel WHERE niveau = {q(r['niveau'])} AND version_mft = {q(r['version'])};"
            )
            for ordre_crit, (savoir_faire, critere) in enumerate(criteres, start=1):
                out.append(
                    "INSERT INTO critere (bloc_id, ordre, savoir_faire, critere_realisation)\n"
                    f"SELECT b.id, {ordre_crit}, {q(savoir_faire)}, {q(critere)}\n"
                    "  FROM bloc_competence b JOIN referentiel r ON r.id = b.referentiel_id\n"
                    f" WHERE r.niveau = {q(r['niveau'])} AND r.version_mft = {q(r['version'])} AND b.code = {q(code)};"
                )
            out.append("")

    print("\n".join(out))


if __name__ == "__main__":
    main()
