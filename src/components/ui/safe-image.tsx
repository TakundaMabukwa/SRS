"use client";

import React, { useState, useEffect, useRef } from "react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: React.ReactNode;
}

export function SafeImage({ src, fallback, alt, className, ...props }: SafeImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [useDirect, setUseDirect] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const srcRef = useRef(src);

  useEffect(() => {
    if (!src) return;

    srcRef.current = src;
    setUseDirect(false);
    setObjectUrl(null);

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(src, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled || srcRef.current !== src) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setObjectUrl(url);
      } catch {
        if (!cancelled) setUseDirect(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  if (useDirect) {
    return <img src={src} alt={alt || ""} className={className} {...props} />;
  }

  if (objectUrl) {
    return <img src={objectUrl} alt={alt || ""} className={className} {...props} />;
  }

  if (fallback) return <>{fallback}</>;

  return <div className={className} style={{ background: "#f1f5f9" }} />;
}
