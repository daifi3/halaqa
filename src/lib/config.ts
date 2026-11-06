/**
 * Runtime configuration, read from EXPO_PUBLIC_* variables (see .env.example).
 *
 * With EXPO_PUBLIC_USE_MOCK=true (the default) the app runs entirely on
 * in-memory data, so you can explore every screen without a backend.
 * Set it to false and point EXPO_PUBLIC_API_URL at the Spring Boot backend
 * to use real rooms, real video and real recordings.
 */
export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.65:3000/api",
  useMock: (process.env.EXPO_PUBLIC_USE_MOCK ?? "true") !== "false",
} as const;
