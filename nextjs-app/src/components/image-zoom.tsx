'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ImageZoomProps {
  src: string;
  alt: string;
  thumbnailClassName?: string;
  thumbnailSize?: number;
}

// Allowed domains configured in next.config.ts
const ALLOWED_DOMAINS = ['res.cloudinary.com', 'cdn.schema.io'];

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function ImageZoom({
  src,
  alt,
  thumbnailClassName = '',
  thumbnailSize = 48,
}: ImageZoomProps) {
  const [open, setOpen] = useState(false);
  const useNextImage = isAllowedDomain(src);

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative overflow-hidden bg-muted cursor-zoom-in transition-opacity hover:opacity-80 ${thumbnailClassName}`}
        style={{ width: thumbnailSize, height: thumbnailSize }}
      >
        {useNextImage ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={`${thumbnailSize}px`}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </button>

      {/* Zoomed Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-0 border-0 bg-transparent shadow-none"
          showCloseButton={false}
        >
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-zoom-out"
          >
            {useNextImage ? (
              <Image
                src={src}
                alt={alt}
                width={800}
                height={800}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                sizes="90vw"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt={alt}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg"
              />
            )}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
