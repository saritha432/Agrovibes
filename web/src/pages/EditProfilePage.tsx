import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateMyProfile } from "../api/profile";
import { uploadImageFile } from "../api/uploads";
import { useAuth } from "../auth/AuthContext";
import { ProfilePhotoCropModal } from "../components/profile/ProfilePhotoCropModal";
import { ProfilePhotoOptionsSheet } from "../components/profile/ProfilePhotoOptionsSheet";
import { userInitials } from "./profileUtils";
import "./EditProfilePage.css";

function safeUsername(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function EditProfilePage() {
  const navigate = useNavigate();
  const { user, token, signIn } = useAuth();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(
    () => safeUsername(user?.username || (user?.email || "").split("@")[0] || "")
  );
  const [bio, setBio] = useState(user?.bio || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [location, setLocation] = useState(user?.locationLabel || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);

  if (!user || !token) {
    return (
      <div className="edit-profile">
        <p>Sign in to edit your profile.</p>
      </div>
    );
  }

  const displayAvatar = removeAvatar ? "" : pendingPreview || avatarUrl;

  const onPickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSource(url);
    setPhotoOptionsOpen(false);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const onCropDone = async (blob: Blob) => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    const preview = URL.createObjectURL(blob);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(preview);
    setRemoveAvatar(false);
    setUploadingAvatar(true);
    setError(null);
    try {
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      const { url } = await uploadImageFile(file);
      setAvatarUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onCropCancel = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalAvatar: string | undefined = avatarUrl.trim() || undefined;
      if (removeAvatar) finalAvatar = undefined;

      const payload = {
        fullName: name,
        username: safeUsername(username) || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        locationLabel: location.trim() || undefined,
        avatarUrl: finalAvatar
      };
      const updated = await updateMyProfile(token, payload);
      signIn({
        token: updated.token || token,
        user: { ...user, ...updated.user }
      });
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-profile">
      <header className="edit-profile__head">
        <Link to="/profile">← Back</Link>
        <h1>Edit profile</h1>
        <button
          type="button"
          className="edit-profile__save-top"
          disabled={saving || uploadingAvatar}
          onClick={() => {
            const form = document.getElementById("edit-profile-form") as HTMLFormElement | null;
            form?.requestSubmit();
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="edit-profile__hero">
        <div className="edit-profile__banner" aria-hidden />
        <button
          type="button"
          className="edit-profile__avatar-wrap"
          onClick={() => setPhotoOptionsOpen(true)}
          disabled={uploadingAvatar}
          aria-label="Change profile photo"
        >
          <span className="edit-profile__avatar">
            {displayAvatar ? <img src={displayAvatar} alt="" /> : userInitials(fullName || user.fullName)}
          </span>
          <span className="edit-profile__avatar-badge" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
                stroke="#111"
                strokeWidth="2"
              />
              <circle cx="12" cy="13" r="3.5" stroke="#111" strokeWidth="2" />
            </svg>
          </span>
          <em>{uploadingAvatar ? "Uploading…" : "Change photo"}</em>
        </button>
      </div>

      <form id="edit-profile-form" className="edit-profile__form" onSubmit={(e) => void onSubmit(e)}>
        <section className="edit-profile__card">
          <h2>Basic info</h2>
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </label>
          <label>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={150} />
          </label>
        </section>

        <section className="edit-profile__card">
          <h2>Additional info</h2>
          <label>
            Website
            <input value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="District, State" />
          </label>
        </section>

        {error ? <p className="edit-profile__error">{error}</p> : null}

        <button type="submit" className="edit-profile__save" disabled={saving || uploadingAvatar}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onPickFile(e.target.files)} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={(e) => onPickFile(e.target.files)}
      />

      <ProfilePhotoOptionsSheet
        open={photoOptionsOpen}
        hasPhoto={!!displayAvatar}
        onClose={() => setPhotoOptionsOpen(false)}
        onTakePhoto={() => cameraRef.current?.click()}
        onGallery={() => galleryRef.current?.click()}
        onRemove={() => {
          setRemoveAvatar(true);
          setPendingPreview(null);
          setAvatarUrl("");
          setPhotoOptionsOpen(false);
        }}
      />

      <ProfilePhotoCropModal
        open={!!cropSource}
        sourceUrl={cropSource}
        onCancel={onCropCancel}
        onDone={(blob) => void onCropDone(blob)}
      />
    </div>
  );
}
