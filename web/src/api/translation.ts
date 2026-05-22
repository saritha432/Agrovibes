import { API_BASE_URL, fetchWithAuth } from "./client";

export type AppLanguage = "English" | "Hindi" | "Telugu";

export async function translateText(
  token: string,
  payload: {
    text: string;
    targetLanguage: AppLanguage;
    sourceLanguage?: AppLanguage;
    contentType?: "post" | "caption" | "comment" | "chat";
  }
) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/translate`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })) as {
    translatedText: string;
    sourceLanguage?: string;
    targetLanguage: string;
    provider: string;
    cached: boolean;
  };
}
