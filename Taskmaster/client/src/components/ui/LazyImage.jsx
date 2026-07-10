import React, { useState } from 'react';

const SHIMMER =
  'animate-pulse bg-gradient-to-r from-[var(--color-bg-secondary)] via-[var(--color-bg-border)] to-[var(--color-bg-secondary)]';

/**
 * ponytail: native lazy + optional WebP via picture when srcSet provided
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  webpSrc,
  sizes,
  priority = false,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);

  const imgProps = {
    alt,
    width,
    height,
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    fetchPriority: priority ? 'high' : 'auto',
    onLoad: () => setLoaded(true),
    className: `${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`,
    ...rest,
  };

  const inner = webpSrc ? (
    <picture>
      <source srcSet={webpSrc} type="image/webp" sizes={sizes} />
      <img src={src} {...imgProps} />
    </picture>
  ) : (
    <img src={src} {...imgProps} />
  );

  return (
    <span className={`relative inline-block ${!loaded ? SHIMMER : ''}`}>
      {inner}
    </span>
  );
}
