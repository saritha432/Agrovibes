import { formatDmInboxPreview } from "../../utils/dmMessageFormats";

export function formatThreadTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}


export function previewMessage(body: string) {
  return formatDmInboxPreview(body);
}

export type SharedReelPayload = {
  author: string;
  caption: string;
  videoUrl: string;
  imageUrl: string;
  link: string;
};

export function parseSharedReel(body: string): SharedReelPayload | null {
  const prefixes = ["[Cropvibe Reel]", "[AgroVibe Reel]"];
  let jsonText = "";
  let matched = false;
  for (const p of prefixes) {
    if (body.startsWith(p)) {
      jsonText = body.slice(p.length).trim();
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (jsonText.startsWith("{")) {
    try {
      const parsed = JSON.parse(jsonText) as {
        author?: string;
        caption?: string;
        videoUrl?: string | null;
        imageUrl?: string | null;
        thumbnailUrl?: string | null;
        link?: string;
      };
      return {
        author: parsed.author || "Cropvibe",
        caption: parsed.caption || "",
        videoUrl: parsed.videoUrl || "",
        imageUrl: parsed.imageUrl || parsed.thumbnailUrl || "",
        link: parsed.link || ""
      };
    } catch {
      // legacy text
    }
  }

  const link = lines.find((line) => line.includes("/reel/")) || "";
  return {
    author: lines[1] || "Cropvibe",
    caption: lines.slice(2).filter((line) => line !== link).join("\n"),
    videoUrl: "",
    imageUrl: "",
    link
  };
}
