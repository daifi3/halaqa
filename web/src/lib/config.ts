/**
 * Runtime configuration, read from VITE_* variables (see .env.example).
 *
 * With VITE_USE_MOCK=true (the default) the app runs entirely on in-memory
 * data, so you can explore every screen without a backend. Set it to false and
 * point VITE_API_URL at the Spring Boot backend to use real rooms, real video
 * and real recordings.
 */
export const config = {
  apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, ''),
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false',
} as const;
