# Cropvibe Web

Standalone **React** web app for Cropvibe with an Instagram-style left sidebar. Uses the same backend API as the mobile app.

## Stack

- React 19 + TypeScript
- Vite
- React Router

## Setup

```bash
cd web
npm install
cp .env.example .env   # optional
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## API

- **Development:** Vite proxies `/api` → `http://localhost:5000` (start the backend in `../backend`).
- **Production:** set `VITE_API_BASE_URL=https://agrovibes.onrender.com/api` or your API host.

## Layout

| Route | Page |
|-------|------|
| `/` | Home feed (Feed / Reels / Friends / Live tabs) |
| `/search` | User search |
| `/reels` | Reels viewer |
| `/market` | Marketplace (placeholder) |
| `/learn` | Learn (placeholder) |
| `/messages` | Messages (placeholder) |
| `/profile` | Profile |

Mobile app UI is unchanged; this folder is the dedicated web client.

## Build

```bash
npm run build
npm run preview
```
