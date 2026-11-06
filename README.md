# Halaqa — online classrooms

Teachers reserve rooms and invite students; everyone meets in live video with a shared whiteboard, and lessons can be recorded and replayed.

```
halaqa/
├─ src/                    Expo app (React Native, Expo Router, SDK 58)
│  ├─ app/                 screens (file-based routes)
│  ├─ components/          UI kit, room card, tab bar, classroom/*
│  ├─ lib/                 api (http + mock), whiteboard protocol, formatting
│  ├─ store/               session (zustand, persisted)
│  └─ theme/               colours, type, spacing, springs
└─ backend/                Spring Boot 3 API + LiveKit docker stack
```

## 1. Try the app in demo mode (no backend)

```bash
npm install
cp .env.example .env            # EXPO_PUBLIC_USE_MOCK=true
npx expo run:android            # or: npx expo run:ios  (needs Xcode)
```

> Video calls use native WebRTC, so the app needs a **development build**; it will not run inside Expo Go.
> No Android Studio? Build in the cloud: `npx eas-cli@latest build --profile development --platform android`, install the APK, then `npx expo start`.

Demo mode gives you seeded classes, fake classmates who "speak", a working whiteboard, and sample recordings. Join code for students: **OOP24K**.

## 2. Run the real stack

```bash
cd backend
docker compose up -d            # LiveKit (video) + Egress (recording) + Redis
mvn spring-boot:run             # Java 21
```

Then in `.env`:

```
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:8080/api
```

and set `LIVEKIT_WS_URL=ws://<LAN-IP>:7880`, `PUBLIC_BASE_URL=http://<LAN-IP>:8080` for the backend, plus `rtc.node_ip` in `backend/livekit/livekit.yaml`, so real phones can reach everything.

## How it works

| Feature | Implementation |
|---|---|
| Roles | `teacher` / `student`, chosen on the welcome screen; enforced by the API |
| Reserve room | `POST /api/rooms` → 6-char join code + email invites |
| Join | invited email, or `POST /api/rooms/join {code}` |
| Video | LiveKit — backend issues a token (`POST /api/rooms/{id}/token`) with `{role}` metadata |
| Whiteboard | Skia canvas; strokes normalised to a 4:3 board and sent over LiveKit's reliable data channel (topic `wb`). Late joiners request a snapshot from the teacher. Teacher can let students draw. |
| Recording | Server-side LiveKit **Egress** (room-composite grid → MP4). Every participant sees the REC badge via `RecordingStatusChanged`. The `egress_ended` webhook marks the recording ready. |
| Replay | `expo-video` player with native controls and PiP |

## Before production

- Sign-up/log-in now use real passwords (BCrypt-hashed, `POST /api/auth/sign-up` + `/sign-in`) instead of the old passwordless demo — still worth moving to Spring Security + JWT / OAuth before production.
- Move recordings to S3 / R2 and return signed URLs.
- Send invitation emails (TODO in `RoomController.create`).
- Use PostgreSQL instead of H2; deploy LiveKit on a server with a public IP or use LiveKit Cloud.
