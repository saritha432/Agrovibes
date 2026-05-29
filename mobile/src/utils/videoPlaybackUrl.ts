import { Platform } from "react-native";
import type { HomePost, HomeStory } from "../services/api";

/**
 * expo-av plays MP4 reliably on Android/iOS; Cloudinary HLS (.m3u8 / sp_auto) often fails
 * on native while browsers handle it fine.
 */
export function videoPlaybackUrl(url: string | undefined | null): string {
  const input = String(url || "").trim();
  if (!input) return input;
  if (Platform.OS === "web") return input;

  const isCloudinary = /res\.cloudinary\.com/i.test(input);
  const isHls =
    /\.m3u8($|\?)/i.test(input) || (isCloudinary && /\/video\/upload\/sp_auto/i.test(input));

  if (!isHls) return input;
  if (!isCloudinary) return input;

  let out = input;
  out = out.replace(/\/video\/upload\/sp_auto[^/]*\//i, "/video/upload/c_limit,w_720,h_1280,vc_h264,ac_aac,br_1200k,q_auto:good,f_mp4/");
  out = out.replace(/\.m3u8(?=\?|$)/i, ".mp4");
  if (!/\.mp4($|\?)/i.test(out) && /\/video\/upload\//i.test(out)) {
    out = out.replace(/\.(mov|webm|m4v)(?=\?|$)/i, ".mp4");
  }
  return out;
}

export function mapPostForPlayback(post: HomePost): HomePost {
  if (!post.videoUrl) return post;
  const next = videoPlaybackUrl(post.videoUrl);
  return next === post.videoUrl ? post : { ...post, videoUrl: next };
}

export function mapPostsForPlayback(posts: HomePost[]): HomePost[] {
  return posts.map(mapPostForPlayback);
}

export function mapStoryForPlayback(story: HomeStory): HomeStory {
  if (!story.videoUrl) return story;
  const next = videoPlaybackUrl(story.videoUrl);
  return next === story.videoUrl ? story : { ...story, videoUrl: next };
}

export function mapStoriesForPlayback(stories: HomeStory[]): HomeStory[] {
  return stories.map(mapStoryForPlayback);
}
