import { confirmProviderPhone, fetchProviderMsg91Widget } from "./api";

const WIDGET_API = "https://control.msg91.com/api/v5/widget";

type Msg91Result = {
  type?: string;
  message?: string;
  invisibleVerified?: boolean;
  "access-token"?: string;
};

function assertMsg91Ok(result: Msg91Result | undefined, fallback: string) {
  if (!result) throw new Error(fallback);
  if (String(result.type || "").toLowerCase() === "error") {
    throw new Error(String(result.message || fallback));
  }
  return result;
}

async function postWidget(path: string, body: Record<string, string>, fallback: string) {
  const response = await fetch(`${WIDGET_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as Msg91Result | null;
  if (!response.ok) {
    throw new Error(String(payload?.message || fallback));
  }
  return assertMsg91Ok(payload || undefined, fallback);
}

export async function sendProviderOtpWithMsg91(token: string, phoneDigits: string) {
  const config = await fetchProviderMsg91Widget(token);
  const result = await postWidget(
    "/sendOtpMobile",
    { widgetId: config.widgetId, tokenAuth: config.tokenAuth, identifier: `91${phoneDigits}` },
    "Could not send the OTP."
  );
  const accessToken = String(result["access-token"] || "").trim();
  if (result.invisibleVerified && accessToken) {
    await confirmProviderPhone(token, { phone: phoneDigits, accessToken });
    return { verified: true as const, reqId: "" };
  }
  const reqId = String(result.message || "").trim();
  if (!reqId) throw new Error("MSG91 did not return an OTP request.");
  return { verified: false as const, reqId };
}

export async function verifyProviderOtpWithMsg91(token: string, phoneDigits: string, reqId: string, otp: string) {
  const config = await fetchProviderMsg91Widget(token);
  const result = await postWidget(
    "/verifyOtp",
    { widgetId: config.widgetId, tokenAuth: config.tokenAuth, reqId, otp },
    "That code was not accepted."
  );
  const accessToken = String(result["access-token"] || result.message || "").trim();
  if (!accessToken) throw new Error("That code was not accepted.");
  await confirmProviderPhone(token, { phone: phoneDigits, accessToken });
}
