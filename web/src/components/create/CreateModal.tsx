import { useEffect, useRef, useState } from "react";
import { createHomePost, createHomeStory } from "../../api/posts";
import { shouldUseImageUpload, uploadPickedMedia } from "../../api/uploads";
import { useAuth } from "../../auth/AuthContext";
import "./CreateModal.css";

export type CreateEntryType = "post" | "reel" | "story";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateModal({ open, onClose }: Props) {
  const { user, token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [entryType, setEntryType] = useState<CreateEntryType>("post");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [step, setStep] = useState<"pick-type" | "compose">("pick-type");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEntryType("post");
      setFiles([]);
      setPreviewUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
      setCaption("");
      setStep("pick-type");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  const onPickFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    const list = Array.from(picked);
    if (entryType === "reel") {
      const f = list[0];
      if (shouldUseImageUpload(f)) {
        setError("Drops must be a video file.");
        return;
      }
      setFiles([f]);
      setPreviewUrls([URL.createObjectURL(f)]);
    } else if (entryType === "post") {
      const allImages = list.every((f) => shouldUseImageUpload(f));
      if (!allImages) {
        setError("Posts with multiple items must be photos only.");
        return;
      }
      setFiles(list);
      setPreviewUrls(list.map((f) => URL.createObjectURL(f)));
    } else {
      const f = list[0];
      setFiles([f]);
      setPreviewUrls([URL.createObjectURL(f)]);
    }
    setError(null);
    setStep("compose");
  };

  const publish = async () => {
    if (!user || submitting) return;
    if (!files.length) {
      setError("Choose a photo or video first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const userName = user.fullName?.trim() || "Farmer";
      const location = user.locationLabel?.trim() || "Unknown";

      if (entryType === "story") {
        const file = files[0];
        const { url } = await uploadPickedMedia(file);
        await createHomeStory(
          {
            userName,
            district: location,
            ...(shouldUseImageUpload(file) ? { imageUrl: url } : { videoUrl: url })
          },
          token
        );
      } else {
        const isReel = entryType === "reel";
        const file = files[0];
        const { url } = await uploadPickedMedia(file);
        let imageUrl: string | undefined;
        let imageUrls: string[] | undefined;
        let videoUrl: string | undefined;
        if (isReel) {
          videoUrl = url;
        } else if (files.length > 1) {
          const urls: string[] = [];
          for (const f of files) {
            const up = await uploadPickedMedia(f);
            urls.push(up.url);
          }
          imageUrls = urls;
          imageUrl = urls[0];
        } else if (shouldUseImageUpload(file)) {
          imageUrl = url;
        } else {
          videoUrl = url;
        }
        const prefix = isReel ? "[REEL]" : "[POST]";
        const cap = caption.trim() ? `${prefix} ${caption.trim()}` : prefix;
        await createHomePost(
          {
            userId: user.id,
            userName,
            location,
            caption: cap,
            videoUrl,
            imageUrl,
            imageUrls
          },
          token
        );
      }
      window.dispatchEvent(new CustomEvent("cropvibe:feed-refresh"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="create-modal" role="dialog" aria-modal="true" aria-label="Create">
      <button type="button" className="create-modal__backdrop" onClick={onClose} aria-label="Close" />
      <div className="create-modal__panel">
        <header className="create-modal__head">
          <h2>Create</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {step === "pick-type" ? (
          <div className="create-modal__types">
            {(
              [
                { id: "post" as const, label: "Post", hint: "Photos" },
                { id: "reel" as const, label: "Drop", hint: "Short video" },
                { id: "story" as const, label: "Story", hint: "24h" }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`create-modal__type${entryType === t.id ? " create-modal__type--active" : ""}`}
                onClick={() => {
                  setEntryType(t.id);
                  setError(null);
                  fileRef.current?.click();
                }}
              >
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
              </button>
            ))}
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={entryType === "reel" ? "video/*" : entryType === "post" ? "image/*" : "image/*,video/*"}
              multiple={entryType === "post"}
              onChange={(e) => onPickFiles(e.target.files)}
            />
          </div>
        ) : (
          <div className="create-modal__compose">
            <div className="create-modal__previews">
              {previewUrls.map((url, i) =>
                files[i]?.type.startsWith("video/") ? (
                  <video key={url} src={url} controls playsInline className="create-modal__preview" />
                ) : (
                  <img key={url} src={url} alt="" className="create-modal__preview" />
                )
              )}
            </div>
            {entryType !== "story" ? (
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption…"
                rows={3}
                maxLength={2200}
              />
            ) : null}
            <div className="create-modal__actions">
              <button type="button" onClick={() => setStep("pick-type")}>
                Back
              </button>
              <button type="button" className="create-modal__publish" disabled={submitting} onClick={() => void publish()}>
                {submitting ? "Publishing…" : "Share"}
              </button>
            </div>
          </div>
        )}

        {error ? <p className="create-modal__error">{error}</p> : null}
      </div>
    </div>
  );
}
