# Agrovibes Mobile Platform

Monorepo:
- `mobile`: React Native (Expo + TypeScript)
- `backend`: Node.js + Express API
- `db`: SQL schema

## Local Development

### Backend

1. `cd backend`
2. `npm install`
3. `copy .env.example .env`
4. `npm run dev`

Runs on `http://localhost:5000`.

### Mobile

1. `cd mobile`
2. `npm install`
3. `copy .env.example .env`
4. For local backend testing set in `.env`:
   - `EXPO_PUBLIC_API_BASE_URL=http://localhost:5000/api`
5. `npm start`

For Android emulator local API access use:
- `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000/api`

## Deploy Backend on Render (Node + SQL)

### Required environment variables (Render)

- `PORT=5000`
- `DATABASE_URL=postgres://...`
- `NODE_ENV=production`
- `CORS_ORIGIN=https://your-vercel-domain.vercel.app`

You can use `backend/render.yaml` for Render Blueprint deploy, or set manually:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

### Docker deployment

`backend/Dockerfile` is included. Build and run:

1. `cd backend`
2. `docker build -t agrovibes-backend .`
3. `docker run -p 5000:5000 --env-file .env agrovibes-backend`

After deployment, verify:
- `GET https://your-domain/api/health`

## Deploy Frontend Web on Vercel (Expo Web)

This project supports Vercel deployment from `mobile`.

### Vercel project settings

1. Import repository in Vercel
2. Set **Root Directory** to `mobile`
3. Build uses `mobile/vercel.json`:
   - Build command: `npm run vercel-build`
   - Output directory: `dist`
4. Add environment variable:
   - `EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api`

After deploy, set Render `CORS_ORIGIN` to your Vercel URL.

## Deploy Mobile App (Install directly on Android/iOS)

This project is configured for EAS builds using `mobile/eas.json`.

### One-time setup

1. Install Expo/EAS tools:
   - `npm install -g eas-cli`
2. Login:
   - `eas login`

### Set production API URL (for native app builds)

In `mobile/.env`:
- `EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com/api`

### Build Android APK/AAB

1. `cd mobile`
2. `npm run build:android:preview` (internal testing APK)
3. `npm run build:android:prod` (Play Store AAB)

### Build iOS IPA

1. `cd mobile`
2. `npm run build:ios:prod`

### Install directly on Android device

- Use the EAS build download link and install APK on phone
- Or publish to Play Console for store distribution

## Database

- Core schema: `db/schema.sql`
- Apply schema to production PostgreSQL before first launch

## Important

- Mobile API base URL is read from `EXPO_PUBLIC_API_BASE_URL`.
- If this is not set, app falls back to localhost/emulator URLs.
