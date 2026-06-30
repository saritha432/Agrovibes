import type { LoginSession, LoginSessionPlatform, LoginSessionsResponse } from "../services/api";
import { getDeviceName, getDevicePlatform } from "./deviceInfo";

export function buildLocalLoginSessionsFallback(device?: {
  deviceName?: string;
  platform?: string;
  locationLabel?: string;
}): LoginSessionsResponse {
  const now = new Date().toISOString();
  const platform = (device?.platform || getDevicePlatform()) as LoginSessionPlatform;
  const deviceName = device?.deviceName || getDeviceName();
  const session: LoginSession = {
    id: "local-current",
    deviceName,
    platform,
    locationLabel: device?.locationLabel || null,
    isRecognized: true,
    lastActiveAt: now,
    createdAt: now,
    isCurrent: true
  };

  return {
    sessions: [session],
    platformSummaries: [
      {
        platform,
        deviceName,
        extraCount: 0,
        summary: deviceName
      }
    ],
    unrecognizedLoginCount: 0,
    hasUnrecognizedLogins: false,
    legacyFallback: true
  };
}

export function isLocalLoginSessionId(sessionId: string) {
  return sessionId === "local-current";
}

export const LOGIN_ACTIVITY_DEPLOY_HINT =
  "Full login activity needs the latest backend on Render. Redeploy cropvibe-api, or point EXPO_PUBLIC_API_BASE_URL to your local API.";
