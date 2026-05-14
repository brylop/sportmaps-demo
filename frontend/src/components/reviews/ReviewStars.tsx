import { Star } from 'lucide-react';

interface Props {
    rating:    number;       // 0..5 (acepta decimales)
    size?:     'xs' | 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    onChange?: (v: number) => void; // si se pasa, modo input
}

const SIZE_PX: Record<NonNullable<Props['size']>, number> = {
    xs: 12, sm: 14, md: 16, lg: 22,
};

/**
 * Estrellas de rating. Solo lectura por defecto.
 * Si onChange viene, se vuelve input (1..5).
 */
export function ReviewStars({ rating, size = 'sm', showLabel, onChange }: Props) {
    const px = SIZE_PX[size];
    const rounded = Math.round(rating * 2) / 2;

    return (
        <div className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(n => {
                const filled = n <= rounded;
                const half   = !filled && n - 0.5 === rounded;
                const Icon   = (
                    <Star
                        width={px}
                        height={px}
                        className={
                            filled ? 'fill-amber-400 text-amber-400'
                          : half   ? 'fill-amber-400/50 text-amber-400'
                          : 'fill-transparent text-slate-300'
                        }
                    />
                );
                if (onChange) {
                    return (
                        <button key={n} type="button" onClick={() => onChange(n)} className="hover:scale-110 transition-transform">
                            {Icon}
                        </button>
                    );
                }
                return <span key={n}>{Icon}</span>;
            })}
            {showLabel && (
                <span className="text-xs text-muted-foreground ml-1.5">
                    {rating > 0 ? rating.toFixed(1) : '—'}
                </span>
            )}
        </div>
    );
}
