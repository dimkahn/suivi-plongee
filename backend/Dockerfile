# Étape de build : compile le jar avec Maven.
# Toujours sur le processeur de la machine qui construit ($BUILDPLATFORM) :
# le résultat n'en dépend pas, seule l'image finale est multi-architecture.
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# Étape d'exécution : image minimale avec le JRE seul
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
