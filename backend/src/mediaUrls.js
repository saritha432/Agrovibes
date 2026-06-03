/** Drop dead Cloudinary URLs so clients never request res.cloudinary.com (401). */
function stripLegacyCloudinaryUrl(url) {
  if (url == null) return null;
  const u = String(url).trim();
  if (!u || /res\.cloudinary\.com/i.test(u)) return null;
  return u;
}

function sanitizeHomePostRowMedia(base) {
  if (!base || typeof base !== "object") return base;
  base.videoUrl = stripLegacyCloudinaryUrl(base.videoUrl);
  base.imageUrl = stripLegacyCloudinaryUrl(base.imageUrl);
  base.thumbnailUrl = stripLegacyCloudinaryUrl(base.thumbnailUrl);
  base.authorAvatarUrl = stripLegacyCloudinaryUrl(base.authorAvatarUrl);
  base.musicAudioUrl = stripLegacyCloudinaryUrl(base.musicAudioUrl);
  if (Array.isArray(base.imageUrls)) {
    base.imageUrls = base.imageUrls.map(stripLegacyCloudinaryUrl).filter(Boolean);
    if (base.imageUrls.length === 0) delete base.imageUrls;
  }
  if (Array.isArray(base.recentLikers)) {
    base.recentLikers = base.recentLikers.map((liker) => ({
      ...liker,
      avatarUrl: stripLegacyCloudinaryUrl(liker?.avatarUrl)
    }));
  }
  return base;
}

function sanitizeStoryRowMedia(row) {
  if (!row || typeof row !== "object") return row;
  row.videoUrl = stripLegacyCloudinaryUrl(row.videoUrl);
  row.imageUrl = stripLegacyCloudinaryUrl(row.imageUrl);
  row.avatarUrl = stripLegacyCloudinaryUrl(row.avatarUrl);
  return row;
}

module.exports = {
  stripLegacyCloudinaryUrl,
  sanitizeHomePostRowMedia,
  sanitizeStoryRowMedia
};
