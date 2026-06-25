import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const sourcePath = join(publicDir, "cropvibefavicon-source.png");
const outputMaster = join(publicDir, "cropvibefavicon.png");

if (!existsSync(sourcePath)) {
  copyFileSync(outputMaster, sourcePath);
}

const input = readFileSync(sourcePath);

async function toCircularPng(size) {
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`
  );

  return sharp(input)
    .resize(size, size, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

const sizes = [16, 32, 48, 64, 128, 180, 192, 512];

for (const size of sizes) {
  const png = await toCircularPng(size);
  const name = size === 512 ? "cropvibefavicon.png" : `icons/cropvibefavicon-${size}.png`;
  writeFileSync(join(publicDir, name), png);
}

writeFileSync(join(publicDir, "favicon.png"), await toCircularPng(32));

console.log("Circular favicon generated from original PNG (clip only).");
