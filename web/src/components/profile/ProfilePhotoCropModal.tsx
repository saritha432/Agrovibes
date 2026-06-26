import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ProfilePhotoCropModal.css";

type Props = {
  open: boolean;
  sourceUrl: string | null;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
};

export function ProfilePhotoCropModal({ open, sourceUrl, onCancel, onDone }: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, sourceUrl]);

  if (!open || !sourceUrl || typeof document === "undefined") return null;

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y)
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const exportCrop = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const size = 320;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = 280;
    const baseScale = Math.max(viewport / img.naturalWidth, viewport / img.naturalHeight);
    const scale = baseScale * zoom;
    const cx = viewport / 2 + offset.x;
    const cy = viewport / 2 + offset.y;
    const sx = (cx - viewport / 2) / scale;
    const sy = (cy - viewport / 2) / scale;
    const side = viewport / scale;

    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (blob) onDone(blob);
      },
      "image/jpeg",
      0.92
    );
  };

  return createPortal(
    <div className="profile-crop" role="dialog" aria-modal="true" aria-label="Adjust photo">
      <div className="profile-crop__backdrop" onClick={onCancel} />
      <div className="profile-crop__panel">
        <header className="profile-crop__head">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <strong>Adjust photo</strong>
          <button type="button" className="profile-crop__done" onClick={exportCrop}>
            Done
          </button>
        </header>
        <div
          className="profile-crop__viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <img
            ref={imgRef}
            src={sourceUrl}
            alt=""
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
            }}
          />
          <span className="profile-crop__ring" aria-hidden />
        </div>
        <label className="profile-crop__zoom">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
      </div>
    </div>,
    document.body
  );
}
