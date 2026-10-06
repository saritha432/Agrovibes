#!/usr/bin/env node
/**
 * Start Metro for the dev client with the PC's Wi-Fi/LAN IP baked into the QR/deep link.
 * Plain `expo start` on Windows often advertises 127.0.0.1, which a phone cannot reach.
 *
 * Usage: node scripts/start-metro.cjs [--port 8082] [--clear] [--tunnel] [extra expo args]
 * Override the host with REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.y if detection picks the wrong adapter.
 */
const os = require("os");
const { spawn } = require("child_process");

const VIRTUAL_ADAPTER = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier|hamachi|npcap/i;

function isPrivateIpv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

function detectLanIp() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : entry.family === 4 ? "IPv4" : "IPv6";
      if (family !== "IPv4" || entry.internal || !isPrivateIpv4(entry.address)) continue;
      let score = 0;
      if (/wi-?fi|wlan|wireless/i.test(name)) score += 3;
      if (/ethernet|^en|^eth/i.test(name)) score += 2;
      if (/^192\.168\./.test(entry.address)) score += 1;
      if (VIRTUAL_ADAPTER.test(name)) score -= 10;
      candidates.push({ name, address: entry.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

const args = process.argv.slice(2);
const useTunnel = args.includes("--tunnel");
const passthrough = args.filter((arg) => arg !== "--tunnel");
if (!passthrough.includes("--port")) passthrough.push("--port", "8082");

const env = { ...process.env };
const expoArgs = ["expo", "start", "--dev-client", ...passthrough];

if (useTunnel) {
  expoArgs.push("--tunnel");
  console.log("[metro] Using tunnel (works across networks; slower).");
} else {
  const override = String(env.REACT_NATIVE_PACKAGER_HOSTNAME || "").trim();
  const detected = override ? { name: "env override", address: override } : detectLanIp();
  if (detected) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = detected.address;
    console.log(`[metro] Phone URL host: ${detected.address} (${detected.name})`);
  } else {
    console.warn("[metro] No LAN IPv4 found. Connect to Wi-Fi, or run: npm run start:tunnel");
  }
  expoArgs.push("--lan");
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", expoArgs, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32"
});
child.on("exit", (code) => process.exit(code ?? 0));
