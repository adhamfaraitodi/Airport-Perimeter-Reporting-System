"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ImageRef } from "../_lib/client-api";
import { message } from "../_lib/draft-store";

function Photo({ image }: { image: ImageRef }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(image.url);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    if (visible && !url) {
      setError("");
      api
        .getImage({ imageId: image.id })
        .then((result) => {
          if (active) {
            if (!result.url) throw new Error("Foto belum tersedia.");
            setUrl(result.url);
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    }
    return () => {
      active = false;
    };
  }, [visible, image.id, url, retry]);

  return (
    <div className="gallery-photo" ref={host}>
      {error ? (
        <button
          type="button"
          onClick={() => {
            setUrl(null);
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          {error} · Coba lagi
        </button>
      ) : url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            loading="lazy"
            alt="Foto bukti laporan"
            onError={() => setError("Foto gagal dimuat")}
          />
        </a>
      ) : (
        <span>Memuat foto…</span>
      )}
    </div>
  );
}

export default function Gallery({ images = [] }: { images?: ImageRef[] }) {
  return (
    <div className="gallery">
      {images.map((image) => (
        <Photo key={image.id} image={image} />
      ))}
    </div>
  );
}
