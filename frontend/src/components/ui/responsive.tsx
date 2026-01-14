import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ResponsiveContainer({ children, className, noPadding = false }: ResponsiveContainerProps) {
  return (
    <div className={cn(
      "w-full max-w-full overflow-x-hidden",
      !noPadding && "px-3 md:px-4 lg:px-6",
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = "gap-4",
  className 
}: ResponsiveGridProps) {
  const gridCols = [
    cols.sm && `grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
  ].filter(Boolean).join(' ');

  return (
    <div className={cn("grid", gridCols, gap, className)}>
      {children}
    </div>
  );
}

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  maxHeight?: string;
}

export function ResponsiveImage({ 
  src, 
  alt, 
  className,
  objectFit = 'cover',
  maxHeight
}: ResponsiveImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "w-full h-auto",
        objectFit === 'cover' && "object-cover",
        objectFit === 'contain' && "object-contain",
        objectFit === 'fill' && "object-fill",
        className
      )}
      style={{ maxHeight: maxHeight || 'auto' }}
      loading="lazy"
    />
  );
}