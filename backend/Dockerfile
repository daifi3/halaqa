# Halaqa backend — Spring Boot on Java 21.
# Build:  docker build -t halaqa-backend backend
# Run:    see render.yaml at the repo root for the settings it expects.

FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
# Dependencies first, so code changes don't re-download them.
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Sized for Render's free instance (512 MB): cap the heap, lighter GC and JIT.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k"
EXPOSE 10000
CMD ["java", "-jar", "app.jar"]
