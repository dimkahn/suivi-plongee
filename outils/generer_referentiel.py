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
            f"VALUES ({q(r['niveau'])}, {q(r['version'])}, DATE {q(r['date_application'])}, {q(SOURCE)}, TRUE,\n"
            f"        {r['age_minimum']}, {q(r['prerequis'])}, {q(r['qualification'])}, {q(r['milieu_naturel_exclusif'])},\n"
            f"        {q(r['encadrant_validation'])}, {q(r['encadrant_delivrance'])},\n"
            f"        {r['prof_validation']}, {r['prof_formation']}, {r['prerogative']});"
        )
        out.append("")

        for ordre_bloc, (code, intitule, transverse, en_dernier, criteres) in enumerate(r["blocs"], start=1):
            out.append(
                "INSERT INTO bloc_competence (referentiel_id, code, intitule, ordre, evaluation_transverse, valider_en_dernier)\n"
                f"SELECT id, {q(code)}, {q(intitule)}, {ordre_bloc}, {q(transverse)}, {q(en_dernier)}\n"
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
