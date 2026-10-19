"use client";

import { ImageOffIcon } from "lucide-react";

type SignedPhoto = { pathname: string; url: string };

/**
 * Thumbnails of private photos served through short-lived signed URLs
 * (MA-02). Each tile opens the full image in a new tab.
 */
export function SignedPhotoGrid({
  photos,
  emptyLabel,
  photoLabel,
  openLabel,
}: {
  photos: SignedPhoto[];
  emptyLabel: string;
  photoLabel: (number: number) => string;
  openLabel: (label: string) => string;
}) {
  if (photos.length === 0) {
    return (
      <p className="text-muted-foreground text-copy-sm inline-flex items-center gap-2">
        <ImageOffIcon aria-hidden="true" className="size-4" />
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, index) => {
        const label = photoLabel(index + 1);

        return (
          <li key={photo.pathname}>
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              aria-label={openLabel(label)}
              className="bg-canvas-soft hover:border-hairline-strong focus-visible:ring-ring block overflow-hidden rounded-xl border transition-[border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Blob URLs expire in minutes, outside the image loader. */}
              <img
                src={photo.url}
                alt={label}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
