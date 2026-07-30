import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { ensureMediaLibraryAccess } from "./mediaLibraryPermission";

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

export type GalleryAssetsPage = {
  assets: GalleryGridAsset[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export const GALLERY_INITIAL_PAGE_SIZE = 40;
export const GALLERY_PAGE_SIZE = 40;

const RECENTS_ID = "";

function mediaTypesForMode(mode: "post" | "story" | "reel" | "live") {
  if (mode === "post") return [MediaLibrary.MediaType.photo];
  if (mode === "reel") return [MediaLibrary.MediaType.video];
  return [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
}

function mapAsset(a: MediaLibrary.Asset): GalleryGridAsset {
  return {
    id: a.id,
    uri: a.uri,
    mediaType: a.mediaType === MediaLibrary.MediaType.video ? "video" : "image",
    filename: a.filename,
    duration: a.duration
  };
}

export function defaultPostGallerySelection(assets: GalleryGridAsset[]): string[] {
  const first = assets.find((a) => a.mediaType === "image");
  return first ? [first.id] : [];
}

/** Fast path: load one page of grid assets (paginated). */
export async function fetchGalleryAssetsPage(
  albumId: string | null,
  mode: "post" | "story" | "reel" | "live",
  options?: { after?: string | null; first?: number }
): Promise<GalleryAssetsPage> {
  const perm = await ensureMediaLibraryAccess();
  if (!perm.granted) {
    return { assets: [], hasNextPage: false, endCursor: null };
  }

  const first = options?.first ?? (options?.after ? GALLERY_PAGE_SIZE : GALLERY_INITIAL_PAGE_SIZE);
  const result = await MediaLibrary.getAssetsAsync({
    first,
    after: options?.after ?? undefined,
    mediaType: mediaTypesForMode(mode),
    sortBy: [MediaLibrary.SortBy.creationTime],
    ...(albumId ? { album: albumId } : {})
  });

  return {
    assets: result.assets.map(mapAsset),
    hasNextPage: result.hasNextPage,
    endCursor: result.endCursor ?? null
  };
}

/** Backward-compatible helper for callers that need the full first page only. */
export async function fetchGalleryAssets(
  albumId: string | null,
  mode: "post" | "story" | "reel" | "live"
): Promise<GalleryGridAsset[]> {
  const page = await fetchGalleryAssetsPage(albumId, mode);
  return page.assets;
}

/** Album list — defer calling until the album picker opens (can be slow on large libraries). */
export async function fetchGalleryAlbums(): Promise<GalleryAlbum[]> {
  const perm = await ensureMediaLibraryAccess();
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

  const recentsTotal = mapped.reduce((sum, album) => sum + album.assetCount, 0);

  return [
    {
      id: RECENTS_ID,
      title: "Recents",
      assetCount: recentsTotal
    },
    ...mapped
  ];
}

export function recentsAlbumId() {
  return RECENTS_ID;
}

export function defaultGalleryAlbums(): GalleryAlbum[] {
  return [{ id: RECENTS_ID, title: "Recents", assetCount: 0 }];
}
