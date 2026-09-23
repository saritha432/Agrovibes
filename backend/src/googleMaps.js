function googleMapsBrowserKey() {
  return String(process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();
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

module.exports = {
  googleMapsBrowserKey,
  parseMapCoord,
  mapsConfigHandler
};
