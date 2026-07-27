# Cropvibe Admin

Admin web app for Cropvibe (users, reports, moderation).

## Run locally

```bash
cd Admin
npm install
npm run dev
```

Opens at http://localhost:5174

## Login

Uses the main API (`/v1/auth/login`). Only accounts with `role: "admin"` can sign in.

Optional env:

```env
VITE_API_BASE_URL=https://cropvibe-api-production.up.railway.app/api
```
