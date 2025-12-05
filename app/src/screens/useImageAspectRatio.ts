import { useState, useEffect } from 'react';
import { Image } from 'react-native';

// A simple in-memory cache for aspect ratios to prevent re-fetching.
const aspectRatioCache = new Map<string, number>();

export const useImageAspectRatio = (imageUrl?: string, headers?: { [key: string]: string }): number | null => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(() => {
    // Initialize state from cache if available
    return imageUrl ? aspectRatioCache.get(imageUrl) || null : null;
  });

  useEffect(() => {
    // Do not fetch if we have no URL or if the aspect ratio is already cached/loaded.
    if (!imageUrl || aspectRatioCache.has(imageUrl)) {
      return;
    }

    let isMounted = true;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (isMounted && height > 0) {
          const newAspectRatio = width / height;
          aspectRatioCache.set(imageUrl, newAspectRatio);
          setAspectRatio(newAspectRatio);
        }
      },
      (error) => {
        console.error(`Failed to get image size for ${imageUrl}:`, error);
        if (isMounted) {
          // Cache the fallback aspect ratio to prevent re-fetching on error
          aspectRatioCache.set(imageUrl, 1);
          setAspectRatio(1); // Fallback to a 1:1 ratio on error
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [imageUrl]); // Only re-run if the imageUrl changes

  return aspectRatio;
};