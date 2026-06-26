import { createPortal } from "react-dom";
import "./ProfilePhotoOptionsSheet.css";

type Props = {
  open: boolean;
  hasPhoto: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onGallery: () => void;
  onRemove: () => void;
};

export function ProfilePhotoOptionsSheet({ open, hasPhoto, onClose, onTakePhoto, onGallery, onRemove }: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="profile-photo-sheet" role="dialog" aria-modal="true" aria-label="Change profile photo">
      <button type="button" className="profile-photo-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="profile-photo-sheet__panel">
        <h3>Change profile photo</h3>
        <button type="button" onClick={onTakePhoto}>
          Take photo
        </button>
        <button type="button" onClick={onGallery}>
          Choose from gallery
        </button>
        {hasPhoto ? (
          <button type="button" className="profile-photo-sheet__remove" onClick={onRemove}>
            Remove profile photo
          </button>
        ) : null}
        <button type="button" className="profile-photo-sheet__cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
