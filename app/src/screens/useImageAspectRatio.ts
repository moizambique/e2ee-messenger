import { useState, useEffect } from 'react';
import { Image } from 'react-native';

export const useImageAspectRatio = (imageUrl?: string, headers?: { [key: string]: string }): number | null => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    let isMounted = true;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (isMounted) {
          setAspectRatio(width / height);
        }
      },
      (error) => {
        console.error(`Failed to get image size for ${imageUrl}:`, error);
        if (isMounted) setAspectRatio(1); // Fallback to a 1:1 ratio on error
      }
    );

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return aspectRatio;
};