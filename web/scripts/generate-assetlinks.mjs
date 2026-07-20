import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../public/.well-known/assetlinks.json");

const raw = String(process.env.ANDROID_APP_LINK_SHA256 || "").trim();
const fingerprints = raw
  .split(/[\s,]+/)
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const placeholder = "REPLACE_WITH_RELEASE_SHA256_FROM_EAS";

if (fingerprints.length === 0) {
  const existing = readFileSync(outPath, "utf8");
  if (existing.includes(placeholder)) {
    console.warn(
      "[assetlinks] ANDROID_APP_LINK_SHA256 is not set; assetlinks.json still contains a placeholder.",
    );
    console.warn(
      "[assetlinks] Play Console domain verification will fail until you set this env var and redeploy.",
    );
  }
  process.exit(0);
}

for (const fp of fingerprints) {
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp)) {
    console.error(`[assetlinks] Invalid SHA-256 fingerprint format: ${fp}`);
    console.error("[assetlinks] Expected 32 colon-separated hex pairs, e.g. AA:BB:CC:...");
    process.exit(1);
  }
}

const assetlinks = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.cropvibe.app",
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

writeFileSync(outPath, `${JSON.stringify(assetlinks, null, 2)}\n`, "utf8");
console.log(`[assetlinks] Wrote ${fingerprints.length} fingerprint(s) to public/.well-known/assetlinks.json`);
