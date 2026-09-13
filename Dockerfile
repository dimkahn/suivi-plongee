# Étape de build : compile l'application Angular
FROM node:20-alpine AS build
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
