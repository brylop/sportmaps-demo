import { useState, type ImgHTMLAttributes } from 'react';

/**
 * Imagen de producto con miniaturas WebP (`<ruta>__w200|600|1200.webp`, las genera
 * el BFF al guardar el producto). Si la miniatura no existe (producto anterior o
 * proceso fallido) cae al original, así que nunca queda una imagen rota.
 */

const MARKER = '/storage/v1/object/public/product-images/';
const WIDTHS = [200, 600, 1200] as const;
export type StoreImageWidth = (typeof WIDTHS)[number];

export function isStoreImage(url: string): boolean {
  return url.includes(MARKER) && !/__w\d+\.webp(\?|$)/.test(url);
}

export function storeImageUrl(url: string, width: StoreImageWidth): string {
  if (!isStoreImage(url)) return url;
  const [base, query] = url.split('?');
  return `${base}__w${width}.webp${query ? `?${query}` : ''}`;
}

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  /** Ancho que usa `src`; el `srcSet` agrega los demás. */
  width: StoreImageWidth;
}

export function StoreImage({ src, width, sizes, alt, onError, ...rest }: Props) {
  const [broken, setBroken] = useState(false);
  const derived = !broken && isStoreImage(src);
  return (
    <img
      {...rest}
      alt={alt}
      src={derived ? storeImageUrl(src, width) : src}
      srcSet={derived ? WIDTHS.filter((w) => w >= 200).map((w) => `${storeImageUrl(src, w)} ${w}w`).join(', ') : undefined}
      sizes={derived ? sizes : undefined}
      onError={(e) => { if (derived) setBroken(true); onError?.(e); }}
    />
  );
}
