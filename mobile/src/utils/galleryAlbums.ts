import * as MediaLibrary from "expo-media-library";

export type GalleryAlbum = {
  id: string;
  title: string;
  assetCount: number;
};

export type GalleryGridAsset = {
  id: string;
  uri: string;
  mediaType: "image" | "video";
  filename?: string;
  duration?: number;
};

const RECENTS_ID = "";

export async function fetchGalleryAlbums(): Promise<GalleryAlbum[]> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    return [{ id: RECENTS_ID, title: "Recents", assetCount: 0 }];
  }
  const albums = await MediaLibrary.getAlbumsAsync();
  const mapped = albums
    .filter((a) => (a.assetCount ?? 0) > 0)
    .map((a) => ({
      id: String(a.id),
      title: String(a.title || "Album").trim() || "Album",
      assetCount: Number(a.assetCount ?? 0)
    }))
    .sort((a, b) => {
      const priority = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes("screenshot")) return 0;
        if (t.includes("whatsapp")) return 1;
        if (t.includes("camera")) return 2;
        if (t.includes("download")) return 3;
        return 4;
      };
      const pa = priority(a.title);
      const pb = priority(b.title);
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

  const recentCount = await MediaLibrary.getAssetsAsync({
    first: 1,
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sortBy: [MediaLibrary.SortBy.creationTime]
  });

  return [
    {
      id: RECENTS_ID,
      title: "Recents",
      assetCount: recentCount.totalCount ?? mapped.reduce((s, a) => s + a.assetCount, 0)
    },
    ...mapped
  ];
}

export async function fetchGalleryAssets(
  albumId: string | null,
  mode: "post" | "story" | "reel" | "live"
): Promise<GalleryGridAsset[]> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) return [];

  const mediaType =
    mode === "post"
      ? [MediaLibrary.MediaType.photo]
      : mode === "reel"
        ? [MediaLibrary.MediaType.video]
        : [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];

  const result = await MediaLibrary.getAssetsAsync({
    first: mode === "story" ? 48 : 120,
    mediaType,
    sortBy: [MediaLibrary.SortBy.creationTime],
    ...(albumId ? { album: albumId } : {})
  });

  return result.assets.map((a) => ({
    id: a.id,
    uri: a.uri,
    mediaType: a.mediaType === MediaLibrary.MediaType.video ? "video" : "image",
    filename: a.filename,
    duration: a.duration
  }));
}

export function recentsAlbumId() {
  return RECENTS_ID;
}
