"""Voix off des vidéos : lit les sous-titres à voix haute avec Piper.

Processus lancé une fois par enregistrer.mjs, qui garde la voix chargée
pendant tout le tournage. Une demande par ligne sur l'entrée standard,
en JSON : {"texte": "...", "fichier": "chemin.wav"} ; une réponse par
ligne : {"duree": secondes} ou {"erreur": "..."}.

    python3 voix.py voix/fr_FR-siwis-medium.onnx
"""

import json
import sys
import wave

from piper import PiperVoice


def main() -> None:
    voix = PiperVoice.load(sys.argv[1])
    print(json.dumps({"pret": True}), flush=True)
    for ligne in sys.stdin:
        if not ligne.strip():
            continue
        try:
            demande = json.loads(ligne)
            with wave.open(demande["fichier"], "wb") as sortie:
                voix.synthesize_wav(demande["texte"], sortie)
            with wave.open(demande["fichier"], "rb") as lu:
                duree = lu.getnframes() / lu.getframerate()
            print(json.dumps({"duree": duree}), flush=True)
        except Exception as e:  # une phrase ratée ne doit pas arrêter le tournage
            print(json.dumps({"erreur": str(e)}), flush=True)


if __name__ == "__main__":
    main()
