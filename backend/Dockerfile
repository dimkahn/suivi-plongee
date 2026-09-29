# Étape de build : compile le jar avec Maven.
# Toujours sur le processeur de la machine qui construit ($BUILDPLATFORM) :
# le résultat n'en dépend pas, seule l'image finale est multi-architecture.
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# Variante avec l'assistant IA (fr.club.plongee.ia) : le backend y lance
# Claude Code, git et les tests (mvn test, qui construit aussi le frontend).
# D'où le JDK et Maven, git et ssh (push du tag), Node et Claude Code.
# Choisie par BACKEND_CIBLE=execution-ia dans le .env de production (voir
# docker-compose.prod.yml et DEPLOIEMENT.md, « Assistant IA en production ») ;
# elle ne fait rien tant que IA_ACTIVE n'est pas à true.
FROM maven:3.9-eclipse-temurin-25 AS execution-ia
RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client ca-certificates curl gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @anthropic-ai/claude-code \
 && rm -rf /var/lib/apt/lists/* /root/.npm
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]

# Étape d'exécution : image minimale avec le JRE seul. Laissée en dernier :
# c'est l'image construite par défaut (GitHub Actions, production sans IA).
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
