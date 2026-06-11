/**
 * Rasterize large Figma-export SVGs (embedded base64 images) to PNG for native.
 * react-native-svg SvgUri cannot reliably render multi-MB raster-in-SVG files.
 */
const fs = require("fs");
const path = require("path");

const MIN_BYTES = 200 * 1024;
const OUTPUT_WIDTH = 170;

async function main() {
  const sharp = require("sharp");
  const marketDir = path.join(__dirname, "..", "assets", "market");
  const files = fs.readdirSync(marketDir).filter((f) => f.endsWith(".svg"));
  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const svgPath = path.join(marketDir, file);
    const stat = fs.statSync(svgPath);
    if (stat.size < MIN_BYTES) {
      skipped += 1;
      continue;
    }

    const pngPath = path.join(marketDir, file.replace(/\.svg$/i, ".png"));
    try {
      await sharp(svgPath, { density: 144 })
        .resize({ width: OUTPUT_WIDTH, fit: "inside", withoutEnlargement: false })
        .png({ compressionLevel: 9, quality: 85 })
        .toFile(pngPath);
      const outStat = fs.statSync(pngPath);
      console.log(`OK ${file} -> ${path.basename(pngPath)} (${Math.round(outStat.size / 1024)}KB)`);
      converted += 1;
    } catch (err) {
      console.error(`FAIL ${file}:`, err.message);
    }
  }

  console.log(`Done: ${converted} converted, ${skipped} small SVGs skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
