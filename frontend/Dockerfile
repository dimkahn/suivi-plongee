# Étape de build : compile l'application Angular.
# Toujours sur le processeur de la machine qui construit ($BUILDPLATFORM) :
# le résultat n'en dépend pas, seule l'image finale est multi-architecture.
# La CLI Angular 22 exige Node >= 22.22.3 : garder cette version alignée sur
# `frontend.node.version` dans frontend/pom.xml.
FROM --platform=$BUILDPLATFORM node:22.23.2-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Étape d'exécution : sert les fichiers statiques avec nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/browser /usr/share/nginx/html
EXPOSE 80
