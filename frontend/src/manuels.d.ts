// Les manuels d'utilisation (src/app/features/aide/manuels/*.md) sont
// importés comme du texte : voir « loader » dans angular.json.
declare module '*.md' {
  const contenu: string;
  export default contenu;
}
