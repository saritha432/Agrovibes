import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { updateMyProfile } from "../api/profile";
import { useAuth } from "../auth/AuthContext";
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
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState(
    () => safeUsername(user?.username || (user?.email || "").split("@")[0] || "")
  );
  const [bio, setBio] = useState(user?.bio || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [location, setLocation] = useState(user?.locationLabel || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user || !token) {
    return (
      <div className="edit-profile">
        <p>Sign in to edit your profile.</p>
      </div>
    );
  }

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
      const payload = {
        fullName: name,
        username: safeUsername(username) || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        locationLabel: location.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined
      };
      const updated = await updateMyProfile(token, payload);
      signIn({
        token: updated.token || token,
        user: { ...user, ...updated.user, ...payload }
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
      </header>

      <form className="edit-profile__form" onSubmit={(e) => void onSubmit(e)}>
        <div className="edit-profile__avatar-preview">
          <span>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : userInitials(fullName || user.fullName)}
          </span>
        </div>

        <label>
          Avatar URL
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
        </label>
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
        <label>
          Website
          <input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="District, State" />
        </label>

        {error ? <p className="edit-profile__error">{error}</p> : null}

        <button type="submit" className="edit-profile__save" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
