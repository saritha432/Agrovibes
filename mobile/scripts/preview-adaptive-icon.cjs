/**
 * Preview how Android launcher icons will look — no APK/EAS build required.
 * Writes assets/icon-preview-android.png (circle mask) and logs asset checks.
 */
const fs = require("fs");
const path = require("path");

const CANVAS = 1024;
/** Visible area on many launchers (~66% of foreground). */
const SAFE_DIAMETER = Math.floor(CANVAS * 0.66);

async function main() {
  const sharp = require("sharp");
  const root = path.join(__dirname, "..");
  const appJson = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  const fgRel =
    appJson?.expo?.android?.adaptiveIcon?.foregroundImage ||
    appJson?.expo?.icon ||
    "./assets/logo-adaptive-foreground.png";
  const fgPath = path.resolve(root, fgRel.replace(/^\.\//, ""));
  const bg = appJson?.expo?.android?.adaptiveIcon?.backgroundColor || "#1f1f1f";
  const outPath = path.join(root, "assets", "icon-preview-android.png");

  if (!fs.existsSync(fgPath)) {
    console.error("Foreground not found:", fgPath);
    process.exit(1);
  }

  const meta = await sharp(fgPath).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const ratio = w && h ? (w / h).toFixed(2) : "?";

  console.log("\n--- Adaptive icon check (no APK) ---");
  console.log("Foreground:", path.relative(root, fgPath));
  console.log("Size:", `${w}x${h}`, `(ratio ${ratio}:1)`);
  if (w !== h) {
    console.warn(
      "WARN: Not square. Android will center-crop; wide logos often show only one letter (e.g. P)."
    );
  } else if (w < 512) {
    console.warn("WARN: Smaller than 512px; use 1024x1024 for best results.");
  } else {
    console.log("OK: Square icon suitable for adaptive foreground.");
  }

  const bgHex = bg.replace("#", "");
  const bgR = parseInt(bgHex.slice(0, 2), 16);
  const bgG = parseInt(bgHex.slice(2, 4), 16);
  const bgB = parseInt(bgHex.slice(4, 6), 16);

  const foreground = await sharp(fgPath)
    .resize(CANVAS, CANVAS, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const circleMask = Buffer.from(
    `<svg width="${CANVAS}" height="${CANVAS}">
      <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${SAFE_DIAMETER / 2}" fill="white"/>
    </svg>`
  );

  const masked = await sharp(foreground)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: { r: bgR, g: bgG, b: bgB }
    }
  })
    .composite([{ input: masked, gravity: "center" }])
    .png()
    .toFile(outPath);

  console.log("Preview written:", path.relative(root, outPath));
  console.log("Open that PNG — it should show full CROPVIBE inside the circle.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
