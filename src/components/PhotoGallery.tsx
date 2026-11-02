"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export interface GalleryPhoto {
  src: string;
  caption: string | null;
}

/** Grade de fotos com visualização em tela cheia (setas, teclado e deslizar) */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((delta: number) => setOpen((i) => (i == null ? i : Math.min(photos.length - 1, Math.max(0, i + delta)))), [photos.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  const current = open != null ? photos[open] : null;

  return (
    <>
      <div className="gallery">
        {photos.map((p, i) => (
          <button key={p.src} type="button" className="shot" onClick={() => setOpen(i)} aria-label={p.caption ?? `Foto ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.caption ?? ""} loading="lazy" />
            {p.caption && <span className="cap">{p.caption}</span>}
          </button>
        ))}
      </div>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption ?? "Foto"}
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="bar">
            <span className="small" style={{ fontWeight: 600 }}>
              {current.caption ?? "Foto"} <span style={{ opacity: 0.55, fontWeight: 450 }}>· {open! + 1} de {photos.length}</span>
            </span>
            <button type="button" className="glass-btn" onClick={() => setOpen(null)} aria-label="Fechar">
              <Icon name="x" />
            </button>
          </div>
          <div className="stage" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.caption ?? ""} />
          </div>
          <div className="bar" style={{ justifyContent: "center", gap: 16 }}>
            <button type="button" className="glass-btn" onClick={() => go(-1)} disabled={open === 0} aria-label="Anterior">
              <Icon name="back" />
            </button>
            <button type="button" className="glass-btn" onClick={() => go(1)} disabled={open === photos.length - 1} aria-label="Próxima">
              <Icon name="chevron" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
