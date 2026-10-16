#!/usr/bin/env bash
# Hook Stop : règle du club (CLAUDE.md) — un changement visible d'un écran met à
# jour, dans le même commit, le manuel (frontend/src/app/features/aide/manuels/)
# et le scénario de vidéo (outils/videos/scenarios/). Si des fichiers d'écran ont
# changé sans aucun des deux, Claude est renvoyé au travail une fois, avec la
# liste. Un même ensemble de fichiers n'est rappelé qu'une fois.
entree=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$entree")" = "true" ] && exit 0

racine=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$racine" || exit 0

modifies=$(git status --porcelain --untracked-files=all | cut -c4- | sed 's/.* -> //')
ecrans=$(grep -E '^frontend/src/app/' <<<"$modifies" \
  | grep -vE '\.spec\.ts$|^frontend/src/app/features/aide/manuels/' || true)
[ -z "$ecrans" ] && exit 0
grep -qE '^frontend/src/app/features/aide/manuels/|^outils/videos/scenarios/' <<<"$modifies" && exit 0

# Déjà rappelé pour exactement ces fichiers : ne pas insister.
empreinte=$(sha256sum <<<"$ecrans" | cut -c1-16)
memo="$(git rev-parse --git-dir)/claude-rappel-aide-videos"
[ "$(cat "$memo" 2>/dev/null)" = "$empreinte" ] && exit 0
echo "$empreinte" >"$memo"

liste=$(sed 's/^/- /' <<<"$ecrans")
jq -n --arg liste "$liste" '{
  decision: "block",
  reason: ("Règle du club : des fichiers d'\''écran ont changé sans manuel ni scénario de vidéo mis à jour :\n" + $liste + "\n\nSi le changement est visible pour l'\''utilisateur : mettre à jour le ou les manuels de frontend/src/app/features/aide/manuels/ (texte, questions, mots-clés) et le ou les scénarios de outils/videos/scenarios/ (gestes, voix off, date « Tournage du … »), voir le skill nouvel-ecran. Sinon (refactorisation, test, outillage), le dire explicitement dans la réponse.")
}'
