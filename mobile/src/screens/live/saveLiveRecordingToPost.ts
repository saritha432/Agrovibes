import * as VideoThumbnails from "expo-video-thumbnails";
import type { HomePost } from "../../services/api";
import { updateHomePostLiveVideo, uploadImageFile, uploadVideoFile } from "../../services/api";

export async function saveLiveRecordingToPost(
  token: string,
  postId: number,
  recordingUri: string
): Promise<HomePost | null> {
  try {
    const { url: mediaUrl } = await uploadVideoFile(recordingUri);
    let derivedThumb: string | undefined;
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(recordingUri, { time: 400, quality: 0.72 });
      const { url } = await uploadImageFile(thumb.uri);
      derivedThumb = url;
    } catch {
      // Thumbnail is optional for completed live cards.
    }
    const { post } = await updateHomePostLiveVideo(token, postId, {
      videoUrl: mediaUrl,
      thumbnailUrl: derivedThumb
    });
    return { ...post, liveStatus: "ended", liveViewerCount: 0 };
  } catch {
    return null;
  }
}
