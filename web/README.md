# Halaqa — web app

The browser version of Halaqa: the same screens, features, design tokens and icons as the
mobile app in `../src`, built with React, Vite and React Router. It talks to the same Spring
Boot backend (`../backend`) and uses LiveKit for live classes.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `dist/`. Serve it with any static host, and send
unknown paths to `index.html` (it's a single-page app).

## Configure (`web/.env`)

| Variable        | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `VITE_USE_MOCK` | `true`: demo data in the browser, no backend. `false`: the real backend. |
| `VITE_API_URL`  | The backend API, e.g. `http://localhost:3000/api`.                       |

Restart `npm run dev` after editing `.env`.

Demo accounts in mock mode: `teacher@demo.dz` and `student@demo.dz`, password `demo1234`.

The backend allows browser calls (CORS) from any site by default; that's safe because the API
uses bearer tokens, not cookies. To restrict it, set `WEB_ORIGINS` on the backend
(comma-separated, wildcards allowed), e.g. `WEB_ORIGINS=https://halaqa-web.onrender.com`.

## How it maps to the mobile app

- `src/lib`: API client (with refresh tokens), the same types, and the exam, CSV, chat,
  whiteboard and math logic copied from the app.
- `src/app`: one file per screen, at the same routes as the app (`/room/:id`, `/exam/take/:id`…).
- Things the browser does differently:
  - **Device lock:** WebAuthn (fingerprint, face or Windows Hello) instead of the phone's biometrics.
  - **Exam lockdown:** full screen and leave-the-tab detection instead of app pinning.
  - **QR scanning:** the webcam.
  - **PDFs:** the browser's built-in viewer.
  - **Board export and grade reports:** download, or print to PDF.
- Icons come from `ionicons` (the set the app uses through `@expo/vector-icons`).
  `npm run icons` regenerates `src/components/ui/icon-registry.ts` from the names used in `src`.
