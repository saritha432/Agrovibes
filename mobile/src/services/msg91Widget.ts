import { OTPWidget } from "@msg91comm/sendotp-react-native";
import { confirmProviderPhone, fetchProviderMsg91Widget } from "./api";

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

async function readyWidget(token: string) {
  const config = await fetchProviderMsg91Widget(token);
  await OTPWidget.initializeWidget(config.widgetId, config.tokenAuth);
}

export async function sendProviderOtpWithMsg91(token: string, phoneDigits: string) {
  await readyWidget(token);
  const result = assertMsg91Ok(
    (await OTPWidget.sendOTP({ identifier: `91${phoneDigits}` })) as Msg91Result | undefined,
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
  await readyWidget(token);
  const result = assertMsg91Ok(
    (await OTPWidget.verifyOTP({ reqId, otp })) as Msg91Result | undefined,
    "That code was not accepted."
  );
  const accessToken = String(result["access-token"] || result.message || "").trim();
  if (!accessToken) throw new Error("That code was not accepted.");
  await confirmProviderPhone(token, { phone: phoneDigits, accessToken });
}
