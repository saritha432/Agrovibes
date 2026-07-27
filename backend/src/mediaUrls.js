const { isS3StorageConfigured, rewriteS3ObjectUrlToPublicCdn } = require("./s3Storage");

/** Drop dead Cloudinary URLs so clients never request res.cloudinary.com (401). */
function stripLegacyCloudinaryUrl(url) {
  if (url == null) return null;
  const u = String(url).trim();
  if (!u || /res\.cloudinary\.com/i.test(u)) return null;
  return u;
}

function preferCdnMediaUrl(url) {
  const cleaned = stripLegacyCloudinaryUrl(url);
  if (!cleaned || !isS3StorageConfigured()) return cleaned;
  return rewriteS3ObjectUrlToPublicCdn(cleaned) || cleaned;
}

function sanitizeHomePostRowMedia(base) {
  if (!base || typeof base !== "object") return base;
  base.videoUrl = preferCdnMediaUrl(base.videoUrl);
  base.hlsUrl = preferCdnMediaUrl(base.hlsUrl);
  base.imageUrl = preferCdnMediaUrl(base.imageUrl);
  base.thumbnailUrl = preferCdnMediaUrl(base.thumbnailUrl);
  base.authorAvatarUrl = preferCdnMediaUrl(base.authorAvatarUrl);
  base.musicAudioUrl = preferCdnMediaUrl(base.musicAudioUrl);
  if (Array.isArray(base.imageUrls)) {
    base.imageUrls = base.imageUrls.map(preferCdnMediaUrl).filter(Boolean);
    if (base.imageUrls.length === 0) delete base.imageUrls;
  }
  if (Array.isArray(base.recentLikers)) {
    base.recentLikers = base.recentLikers.map((liker) => ({
      ...liker,
      avatarUrl: preferCdnMediaUrl(liker?.avatarUrl)
    }));
  }
  return base;
}

function sanitizeStoryRowMedia(row) {
  if (!row || typeof row !== "object") return row;
  row.videoUrl = preferCdnMediaUrl(row.videoUrl);
  row.imageUrl = preferCdnMediaUrl(row.imageUrl);
  row.avatarUrl = preferCdnMediaUrl(row.avatarUrl);
  return row;
}

module.exports = {
  stripLegacyCloudinaryUrl,
  preferCdnMediaUrl,
  sanitizeHomePostRowMedia,
  sanitizeStoryRowMedia
};
