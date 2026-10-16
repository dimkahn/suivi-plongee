#!/usr/bin/env bash
# Hook PreToolUse (Edit|Write) : refuse de modifier une migration Flyway déjà
# présente sur origin/master, donc susceptible d'avoir été appliquée en
# production. Règle de CLAUDE.md : ne jamais éditer une migration appliquée,
# passer par une nouvelle migration ou par l'écran d'admin.
# Une migration neuve (absente d'origin/master) reste modifiable.
fichier=$(jq -r '.tool_input.file_path // empty')
case "$fichier" in
  */backend/src/main/resources/db/migration/*|*/backend/src/main/java/db/migration/*) ;;
  *) exit 0 ;;
esac

racine=$(git -C "$(dirname "$fichier")" rev-parse --show-toplevel 2>/dev/null) || exit 0
relatif=${fichier#"$racine"/}
if git -C "$racine" cat-file -e "origin/master:$relatif" 2>/dev/null; then
  echo "Refusé : $relatif est une migration déjà sur origin/master (peut-être appliquée en production). Ne jamais la modifier : créer une nouvelle migration Flyway (numéro suivant) ou passer par l'écran d'admin, voir CLAUDE.md." >&2
  exit 2
fi
exit 0
