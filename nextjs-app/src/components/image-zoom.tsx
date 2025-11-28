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

export function ImageZoom({
  src,
  alt,
  thumbnailClassName = '',
  thumbnailSize = 48,
}: ImageZoomProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative overflow-hidden bg-muted cursor-zoom-in transition-opacity hover:opacity-80 ${thumbnailClassName}`}
        style={{ width: thumbnailSize, height: thumbnailSize }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={`${thumbnailSize}px`}
        />
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
            <Image
              src={src}
              alt={alt}
              width={800}
              height={800}
              className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg"
              sizes="90vw"
            />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
