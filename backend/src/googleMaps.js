function googleMapsBrowserKey() {
  return String(
    process.env.GOOGLE_MAPS_BROWSER_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_JAVASCRIPT_API_KEY ||
      process.env.GOOGLE_MAPS_KEY ||
      ""
  ).trim();
}

function parseMapCoord(value, min, max) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function mapsConfigHandler(_req, res) {
  const key = googleMapsBrowserKey();
  if (!key) {
    res.json({ configured: false });
    return;
  }
  res.json({ configured: true, key });
}

function logMapsConfigStatus() {
  const configured = Boolean(googleMapsBrowserKey());
  // eslint-disable-next-line no-console
  console.log(
    `[maps] Google Maps key ${
      configured ? "loaded from env" : "missing — set GOOGLE_MAPS_BROWSER_KEY or GOOGLE_MAPS_API_KEY"
    }`
  );
}

module.exports = {
  googleMapsBrowserKey,
  parseMapCoord,
  mapsConfigHandler,
  logMapsConfigStatus
};
