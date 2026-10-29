"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div
      className="grid aspect-square min-h-[70px] place-items-center overflow-hidden rounded-lg bg-[var(--rd-bg)] md:min-h-[85px]"
      ref={host}
    >
      {error ? (
        <button
          type="button"
          className="max-w-full bg-transparent p-2 text-center text-[10px] text-[var(--rd-coral)] [overflow-wrap:anywhere]"
          onClick={() => {
            setUrl(null);
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          {error} · Coba lagi
        </button>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full w-full"
        >
          <img
            src={url}
            loading="lazy"
            alt="Foto bukti laporan"
            className="block h-full w-full object-cover"
            onError={() => setError("Foto gagal dimuat")}
          />
        </a>
      ) : (
        <Skeleton className="h-full w-full rounded-lg" />
      )}
    </div>
  );
}

export default function Gallery({ images = [] }: { images?: ImageRef[] }) {
  if (!images.length) return null;
  return (
    <div className="mb-6 grid grid-cols-3 gap-1.5 md:gap-2">
      {images.map((image) => (
        <Photo key={image.id} image={image} />
      ))}
    </div>
  );
}
