/**
 * Android adaptive icons mask ~outer 33% of the 1024×1024 foreground.
 * Full-bleed wordmarks get clipped (e.g. C and E). This script writes
 * assets/logo-adaptive-foreground.png with safe padding for Expo/EAS.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const sharp = require("sharp");
  const root = path.join(__dirname, "..");
  const input = path.join(root, "assets", "logo.png");
  const output = path.join(root, "assets", "logo-adaptive-foreground.png");
  if (!fs.existsSync(input)) {
    console.error("Missing:", input);
    process.exit(1);
  }

  const CANVAS = 1024;
  /** Keep artwork inside circle safe zone (Google ~66% diameter). */
  const targetMax = Math.floor(CANVAS * 0.62);

  const resized = await sharp(input)
    .ensureAlpha()
    .resize({
      width: targetMax,
      height: targetMax,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

  const info = await sharp(resized).metadata();
  const rw = info.width || targetMax;
  const rh = info.height || targetMax;
  const left = Math.round((CANVAS - rw) / 2);
  const top = Math.round((CANVAS - rh) / 2);

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(output);

  console.log("Wrote", output, { rw, rh, left, top });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
